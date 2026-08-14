-- Sequential skill test: per-question answer/timestamp log, and a 2-month
-- per-category ban when the instructor fails the topic qualification quiz.

alter table skill_test_attempts
  add column answers jsonb not null default '[]'::jsonb;

comment on column skill_test_attempts.answers is
  'Ordered per-question log: [{questionIndex, question, options, selectedOption, correctAnswer, correct, shownAt, answeredAt}]';

create table skill_test_bans (
  user_id      uuid not null references profiles (id) on delete cascade,
  category     text not null,
  banned_until timestamptz not null,
  created_at   timestamptz not null default now(),
  primary key (user_id, category)
);

alter table skill_test_bans enable row level security;

create policy "users read their own bans"
  on skill_test_bans for select
  to authenticated
  using (user_id = auth.uid());

-- No client-side insert/update policy: only the security-definer RPC below
-- writes to this table.

drop function if exists record_skill_test(text, integer, integer);

create or replace function record_skill_test(
  p_category text,
  p_score    integer,
  p_total    integer,
  p_answers  jsonb default '[]'::jsonb,
  p_passed   boolean default null
)
returns skill_test_attempts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row skill_test_attempts;
  v_passed boolean;
  v_banned_until timestamptz;
begin
  select banned_until into v_banned_until
    from skill_test_bans
   where user_id = auth.uid() and category = p_category and banned_until > now();

  if v_banned_until is not null then
    raise exception 'banned_until_%', to_char(v_banned_until, 'YYYY-MM-DD"T"HH24:MI:SSOF');
  end if;

  -- p_passed lets the client apply its own pass-mark rule (currently ceil(2/3
  -- of the questions) rather than a flat 50%); falls back to the old formula
  -- when omitted so older callers keep working.
  v_passed := coalesce(p_passed, p_score * 2 >= p_total);

  insert into skill_test_attempts (user_id, category, score, total, passed, answers)
  values (auth.uid(), p_category, p_score, p_total, v_passed, p_answers)
  returning * into v_row;

  if not v_passed then
    insert into skill_test_bans (user_id, category, banned_until)
    values (auth.uid(), p_category, now() + interval '2 months')
    on conflict (user_id, category)
    do update set banned_until = excluded.banned_until, created_at = now();
  end if;

  return v_row;
end;
$$;

grant execute on function record_skill_test(text, integer, integer, jsonb, boolean) to authenticated;
