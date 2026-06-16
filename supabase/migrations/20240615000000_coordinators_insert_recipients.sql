-- Allow coordinators to submit pending recipient intake on behalf of others.

create policy "coordinators_insert_pending_recipients"
  on public.recipients
  for insert
  to authenticated
  with check (
    status = 'pending'
    and public.is_coordinator()
  );
