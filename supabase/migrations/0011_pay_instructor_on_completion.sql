-- Pay the instructor when the student finishes the course, not when the
-- instructor merely approves the seat. Approval still grants XP (that's the
-- "you took on a student" reward); the credit payout now happens in
-- complete_enrollment alongside the student's completion bonus.

create or replace function decide_enrollment(p_enrollment_id uuid, p_approve boolean)
returns enrollments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row enrollments;
  v_course courses;
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

    -- Credits move to the instructor on completion (see complete_enrollment)
    -- so a student who never finishes never costs the instructor a payout
    -- they'd have to refund.
    perform award_xp(v_row.instructor_id, 50);

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

  update enrollments
     set status = 'completed', progress = 100, completed_at = now(), next_lesson = 'Course complete'
   where id = p_enrollment_id
  returning * into v_row;

  perform award_xp(v_row.student_id, 250);
  perform adjust_credits(
    v_row.student_id, 10, 'course_completion_bonus',
    'Completion bonus: ' || v_course.title, v_course.id
  );

  insert into notifications (user_id, type, message, metadata)
  values (
    v_row.student_id, 'credit_earned',
    '🏆 Course complete: "' || v_course.title || '". +250 XP and +10 credits.',
    jsonb_build_object('course_id', v_course.id)
  );

  if v_row.credit_fee > 0 then
    perform adjust_credits(
      v_row.instructor_id, v_row.credit_fee, 'teaching_earning',
      'Student completed: ' || v_course.title, v_course.id
    );

    insert into notifications (user_id, type, message, metadata)
    values (
      v_row.instructor_id, 'credit_earned',
      '🎓 A student completed "' || v_course.title || '". +' || v_row.credit_fee || ' credits.',
      jsonb_build_object('course_id', v_course.id, 'enrollment_id', v_row.id)
    );
  end if;

  return v_row;
end;
$$;
