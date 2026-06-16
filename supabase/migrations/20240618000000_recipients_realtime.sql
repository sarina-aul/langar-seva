-- Enable Realtime on recipients for live coordinator pending queue updates.

alter publication supabase_realtime add table public.recipients;
