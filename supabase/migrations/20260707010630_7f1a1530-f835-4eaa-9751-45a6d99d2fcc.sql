
CREATE OR REPLACE FUNCTION public.recalculate_employee_balance(p_employee_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric;
BEGIN
  IF p_employee_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(CASE WHEN type = 'earning' THEN amount ELSE 0 END), 0)
       - COALESCE(SUM(CASE WHEN type IN ('advance', 'deduction', 'payment') THEN amount ELSE 0 END), 0)
    INTO v_balance
    FROM public.employee_transactions
   WHERE employee_id = p_employee_id;

  UPDATE public.employee_profiles
     SET balance = v_balance
   WHERE id = p_employee_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_employee_transactions_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    PERFORM public.recalculate_employee_balance(OLD.employee_id);
    RETURN OLD;
  ELSIF (TG_OP = 'INSERT') THEN
    PERFORM public.recalculate_employee_balance(NEW.employee_id);
    RETURN NEW;
  ELSE
    PERFORM public.recalculate_employee_balance(NEW.employee_id);
    IF OLD.employee_id IS DISTINCT FROM NEW.employee_id THEN
      PERFORM public.recalculate_employee_balance(OLD.employee_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS employee_transactions_balance_trg ON public.employee_transactions;

CREATE TRIGGER employee_transactions_balance_trg
AFTER INSERT OR UPDATE OR DELETE ON public.employee_transactions
FOR EACH ROW EXECUTE FUNCTION public.trg_employee_transactions_balance();

-- One-time backfill
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.employee_profiles LOOP
    PERFORM public.recalculate_employee_balance(r.id);
  END LOOP;
END;
$$;
