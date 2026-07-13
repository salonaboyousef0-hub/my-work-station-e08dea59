
CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employee_profiles(id) ON DELETE CASCADE,
  external_booking_id text,
  customer_id text,
  customer_name text,
  customer_phone text,
  service_id text,
  service_name text,
  price numeric(10,2),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  status text NOT NULL DEFAULT 'scheduled',
  notes text,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, external_booking_id)
);

CREATE INDEX bookings_employee_starts_idx ON public.bookings (employee_id, starts_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employees read own bookings" ON public.bookings
  FOR SELECT TO authenticated
  USING (employee_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE POLICY "staff manage bookings" ON public.bookings
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER bookings_set_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
