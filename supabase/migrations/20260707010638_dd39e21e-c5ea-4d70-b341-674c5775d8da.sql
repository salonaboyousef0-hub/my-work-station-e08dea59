
REVOKE ALL ON FUNCTION public.recalculate_employee_balance(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_employee_transactions_balance() FROM PUBLIC, anon, authenticated;
