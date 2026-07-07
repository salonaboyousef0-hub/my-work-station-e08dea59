
-- Integration settings (singleton row, admin-only)
CREATE TABLE public.integration_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cashier_url TEXT,
  cashier_publishable_key TEXT,
  stats_function_path TEXT NOT NULL DEFAULT '/functions/v1/employee-stats',
  enabled BOOLEAN NOT NULL DEFAULT false,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_settings TO authenticated;
GRANT ALL ON public.integration_settings TO service_role;

ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read integration settings"
  ON public.integration_settings FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can insert integration settings"
  ON public.integration_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update integration settings"
  ON public.integration_settings FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can delete integration settings"
  ON public.integration_settings FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE TRIGGER integration_settings_updated_at
  BEFORE UPDATE ON public.integration_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Cashier employee id mapping
ALTER TABLE public.employee_profiles
  ADD COLUMN IF NOT EXISTS cashier_employee_id TEXT;
