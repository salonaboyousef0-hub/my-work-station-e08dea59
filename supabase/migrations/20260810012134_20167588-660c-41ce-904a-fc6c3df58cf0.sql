DROP POLICY IF EXISTS "Staff read qr tokens" ON public.attendance_qr_tokens;
CREATE POLICY "Staff read qr tokens" ON public.attendance_qr_tokens
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

REVOKE ALL ON public.attendance_qr_tokens FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_qr_tokens TO authenticated;
GRANT ALL ON public.attendance_qr_tokens TO service_role;

REVOKE ALL ON public.employee_transactions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_transactions TO authenticated;
GRANT ALL ON public.employee_transactions TO service_role;

DROP POLICY IF EXISTS "Only staff may write transactions" ON public.employee_transactions;
CREATE POLICY "Only staff may write transactions" ON public.employee_transactions
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()) OR auth.uid() = employee_id)
  WITH CHECK (public.is_staff(auth.uid()));

REVOKE ALL ON public.attendance FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;

REVOKE ALL ON FUNCTION public.validate_qr_token(text) FROM PUBLIC, anon, authenticated;
