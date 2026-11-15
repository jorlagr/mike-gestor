create extension if not exists pgcrypto;

create table if not exists public.companies (
  id uuid primary key,
  name text not null unique
);

insert into public.companies (id, name) values
  ('00000000-0000-4000-8000-000000000001', 'Mike Moya'),
  ('00000000-0000-4000-8000-000000000002', 'Largueta')
on conflict (id) do nothing;

create table if not exists public.user_companies (
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  primary key (user_id, company_id)
);

create table if not exists public.movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  type text not null check (type in ('income', 'expense')),
  concept text not null check (length(trim(concept)) between 1 and 120),
  date date not null,
  amount numeric(12, 2) not null check (amount > 0),
  created_at timestamptz not null default now()
);

create index if not exists movements_company_date_idx on public.movements (company_id, date desc);

alter table public.companies enable row level security;
alter table public.user_companies enable row level security;
alter table public.movements enable row level security;

create policy "Users can view assigned companies"
  on public.companies for select to authenticated
  using (exists (
    select 1 from public.user_companies uc
    where uc.company_id = companies.id and uc.user_id = (select auth.uid())
  ));

create policy "Users can view their company assignments"
  on public.user_companies for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Assigned users can read company movements"
  on public.movements for select to authenticated
  using (exists (
    select 1 from public.user_companies uc
    where uc.company_id = movements.company_id and uc.user_id = (select auth.uid())
  ));

create policy "Assigned users can add company movements"
  on public.movements for insert to authenticated
  with check (exists (
    select 1 from public.user_companies uc
    where uc.company_id = movements.company_id and uc.user_id = (select auth.uid())
  ));

create policy "Assigned users can edit company movements"
  on public.movements for update to authenticated
  using (exists (
    select 1 from public.user_companies uc
    where uc.company_id = movements.company_id and uc.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.user_companies uc
    where uc.company_id = movements.company_id and uc.user_id = (select auth.uid())
  ));

create policy "Assigned users can delete company movements"
  on public.movements for delete to authenticated
  using (exists (
    select 1 from public.user_companies uc
    where uc.company_id = movements.company_id and uc.user_id = (select auth.uid())
  ));

grant select on public.companies, public.user_companies to authenticated;
grant select, insert, update, delete on public.movements to authenticated;
