-- Split XP into two tracks so teaching and learning are rewarded on their own
-- terms, and make the awards scale with the behaviour we want:
--
--   Teachers earn more as they attract more enrollments.
--   Students earn more by finishing fast and by finishing many courses.
--
-- profiles.xp_points stays the grand total (teaching_xp + learning_xp) so the
-- existing level curve and every UI that reads xp_points keep working.

alter table profiles
  add column if not exists teaching_xp integer not null default 0 check (teaching_xp >= 0),
  add column if not exists learning_xp integer not null default 0 check (learning_xp >= 0);

comment on column profiles.teaching_xp is 'XP earned as an instructor. Sums into xp_points.';
comment on column profiles.learning_xp is 'XP earned as a student. Sums into xp_points.';

-- Existing rows: everything earned so far counts toward the role they hold.
update profiles
   set teaching_xp = case when role in ('Teacher', 'Master Educator') then xp_points else 0 end,
       learning_xp = case when role = 'Student' then xp_points else 0 end
 where teaching_xp = 0 and learning_xp = 0 and xp_points > 0;

revoke update (teaching_xp, learning_xp) on profiles from authenticated;

-- ---------------------------------------------------------------- award_xp

-- Signature change: the old two-argument version is replaced by a tracked one.
drop function if exists award_xp(uuid, integer);

create or replace function award_xp(
  p_user_id uuid,
  p_xp      integer,
  p_track   text default 'learning'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_xp integer;
  v_role user_role;
  v_level integer;
begin
  if p_track not in ('teaching', 'learning') then
    raise exception 'unknown xp track: %', p_track;
  end if;

  update profiles
     set teaching_xp = teaching_xp + case when p_track = 'teaching' then greatest(0, p_xp) else 0 end,
         learning_xp = learning_xp + case when p_track = 'learning' then greatest(0, p_xp) else 0 end
   where id = p_user_id;

  if not found then
    raise exception 'profile % not found', p_user_id;
  end if;

  -- xp_points is derived, never written independently.
  update profiles
     set xp_points = teaching_xp + learning_xp
   where id = p_user_id
  returning xp_points, role into v_xp, v_role;

  v_level := level_for_xp(v_xp);
  update profiles
     set level = v_level,
         level_title = level_title_for(v_level, v_role)
   where id = p_user_id;

  return v_xp;
end;
$$;

revoke execute on function award_xp(uuid, integer, text) from public, anon, authenticated;

-- ---------------------------------------------------------------- xp rules

-- Teaching: a flat award per approved enrollment, plus a milestone bonus every
-- tenth enrollment. Volume is the thing being rewarded, so a popular course
-- compounds rather than paying the same as a quiet one.
create or replace function teaching_xp_for_enrollment(p_instructor_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_total integer;
  v_award integer := 50;
begin
  select count(*) into v_total
    from enrollments
   where instructor_id = p_instructor_id
     and status in ('approved', 'completed');

  -- Every 10th approved enrollment lands a milestone bonus.
  if v_total > 0 and v_total % 10 = 0 then
    v_award := v_award + 250;
  end if;

  -- Sustained demand pays a little better per head.
  v_award := v_award + least(50, (v_total / 25) * 10);

  return v_award;
end;
$$;

-- Learning: a base award, a speed bonus for finishing soon after approval, and
-- a breadth bonus at completed-course milestones.
create or replace function learning_xp_for_completion(
  p_student_id uuid,
  p_days_taken numeric
)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_completed integer;
  v_award integer := 200;
begin
  select count(*) into v_completed
    from enrollments
   where student_id = p_student_id
     and status = 'completed';

  -- Speed: rewards finishing while the material is still fresh.
  if p_days_taken is not null then
    if p_days_taken <= 3 then
      v_award := v_award + 150;
    elsif p_days_taken <= 7 then
      v_award := v_award + 100;
    elsif p_days_taken <= 14 then
      v_award := v_award + 50;
    end if;
  end if;

  -- Breadth: milestone bonuses for a broad completed portfolio.
  if v_completed in (3, 5, 10, 20) then
    v_award := v_award + 300;
  end if;

  return v_award;
end;
$$;

-- ---------------------------------------------------------------- wire into the lifecycle

create or replace function decide_enrollment(p_enrollment_id uuid, p_approve boolean)
returns enrollments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row enrollments;
  v_course courses;
  v_xp integer;
begin
  select * into v_row from enrollments where id = p_enrollment_id;
  if not found then
    raise exception 'enrollment not found';
  end if;
  if v_row.instructor_id <> auth.uid() then
    raise exception 'only the instructor can decide this enrollment';
  end if;
  if v_row.status <> 'pending' then
    raise exception 'enrollment already decided';
  end if;

  select * into v_course from courses where id = v_row.course_id;

  if p_approve then
    update enrollments
       set status = 'approved', decided_at = now(), next_lesson = 'Lesson 1'
     where id = p_enrollment_id
    returning * into v_row;

    update courses set students_count = students_count + 1 where id = v_row.course_id;

    if v_row.credit_fee > 0 then
      perform adjust_credits(
        v_row.instructor_id, v_row.credit_fee, 'teaching_earning',
        'Enrollment approved: ' || v_course.title, v_course.id
      );
    end if;

    v_xp := teaching_xp_for_enrollment(v_row.instructor_id);
    perform award_xp(v_row.instructor_id, v_xp, 'teaching');

    insert into notifications (user_id, type, message, metadata)
    values (
      v_row.student_id, 'enrollment_approved',
      '✅ Your enrollment in "' || v_course.title || '" was approved.',
      jsonb_build_object('course_id', v_course.id)
    );
  else
    update enrollments
       set status = 'declined', decided_at = now()
     where id = p_enrollment_id
    returning * into v_row;

    if v_row.credit_fee > 0 then
      perform adjust_credits(
        v_row.student_id, v_row.credit_fee, 'refund',
        'Refund for declined enrollment: ' || v_course.title, v_course.id
      );
    end if;

    insert into notifications (user_id, type, message, metadata)
    values (
      v_row.student_id, 'enrollment_declined',
      'Your enrollment request for "' || v_course.title || '" was declined and your credits were refunded.',
      jsonb_build_object('course_id', v_course.id)
    );
  end if;

  return v_row;
end;
$$;

create or replace function complete_enrollment(p_enrollment_id uuid)
returns enrollments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row enrollments;
  v_course courses;
  v_days numeric;
  v_xp integer;
begin
  select * into v_row from enrollments
   where id = p_enrollment_id and student_id = auth.uid();
  if not found then
    raise exception 'enrollment not found for this student';
  end if;
  if v_row.status = 'completed' then
    return v_row;
  end if;
  if v_row.status <> 'approved' then
    raise exception 'enrollment is not active';
  end if;

  select * into v_course from courses where id = v_row.course_id;

  -- Speed is measured from approval, not from the request: waiting on the
  -- instructor is not the student's doing.
  v_days := extract(epoch from (now() - coalesce(v_row.decided_at, v_row.requested_at))) / 86400.0;

  update enrollments
     set status = 'completed', progress = 100, completed_at = now(), next_lesson = 'Course complete'
   where id = p_enrollment_id
  returning * into v_row;

  v_xp := learning_xp_for_completion(v_row.student_id, v_days);
  perform award_xp(v_row.student_id, v_xp, 'learning');

  perform adjust_credits(
    v_row.student_id, 10, 'course_completion_bonus',
    'Completion bonus: ' || v_course.title, v_course.id
  );

  insert into notifications (user_id, type, message, metadata)
  values (
    v_row.student_id, 'credit_earned',
    '🏆 Course complete: "' || v_course.title || '". +' || v_xp || ' XP and +10 credits.',
    jsonb_build_object('course_id', v_course.id, 'xp_awarded', v_xp)
  );

  return v_row;
end;
$$;

-- ---------------------------------------------------------------- leaderboard

drop view if exists leaderboard_users;

create view leaderboard_users
with (security_invoker = true)
as
select
  p.id,
  p.name,
  p.email,
  p.avatar_url,
  p.role,
  p.department,
  p.level,
  p.level_title,
  p.xp_points,
  p.teaching_xp,
  p.learning_xp,
  p.badges,
  coalesce(taught.count, 0)::integer     as courses_taught_count,
  coalesce(completed.count, 0)::integer  as courses_completed_count,
  coalesce(students.count, 0)::integer   as students_taught_count,
  coalesce(earned.total, 0)::integer     as credits_earned
from profiles p
left join lateral (
  select count(*) as count from courses c
   where c.instructor_id = p.id and c.published
) taught on true
left join lateral (
  select count(*) as count from enrollments e
   where e.student_id = p.id and e.status = 'completed'
) completed on true
left join lateral (
  select count(*) as count from enrollments e
   where e.instructor_id = p.id and e.status in ('approved', 'completed')
) students on true
left join lateral (
  select sum(t.amount) as total from credit_transactions t
   where t.user_id = p.id and t.amount > 0
     and t.reason in ('teaching_earning', 'course_completion_bonus')
) earned on true;
