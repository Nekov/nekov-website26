-- Run once in the Supabase SQL editor. All writes go through the server with the service role key.
-- RLS is on and there are NO policies for anon/authenticated, so the browser can never read or write these tables.
create extension if not exists pgcrypto;

create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  session_hash text unique not null,
  locale text,
  device_class text,
  utm jsonb default '{}'::jsonb,
  src text,
  referrer text,
  stage text,
  work text,
  profile text,
  answers jsonb not null default '{}'::jsonb,
  step_key text,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  contact_name text,
  contact_email text,
  contact_phone text,
  contact_channel text,
  contact_link text,
  consent_contact_at timestamptz,
  consent_marketing_at timestamptz,
  score_points int,
  score_breakdown jsonb,
  tier text,
  readiness int,
  flags text[] default '{}',
  status text not null default 'new' check (status in ('new','contacted','call_booked','client','declined','nurture')),
  notes text,
  environment text not null default 'staging'
);

create table if not exists events (
  id bigint generated always as identity primary key,
  session_hash text not null,
  type text not null check (type in ('view','start','step_view','step_complete','step_back','card_view','abandon','submit','result_view','cta_click')),
  step_key text,
  ts timestamptz not null default now(),
  meta jsonb default '{}'::jsonb,   -- never personal data
  environment text not null default 'staging'
);

create index if not exists applications_submitted on applications (submitted_at) where submitted_at is not null;
create index if not exists applications_tier on applications (tier);
create index if not exists events_session on events (session_hash, ts);

alter table applications enable row level security;
alter table events enable row level security;
-- Intentionally no policies.
