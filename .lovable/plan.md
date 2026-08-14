# Plan: Task Productivity and Time Tracking for Admins

Implement a time tracking system for tasks to analyze employee performance, including time spent in each status (To Do, Doing, Review, Done).

## Database Changes

1.  Create `task_status_history` table to track status transitions.
    ```sql
    create table public.task_status_history (
        id uuid primary key default gen_random_uuid(),
        task_id uuid references public.tasks(id) on delete cascade not null,
        user_id uuid references auth.users(id) on delete set null,
        from_status text,
        to_status text not null,
        created_at timestamp with time zone default now()
    );
    grant select, insert on public.task_status_history to authenticated;
    grant all on public.task_status_history to service_role;
    alter table public.task_status_history enable row level security;
    create policy "Users can see all task history" on public.task_status_history for select to authenticated using (true);
    create policy "Users can insert their own history" on public.task_status_history for insert to authenticated with check (auth.uid() = user_id);
    ```

2.  Add a trigger on `tasks` to automatically record status changes.
    ```sql
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
    create trigger tg_task_status_history after insert or update on public.tasks
    for each row execute function public.record_task_status_change();
    ```

3.  Seed initial history for existing tasks using `created_at` and `done_at`.

## Frontend Changes

1.  **Operações Page (`src/routes/_authenticated/operacoes.tsx`)**:
    - Add "Produtividade" to `ViewMode`.
    - Add a toggle button for the new view.
    - Implement `ProductivityView` component showing:
        - **Date Range Filter**: Select period (last 7 days, 30 days, month).
        - **Employee Performance Table**: Member name, Tasks Completed, Avg Lead Time (To Do → Doing), Avg Execution Time (Doing → Done).
        - **Recent Tasks Breakdown**: List of tasks with time spent in each status.
    - Calculate times using the `task_status_history` data.

2.  **Navigation**:
    - Ensure the "Produtividade" view is restricted or primarily targeted at admins/managers.

## Technical Details

- Time calculations will be done in the frontend after fetching the history.
- "Lead Time to Start" = `created_at` of transition to 'doing' - `created_at` of task.
- "Execution Time" = `created_at` of transition to 'done' - `created_at` of transition to 'doing'.
- Fallback to `done_at` if history is missing for older tasks.
