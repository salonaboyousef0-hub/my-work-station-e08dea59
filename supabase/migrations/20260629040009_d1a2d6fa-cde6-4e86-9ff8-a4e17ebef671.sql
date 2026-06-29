
-- Enum types
CREATE TYPE public.transaction_type AS ENUM ('earning','advance','deduction','payment');
CREATE TYPE public.request_type AS ENUM ('advance','leave','other');
CREATE TYPE public.request_status AS ENUM ('pending','approved','rejected');
CREATE TYPE public.notification_type AS ENUM ('request','transaction','announcement','system');

-- Employee profiles (1-to-1 with auth.users)
CREATE TABLE public.employee_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_code TEXT UNIQUE NOT NULL DEFAULT ('EMP-' || lpad((floor(random()*100000))::text,5,'0')),
  full_name TEXT NOT NULL DEFAULT 'موظف',
  phone TEXT,
  job_title TEXT DEFAULT 'موظف',
  avatar_url TEXT,
  hire_date DATE DEFAULT CURRENT_DATE,
  balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.employee_profiles TO authenticated;
GRANT ALL ON public.employee_profiles TO service_role;
ALTER TABLE public.employee_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employee reads own profile" ON public.employee_profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Employee updates own profile" ON public.employee_profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Attendance
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employee_profiles(id) ON DELETE CASCADE,
  work_date DATE NOT NULL DEFAULT CURRENT_DATE,
  check_in TIMESTAMPTZ NOT NULL DEFAULT now(),
  check_out TIMESTAMPTZ,
  check_in_lat DOUBLE PRECISION,
  check_in_lng DOUBLE PRECISION,
  check_out_lat DOUBLE PRECISION,
  check_out_lng DOUBLE PRECISION,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, work_date)
);

GRANT SELECT, INSERT, UPDATE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employee reads own attendance" ON public.attendance
  FOR SELECT TO authenticated USING (auth.uid() = employee_id);
CREATE POLICY "Employee inserts own attendance" ON public.attendance
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = employee_id);
CREATE POLICY "Employee updates own attendance" ON public.attendance
  FOR UPDATE TO authenticated USING (auth.uid() = employee_id) WITH CHECK (auth.uid() = employee_id);

-- Financial transactions (managed by admin in another app; employee read-only)
CREATE TABLE public.employee_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employee_profiles(id) ON DELETE CASCADE,
  type public.transaction_type NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  notes TEXT,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.employee_transactions TO authenticated;
GRANT ALL ON public.employee_transactions TO service_role;
ALTER TABLE public.employee_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employee reads own transactions" ON public.employee_transactions
  FOR SELECT TO authenticated USING (auth.uid() = employee_id);

-- Performance: services performed by employee (admin writes; employee reads)
CREATE TABLE public.employee_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employee_profiles(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  client_count INTEGER NOT NULL DEFAULT 1,
  service_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  service_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.employee_services TO authenticated;
GRANT ALL ON public.employee_services TO service_role;
ALTER TABLE public.employee_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employee reads own services" ON public.employee_services
  FOR SELECT TO authenticated USING (auth.uid() = employee_id);

-- Requests
CREATE TABLE public.employee_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employee_profiles(id) ON DELETE CASCADE,
  type public.request_type NOT NULL,
  amount NUMERIC(12,2),
  description TEXT,
  status public.request_status NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.employee_requests TO authenticated;
GRANT ALL ON public.employee_requests TO service_role;
ALTER TABLE public.employee_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employee reads own requests" ON public.employee_requests
  FOR SELECT TO authenticated USING (auth.uid() = employee_id);
CREATE POLICY "Employee inserts own requests" ON public.employee_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = employee_id AND status = 'pending' AND admin_notes IS NULL AND reviewed_at IS NULL);

-- Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employee_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  type public.notification_type NOT NULL DEFAULT 'system',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employee reads own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = employee_id);
CREATE POLICY "Employee updates own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = employee_id) WITH CHECK (auth.uid() = employee_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_profile_updated BEFORE UPDATE ON public.employee_profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_employee()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.employee_profiles (id, full_name, phone, job_title)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1), 'موظف'),
    COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone),
    COALESCE(NEW.raw_user_meta_data->>'job_title', 'موظف')
  );
  INSERT INTO public.notifications (employee_id, title, body, type)
  VALUES (NEW.id, 'مرحباً بك', 'تم إنشاء حسابك بنجاح. يمكنك الآن تسجيل الحضور ومتابعة حسابك.', 'system');
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_employee();

-- Indexes
CREATE INDEX idx_attendance_emp_date ON public.attendance(employee_id, work_date DESC);
CREATE INDEX idx_tx_emp_date ON public.employee_transactions(employee_id, transaction_date DESC);
CREATE INDEX idx_services_emp_date ON public.employee_services(employee_id, service_date DESC);
CREATE INDEX idx_requests_emp ON public.employee_requests(employee_id, created_at DESC);
CREATE INDEX idx_notif_emp ON public.notifications(employee_id, created_at DESC);
