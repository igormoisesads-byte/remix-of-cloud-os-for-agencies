-- Create task_status_history table
create table public.task_status_history (
    id uuid primary key default gen_random_uuid(),
    task_id uuid references public.tasks(id) on delete cascade not null,
    user_id uuid references auth.users(id) on delete set null,
    from_status text,
    to_status text not null,
    created_at timestamp with time zone default now()
);

-- Grants
grant select, insert on public.task_status_history to authenticated;
grant all on public.task_status_history to service_role;

-- RLS
alter table public.task_status_history enable row level security;
create policy "Users can see all task history" on public.task_status_history for select to authenticated using (true);
create policy "Users can insert their own history" on public.task_status_history for insert to authenticated with check (auth.uid() = user_id);

-- Trigger function
create or replace function public.record_task_status_change()
returns trigger language plpgsql security definer as $$
begin
    if (tg_op = 'INSERT') then
        insert into public.task_status_history (task_id, user_id, from_status, to_status)
        values (new.id, auth.uid(), null, new.status);
    elsif (tg_op = 'UPDATE' and old.status is distinct from new.status) then
        insert into public.task_status_history (task_id, user_id, from_status, to_status)
        values (new.id, auth.uid(), old.status, new.status);
    end if;
    return new;
end;
$$;

-- Create trigger
create trigger tg_task_status_history after insert or update on public.tasks
for each row execute function public.record_task_status_change();

-- Seed history for existing tasks
-- Insert initial 'todo' status at created_at
insert into public.task_status_history (task_id, user_id, from_status, to_status, created_at)
select id, created_by, null, 'todo', created_at
from public.tasks;

-- Insert 'done' status if task is already done
insert into public.task_status_history (task_id, user_id, from_status, to_status, created_at)
select id, assignee_id, 'doing', 'done', done_at
from public.tasks
where done_at is not null and status = 'done';
