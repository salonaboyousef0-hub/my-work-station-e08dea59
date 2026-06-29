
-- Activity log
CREATE TABLE public.activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff reads activity log" ON public.activity_log
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff inserts activity log" ON public.activity_log
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()) AND auth.uid() = actor_id);
CREATE INDEX idx_activity_log_created ON public.activity_log(created_at DESC);

-- Staff can assign/revoke roles
CREATE POLICY "staff reads all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff inserts roles" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "staff deletes roles" ON public.user_roles
  FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));
GRANT INSERT, DELETE ON public.user_roles TO authenticated;

-- Staff fully manages announcements/training/leave/goals via existing policies (already covered).
-- Add DELETE grants for tables staff manages
GRANT DELETE ON public.shifts TO authenticated;
GRANT DELETE ON public.announcements TO authenticated;
GRANT DELETE ON public.training_materials TO authenticated;
GRANT DELETE ON public.goals TO authenticated;
GRANT DELETE ON public.evaluations TO authenticated;
GRANT DELETE ON public.employee_assets TO authenticated;
