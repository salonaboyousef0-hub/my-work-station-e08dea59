
CREATE TABLE public.attendance_qr_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  token text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_qr_tokens TO authenticated;
GRANT ALL ON public.attendance_qr_tokens TO service_role;

ALTER TABLE public.attendance_qr_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees read active qr tokens"
  ON public.attendance_qr_tokens
  FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Staff manage qr tokens insert"
  ON public.attendance_qr_tokens
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff manage qr tokens update"
  ON public.attendance_qr_tokens
  FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff manage qr tokens delete"
  ON public.attendance_qr_tokens
  FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE TRIGGER attendance_qr_tokens_set_updated_at
  BEFORE UPDATE ON public.attendance_qr_tokens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- add source column to attendance to indicate QR scans
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS check_in_source text,
  ADD COLUMN IF NOT EXISTS check_out_source text,
  ADD COLUMN IF NOT EXISTS qr_token_id uuid REFERENCES public.attendance_qr_tokens(id) ON DELETE SET NULL;

-- seed one default active token so admins have something to display
INSERT INTO public.attendance_qr_tokens (label, token, is_active)
VALUES ('الفرع الرئيسي', encode(gen_random_bytes(18), 'base64'), true)
ON CONFLICT DO NOTHING;
