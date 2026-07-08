
-- 1. Switch has_role / is_staff to SECURITY INVOKER (they only need to read the caller's own roles)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','manager'))
$$;

-- Keep EXECUTE for authenticated so RLS policies that call them keep working
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;

-- 2. Revoke EXECUTE from anon/authenticated on trigger-only SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.handle_new_employee() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_default_admin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recalculate_employee_balance(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_employee_transactions_balance() FROM PUBLIC, anon, authenticated;

-- 3. Restrict attendance_qr_tokens: remove the broad employee read policy
DROP POLICY IF EXISTS "Employees read active qr tokens" ON public.attendance_qr_tokens;

-- Add a SECURITY DEFINER validator that only returns the id/expiry of a scanned token if it's active
CREATE OR REPLACE FUNCTION public.validate_qr_token(p_token text)
RETURNS TABLE(id uuid, expires_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.expires_at
    FROM public.attendance_qr_tokens t
   WHERE t.token = p_token
     AND t.is_active = true
     AND (t.expires_at IS NULL OR t.expires_at > now())
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.validate_qr_token(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_qr_token(text) TO authenticated;
