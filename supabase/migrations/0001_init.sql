-- AdmitIQ schema (Supabase / Postgres 15+)
-- Privacy model:
--   * Every table holding student data has row-level security keyed to auth.uid().
--   * Reference data (colleges, statistics, sources, scholarships, deadlines) is public read-only.
--   * Experience submissions are anonymous: no user_id column exists, so they can't be linked back.
--   * Financial details live in their own table so they can be governed separately.

create extension if not exists pgcrypto;

-- ---------- enums ----------
do $$ begin
  create type verification_status as enum ('verified', 'unverified', 'estimated', 'self_reported', 'historical', 'ai_generated', 'unavailable');
  create type confidence_level as enum ('high', 'medium', 'low');
  create type app_status as enum ('Researching', 'Planned', 'In progress', 'Ready to submit', 'Submitted', 'Accepted', 'Deferred', 'Waitlisted', 'Rejected');
exception when duplicate_object then null; end $$;

-- ---------- reference data (public read) ----------
create table if not exists college_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  kind text not null check (kind in ('official_admissions', 'common_data_set', 'official_cost', 'college_scorecard', 'ipeds', 'outcomes_report', 'government', 'research_org', 'community')),
  retrieved_at date,
  notes text,
  unique (url, retrieved_at)
);

create table if not exists colleges (
  id text primary key,
  scorecard_id text unique,
  name text not null,
  short_name text not null,
  city text, state text, country text not null default 'USA',
  kind text not null check (kind in ('Public', 'Private', 'Liberal arts', 'Community college', 'International')),
  setting text check (setting in ('Urban', 'Suburban', 'Small city', 'Rural')),
  lat double precision, lon double precision,
  website text,
  test_policy text,
  rounds text[] not null default '{}',
  majors text[] not null default '{}',
  features text[] not null default '{}',
  notes text,
  updated_at timestamptz not null default now()
);
create index if not exists colleges_name_trgm on colleges using gin (to_tsvector('simple', name || ' ' || short_name || ' ' || coalesce(city, '') || ' ' || coalesce(state, '')));

-- One row per (college, field, reporting year, source). Every statistic carries provenance.
create table if not exists college_statistics (
  id uuid primary key default gen_random_uuid(),
  college_id text not null references colleges(id) on delete cascade,
  field text not null,                       -- e.g. admit_rate, sat_25, sat_75, tuition_in_state, net_price, grad_rate_6yr
  value_num numeric,
  value_text text,
  reporting_year text,
  source_id uuid references college_sources(id),
  retrieved_at date,
  confidence confidence_level not null default 'medium',
  verification verification_status not null default 'unverified',
  verified_by_multiple_sources boolean not null default false,
  created_at timestamptz not null default now(),
  unique (college_id, field, reporting_year, source_id)
);
create index if not exists college_statistics_lookup on college_statistics (college_id, field);

create table if not exists college_programs (
  id uuid primary key default gen_random_uuid(),
  college_id text not null references colleges(id) on delete cascade,
  name text not null,
  degree text,
  admits_direct boolean,
  url text,
  source_id uuid references college_sources(id)
);

create table if not exists deadlines (
  id uuid primary key default gen_random_uuid(),
  college_id text not null references colleges(id) on delete cascade,
  round text not null,
  cycle_year int not null,                   -- entering class year
  deadline date not null,
  source_id uuid references college_sources(id),
  verification verification_status not null default 'unverified',
  unique (college_id, round, cycle_year)
);

create table if not exists scholarships (
  id text primary key,
  name text not null,
  sponsor text not null,
  amount text,
  amount_max numeric,
  cycle text,
  url text not null check (url like 'https://%'),
  eligibility text[] not null default '{}',
  requirements text[] not null default '{}',
  tags text[] not null default '{}',
  verification verification_status not null default 'unverified',
  updated_at timestamptz not null default now()
);

-- ---------- student data (private, RLS) ----------
create table if not exists student_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text, high_school text, city text, state text,
  grad_year int check (grad_year between 2020 and 2040),
  gpa_unweighted numeric check (gpa_unweighted between 0 and 100),
  gpa_weighted numeric check (gpa_weighted between 0 and 110),
  gpa_scale text, class_rank int, class_size int,
  intended_major text, alt_majors text[] not null default '{}',
  testing_status text, planned_tests text, grade_trend text,
  sat_total int check (sat_total between 400 and 1600), sat_rw int, sat_math int, sat_date date,
  act_composite int check (act_composite between 1 and 36), act_english int, act_math int, act_reading int, act_science int, act_date date,
  personal jsonb not null default '{}',      -- optional preferences (no sensitive characteristics are collected)
  onboarded boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists financial_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  share_with_ai boolean not null default false,
  income_bracket text, max_annual_cost numeric, expected_contribution numeric,
  aid_priority text, merit_preference boolean, loan_willingness text, notes text,
  updated_at timestamptz not null default now()
);

create table if not exists academic_records (
  id text primary key, user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, year int not null check (year between 9 and 12), term text not null,
  level text not null, subject text not null, grade text not null, credits numeric not null default 1
);
create table if not exists awards (
  id text primary key, user_id uuid not null references auth.users(id) on delete cascade,
  title text not null, level text not null, grades int[] not null default '{}'
);
create table if not exists activities (
  id text primary key, user_id uuid not null references auth.users(id) on delete cascade,
  sort_order int not null default 0, category text, organization text not null, position text, description text,
  grades int[] not null default '{}', hours_per_week numeric, weeks_per_year numeric,
  achievements text, awards text, leadership text, impact text, people_reached int, significance text, skills text,
  common_app_description text check (char_length(common_app_description) <= 150)
);
create table if not exists college_lists (
  user_id uuid not null references auth.users(id) on delete cascade,
  college_id text not null references colleges(id),
  category text not null, favorite boolean not null default false, notes text, added_at timestamptz not null default now(),
  primary key (user_id, college_id)
);
create table if not exists list_categories (
  user_id uuid not null references auth.users(id) on delete cascade, name text not null, primary key (user_id, name)
);
create table if not exists comparisons (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  college_ids text[] not null check (cardinality(college_ids) between 0 and 10), hidden_metrics text[] not null default '{}', updated_at timestamptz not null default now(),
  unique (user_id)
);
create table if not exists essays (
  id text primary key, user_id uuid not null references auth.users(id) on delete cascade,
  title text not null, type text not null, prompt text, word_limit int, college_id text references colleges(id),
  working_text text not null default '', updated_at timestamptz not null default now()
);
create table if not exists essay_revisions (
  id text primary key, essay_id text not null references essays(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade,
  label text not null, body text not null, scores jsonb, created_at timestamptz not null default now()
);
create table if not exists essay_feedback (
  id text primary key, essay_id text not null references essays(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('comment', 'heuristic', 'ai')), quote text, body jsonb not null, created_at timestamptz not null default now()
);
create table if not exists applications (
  id text primary key, user_id uuid not null references auth.users(id) on delete cascade, college_id text not null references colleges(id),
  round text not null, deadline date, status app_status not null default 'Planned', items jsonb not null default '{}',
  submitted_on date, decision_date date, result text, notes text
);
create table if not exists tasks (
  id text primary key, user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) <= 200), due date, done boolean not null default false,
  priority text not null default 'Medium' check (priority in ('High', 'Medium', 'Low')), college_id text references colleges(id), reminder boolean not null default false
);
create table if not exists saved_opportunities (
  id text primary key, user_id uuid not null references auth.users(id) on delete cascade,
  scholarship_id text references scholarships(id), custom jsonb, created_at timestamptz not null default now(),
  check (scholarship_id is not null or custom is not null)
);
create table if not exists saved_searches (
  id text primary key, user_id uuid not null references auth.users(id) on delete cascade, name text not null, filters jsonb not null
);
create table if not exists user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'system', reduce_motion boolean not null default false, essay_mode text
);

-- Anonymous experience submissions: deliberately NO user_id.
create table if not exists student_experience_submissions (
  id uuid primary key default gen_random_uuid(),
  college_id text not null references colleges(id),
  relation text not null check (relation in ('Current student', 'Recent graduate', 'Admitted student', 'Visitor')),
  year int, ratings jsonb not null default '{}',
  positives text check (char_length(positives) <= 800), concerns text check (char_length(concerns) <= 800),
  consent boolean not null check (consent),
  approved boolean not null default false,  -- moderation gate before public display
  created_at timestamptz not null default now()
);

-- ---------- row-level security ----------
do $$
declare t text;
begin
  foreach t in array array['student_profiles','financial_profiles','academic_records','awards','activities','college_lists','list_categories','comparisons','essays','essay_revisions','essay_feedback','applications','tasks','saved_opportunities','saved_searches','user_preferences'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists own_rows on %I', t);
    execute format('create policy own_rows on %I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
  foreach t in array array['colleges','college_statistics','college_sources','college_programs','deadlines','scholarships'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists public_read on %I', t);
    execute format('create policy public_read on %I for select to anon, authenticated using (true)', t);
  end loop;
end $$;

alter table student_experience_submissions enable row level security;
drop policy if exists read_approved on student_experience_submissions;
create policy read_approved on student_experience_submissions for select to anon, authenticated using (approved);
drop policy if exists submit_with_consent on student_experience_submissions;
create policy submit_with_consent on student_experience_submissions for insert to authenticated with check (consent and not approved);

-- Aggregates only: lets the app show sample size and averages without exposing rows.
create or replace view experience_summary with (security_invoker = true) as
  select college_id, count(*) as sample_size, min(created_at) as first_at, max(created_at) as last_at
  from student_experience_submissions where approved group by college_id;

-- ---------- RPC: sync the client state document into normalized tables ----------
-- SECURITY INVOKER: runs as the calling user, so every write is checked by RLS.
create or replace function sync_state(payload jsonb) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare uid uuid := auth.uid(); p jsonb := payload->'profile'; per jsonb := payload->'personal'; f jsonb := payload->'financial'; x jsonb; i int := 0;
begin
  if uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if (payload->>'version')::int is distinct from 1 then raise exception 'unsupported payload version'; end if;

  insert into student_profiles as sp (user_id, name, high_school, city, state, grad_year, gpa_unweighted, gpa_weighted, gpa_scale, class_rank, class_size,
    intended_major, alt_majors, testing_status, planned_tests, grade_trend, sat_total, sat_rw, sat_math, sat_date, act_composite, act_english, act_math, act_reading, act_science, act_date, personal, onboarded, updated_at)
  values (uid, p->>'name', p->>'highSchool', p->>'city', p->>'state', (p->>'gradYear')::int, (p->>'gpaUnweighted')::numeric, (p->>'gpaWeighted')::numeric, p->>'gpaScale',
    (p->>'classRank')::int, (p->>'classSize')::int, p->>'intendedMajor', coalesce(array(select jsonb_array_elements_text(p->'altMajors')), '{}'), p->>'testingStatus', p->>'plannedTests', nullif(p->>'trend', ''),
    (p->'sat'->>'total')::int, (p->'sat'->>'rw')::int, (p->'sat'->>'math')::int, nullif(p->'sat'->>'date', '')::date,
    (p->'act'->>'composite')::int, (p->'act'->>'english')::int, (p->'act'->>'math')::int, (p->'act'->>'reading')::int, (p->'act'->>'science')::int, nullif(p->'act'->>'date', '')::date,
    coalesce(per, '{}'), coalesce((payload->'meta'->>'onboarded')::boolean, false), now())
  on conflict (user_id) do update set name = excluded.name, high_school = excluded.high_school, city = excluded.city, state = excluded.state, grad_year = excluded.grad_year,
    gpa_unweighted = excluded.gpa_unweighted, gpa_weighted = excluded.gpa_weighted, gpa_scale = excluded.gpa_scale, class_rank = excluded.class_rank, class_size = excluded.class_size,
    intended_major = excluded.intended_major, alt_majors = excluded.alt_majors, testing_status = excluded.testing_status, planned_tests = excluded.planned_tests, grade_trend = excluded.grade_trend,
    sat_total = excluded.sat_total, sat_rw = excluded.sat_rw, sat_math = excluded.sat_math, sat_date = excluded.sat_date, act_composite = excluded.act_composite, act_english = excluded.act_english,
    act_math = excluded.act_math, act_reading = excluded.act_reading, act_science = excluded.act_science, act_date = excluded.act_date, personal = excluded.personal, onboarded = excluded.onboarded, updated_at = now();

  insert into financial_profiles (user_id, share_with_ai, income_bracket, max_annual_cost, expected_contribution, aid_priority, merit_preference, loan_willingness, notes, updated_at)
  values (uid, coalesce((f->>'shareFinancials')::boolean, false), f->>'incomeBracket', (f->>'maxAnnualCost')::numeric, (f->>'expectedContribution')::numeric, f->>'aidPriority', (f->>'meritPreference')::boolean, f->>'loanWillingness', f->>'notes', now())
  on conflict (user_id) do update set share_with_ai = excluded.share_with_ai, income_bracket = excluded.income_bracket, max_annual_cost = excluded.max_annual_cost, expected_contribution = excluded.expected_contribution,
    aid_priority = excluded.aid_priority, merit_preference = excluded.merit_preference, loan_willingness = excluded.loan_willingness, notes = excluded.notes, updated_at = now();

  insert into user_preferences (user_id, theme, reduce_motion, essay_mode) values (uid, coalesce(payload->'prefs'->>'theme', 'system'), coalesce((payload->'prefs'->>'reduceMotion')::boolean, false), payload->'prefs'->>'essayMode')
  on conflict (user_id) do update set theme = excluded.theme, reduce_motion = excluded.reduce_motion, essay_mode = excluded.essay_mode;

  -- Collections: replace the user's rows atomically (the whole function runs in one transaction).
  delete from academic_records where user_id = uid;
  insert into academic_records (id, user_id, name, year, term, level, subject, grade, credits)
    select r->>'id', uid, r->>'name', (r->>'year')::int, r->>'term', r->>'level', r->>'subject', r->>'grade', (r->>'credits')::numeric from jsonb_array_elements(coalesce(payload->'courses', '[]')) r;
  delete from awards where user_id = uid;
  insert into awards (id, user_id, title, level, grades)
    select r->>'id', uid, r->>'title', r->>'level', array(select jsonb_array_elements_text(r->'grades'))::int[] from jsonb_array_elements(coalesce(p->'awards', '[]')) r;
  delete from activities where user_id = uid;
  for x in select * from jsonb_array_elements(coalesce(payload->'activities', '[]')) loop
    insert into activities (id, user_id, sort_order, category, organization, position, description, grades, hours_per_week, weeks_per_year, achievements, awards, leadership, impact, people_reached, significance, skills, common_app_description)
    values (x->>'id', uid, i, x->>'category', x->>'org', x->>'position', x->>'description', array(select jsonb_array_elements_text(x->'grades'))::int[], (x->>'hrsWeek')::numeric, (x->>'wksYear')::numeric,
      x->>'achievements', x->>'awards', x->>'leadership', x->>'impact', (x->>'reach')::int, x->>'significance', x->>'skills', nullif(x->>'draft', ''));
    i := i + 1;
  end loop;
  delete from college_lists where user_id = uid;
  insert into college_lists (user_id, college_id, category, favorite, notes, added_at)
    select uid, r->>'collegeId', r->>'category', coalesce((r->>'favorite')::boolean, false), r->>'notes', coalesce((r->>'addedAt')::timestamptz, now())
    from jsonb_array_elements(coalesce(payload->'list', '[]')) r where exists (select 1 from colleges c where c.id = r->>'collegeId');
  delete from list_categories where user_id = uid;
  insert into list_categories (user_id, name) select distinct uid, v from jsonb_array_elements_text(coalesce(payload->'customCategories', '[]')) v;
  insert into comparisons (user_id, college_ids, updated_at) values (uid, array(select jsonb_array_elements_text(coalesce(payload->'compare', '[]'))), now())
    on conflict (user_id) do update set college_ids = excluded.college_ids, updated_at = now();
  delete from essays where user_id = uid; -- cascades to revisions & feedback
  for x in select * from jsonb_array_elements(coalesce(payload->'essays', '[]')) loop
    insert into essays (id, user_id, title, type, prompt, word_limit, college_id, working_text, updated_at)
    values (x->>'id', uid, x->>'title', x->>'type', x->>'prompt', (x->>'limit')::int, nullif(x->>'collegeId', ''), coalesce(x->>'working', ''), coalesce((x->>'updatedAt')::timestamptz, now()));
    insert into essay_revisions (id, essay_id, user_id, label, body, scores, created_at)
      select d->>'id', x->>'id', uid, d->>'label', d->>'text', d->'scores', (d->>'createdAt')::timestamptz from jsonb_array_elements(coalesce(x->'drafts', '[]')) d;
    insert into essay_feedback (id, essay_id, user_id, kind, quote, body, created_at)
      select cm->>'id', x->>'id', uid, 'comment', cm->>'quote', jsonb_build_object('text', cm->>'text'), (cm->>'at')::timestamptz from jsonb_array_elements(coalesce(x->'comments', '[]')) cm;
  end loop;
  delete from applications where user_id = uid;
  insert into applications (id, user_id, college_id, round, deadline, status, items, submitted_on, decision_date, result, notes)
    select r->>'id', uid, r->>'collegeId', r->>'round', nullif(r->>'deadline', '')::date, (r->>'status')::app_status, coalesce(r->'items', '{}'), nullif(r->>'submitted', '')::date, nullif(r->>'decisionDate', '')::date, r->>'result', r->>'notes'
    from jsonb_array_elements(coalesce(payload->'apps', '[]')) r where exists (select 1 from colleges c where c.id = r->>'collegeId');
  delete from tasks where user_id = uid;
  insert into tasks (id, user_id, title, due, done, priority, college_id, reminder)
    select r->>'id', uid, r->>'title', nullif(r->>'due', '')::date, coalesce((r->>'done')::boolean, false), coalesce(r->>'priority', 'Medium'), nullif(r->>'collegeId', ''), coalesce((r->>'reminder')::boolean, false)
    from jsonb_array_elements(coalesce(payload->'tasks', '[]')) r;
  delete from saved_opportunities where user_id = uid;
  insert into saved_opportunities (id, user_id, scholarship_id) select 'sch-' || v, uid, v from jsonb_array_elements_text(coalesce(payload->'savedScholarships', '[]')) v where exists (select 1 from scholarships s where s.id = v);
  insert into saved_opportunities (id, user_id, custom) select r->>'id', uid, r from jsonb_array_elements(coalesce(payload->'customScholarships', '[]')) r;
  delete from saved_searches where user_id = uid;
  insert into saved_searches (id, user_id, name, filters) select r->>'id', uid, r->>'name', coalesce(r->'filters', '{}') from jsonb_array_elements(coalesce(payload->'savedSearches', '[]')) r;
  return jsonb_build_object('ok', true, 'synced_at', now());
end $$;

-- ---------- RPC: rebuild the client state document ----------
create or replace function load_state() returns jsonb
language sql stable security invoker set search_path = public as $$
  select case when sp.user_id is null then null else jsonb_build_object(
    'version', 1,
    'meta', jsonb_build_object('demo', false, 'onboarded', sp.onboarded, 'createdAt', sp.updated_at, 'lastSaved', sp.updated_at),
    'profile', jsonb_build_object('name', coalesce(sp.name, ''), 'highSchool', coalesce(sp.high_school, ''), 'city', coalesce(sp.city, ''), 'state', coalesce(sp.state, ''), 'gradYear', sp.grad_year,
      'gpaUnweighted', sp.gpa_unweighted, 'gpaWeighted', sp.gpa_weighted, 'gpaScale', coalesce(sp.gpa_scale, '4.0'), 'classRank', sp.class_rank, 'classSize', sp.class_size,
      'intendedMajor', coalesce(sp.intended_major, ''), 'altMajors', to_jsonb(sp.alt_majors), 'testingStatus', coalesce(sp.testing_status, 'Not yet tested'), 'plannedTests', coalesce(sp.planned_tests, ''), 'trend', coalesce(sp.grade_trend, ''),
      'sat', jsonb_build_object('total', sp.sat_total, 'rw', sp.sat_rw, 'math', sp.sat_math, 'date', coalesce(sp.sat_date::text, '')),
      'act', jsonb_build_object('composite', sp.act_composite, 'english', sp.act_english, 'math', sp.act_math, 'reading', sp.act_reading, 'science', sp.act_science, 'date', coalesce(sp.act_date::text, '')),
      'awards', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title, 'level', a.level, 'grades', to_jsonb(a.grades))) from awards a where a.user_id = sp.user_id), '[]')),
    'personal', sp.personal,
    'financial', (select jsonb_build_object('shareFinancials', f.share_with_ai, 'incomeBracket', f.income_bracket, 'maxAnnualCost', f.max_annual_cost, 'expectedContribution', f.expected_contribution, 'aidPriority', f.aid_priority, 'meritPreference', f.merit_preference, 'loanWillingness', f.loan_willingness, 'notes', coalesce(f.notes, '')) from financial_profiles f where f.user_id = sp.user_id),
    'courses', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'year', r.year, 'term', r.term, 'level', r.level, 'subject', r.subject, 'grade', r.grade, 'credits', r.credits)) from academic_records r where r.user_id = sp.user_id), '[]'),
    'activities', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'category', a.category, 'org', a.organization, 'position', coalesce(a.position, ''), 'description', coalesce(a.description, ''), 'grades', to_jsonb(a.grades), 'hrsWeek', a.hours_per_week, 'wksYear', a.weeks_per_year,
      'achievements', coalesce(a.achievements, ''), 'awards', coalesce(a.awards, ''), 'leadership', coalesce(a.leadership, ''), 'impact', coalesce(a.impact, ''), 'reach', a.people_reached, 'significance', coalesce(a.significance, ''), 'skills', coalesce(a.skills, ''), 'draft', coalesce(a.common_app_description, '')) order by a.sort_order) from activities a where a.user_id = sp.user_id), '[]'),
    'list', coalesce((select jsonb_agg(jsonb_build_object('collegeId', l.college_id, 'category', l.category, 'favorite', l.favorite, 'notes', coalesce(l.notes, ''), 'addedAt', l.added_at)) from college_lists l where l.user_id = sp.user_id), '[]'),
    'customCategories', coalesce((select jsonb_agg(c.name) from list_categories c where c.user_id = sp.user_id), '[]'),
    'compare', coalesce((select to_jsonb(c.college_ids) from comparisons c where c.user_id = sp.user_id), '[]'),
    'apps', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'collegeId', a.college_id, 'round', a.round, 'deadline', coalesce(a.deadline::text, ''), 'status', a.status, 'items', a.items, 'submitted', coalesce(a.submitted_on::text, ''), 'decisionDate', coalesce(a.decision_date::text, ''), 'result', coalesce(a.result, ''), 'notes', coalesce(a.notes, ''))) from applications a where a.user_id = sp.user_id), '[]'),
    'tasks', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'due', coalesce(t.due::text, ''), 'done', t.done, 'priority', t.priority, 'collegeId', coalesce(t.college_id, ''), 'reminder', t.reminder)) from tasks t where t.user_id = sp.user_id), '[]'),
    'essays', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'title', e.title, 'type', e.type, 'prompt', coalesce(e.prompt, ''), 'limit', e.word_limit, 'collegeId', coalesce(e.college_id, ''), 'working', e.working_text, 'updatedAt', e.updated_at,
      'drafts', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'label', r.label, 'text', r.body, 'createdAt', r.created_at, 'scores', r.scores) order by r.created_at) from essay_revisions r where r.essay_id = e.id), '[]'),
      'comments', coalesce((select jsonb_agg(jsonb_build_object('id', fb.id, 'quote', coalesce(fb.quote, ''), 'text', fb.body->>'text', 'at', fb.created_at)) from essay_feedback fb where fb.essay_id = e.id and fb.kind = 'comment'), '[]'))) from essays e where e.user_id = sp.user_id), '[]'),
    'savedSearches', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'filters', s.filters)) from saved_searches s where s.user_id = sp.user_id), '[]'),
    'savedScholarships', coalesce((select jsonb_agg(o.scholarship_id) from saved_opportunities o where o.user_id = sp.user_id and o.scholarship_id is not null), '[]'),
    'customScholarships', coalesce((select jsonb_agg(o.custom) from saved_opportunities o where o.user_id = sp.user_id and o.custom is not null), '[]'),
    'experiences', '[]'::jsonb,
    'prefs', (select jsonb_build_object('theme', u.theme, 'reduceMotion', u.reduce_motion, 'essayMode', coalesce(u.essay_mode, 'Deep critique')) from user_preferences u where u.user_id = sp.user_id)
  ) end
  from (select auth.uid() as uid) me left join student_profiles sp on sp.user_id = me.uid;
$$;

-- ---------- RPC: delete everything the caller owns ----------
create or replace function delete_my_data() returns jsonb
language plpgsql security invoker set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  delete from essays where user_id = uid;
  delete from academic_records where user_id = uid; delete from awards where user_id = uid; delete from activities where user_id = uid;
  delete from college_lists where user_id = uid; delete from list_categories where user_id = uid; delete from comparisons where user_id = uid;
  delete from applications where user_id = uid; delete from tasks where user_id = uid; delete from saved_opportunities where user_id = uid;
  delete from saved_searches where user_id = uid; delete from user_preferences where user_id = uid;
  delete from financial_profiles where user_id = uid; delete from student_profiles where user_id = uid;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function sync_state(jsonb), load_state(), delete_my_data() from public, anon;
grant execute on function sync_state(jsonb), load_state(), delete_my_data() to authenticated;

-- ---------- privileges (Supabase grants most of these by default; explicit for portability) ----------
grant usage on schema public to anon, authenticated;
grant select on colleges, college_statistics, college_sources, college_programs, deadlines, scholarships, experience_summary to anon, authenticated;
grant select, insert, update, delete on student_profiles, financial_profiles, academic_records, awards, activities, college_lists, list_categories, comparisons,
  essays, essay_revisions, essay_feedback, applications, tasks, saved_opportunities, saved_searches, user_preferences to authenticated;
grant select, insert on student_experience_submissions to authenticated;
grant select on student_experience_submissions to anon;

-- ---------- RPC: delete the caller's login and all their data ----------
-- SECURITY DEFINER is required to remove a row from auth.users; it only ever targets auth.uid().
-- All student tables reference auth.users with ON DELETE CASCADE.
create or replace function delete_my_account() returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  delete from auth.users where id = uid;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function delete_my_account() from public, anon;
grant execute on function delete_my_account() to authenticated;
