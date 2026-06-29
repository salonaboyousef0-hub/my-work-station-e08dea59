
-- ============ 1. ROLES ============
CREATE TYPE public.app_role AS ENUM ('admin','manager','employee');

CREATE TABLE public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','manager'))
$$;

-- Update signup trigger to also grant 'employee' role
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
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'employee')
    ON CONFLICT DO NOTHING;
  INSERT INTO public.notifications (employee_id, title, body, type)
  VALUES (NEW.id, 'مرحباً بك', 'تم إنشاء حسابك بنجاح. يمكنك الآن تسجيل الحضور ومتابعة حسابك.', 'system');
  RETURN NEW;
END $$;

-- Backfill existing users with employee role
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'employee'::public.app_role FROM public.employee_profiles
ON CONFLICT DO NOTHING;

-- ============ 2. SHIFTS ============
CREATE TABLE public.shifts (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employee_profiles(id) on delete cascade,
  shift_date date not null,
  start_time time,
  end_time time,
  is_day_off boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  unique(employee_id, shift_date)
);
GRANT SELECT ON public.shifts TO authenticated;
GRANT ALL ON public.shifts TO service_role;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "emp reads own shifts" ON public.shifts
  FOR SELECT TO authenticated USING (auth.uid() = employee_id OR public.is_staff(auth.uid()));
CREATE POLICY "staff manages shifts" ON public.shifts
  FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE INDEX idx_shifts_emp_date ON public.shifts(employee_id, shift_date DESC);

-- ============ 3. LEAVE REQUESTS ============
CREATE TYPE public.leave_type AS ENUM ('vacation','sick','personal','other');

CREATE TABLE public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employee_profiles(id) on delete cascade,
  leave_type public.leave_type not null,
  start_date date not null,
  end_date date not null,
  reason text,
  status public.request_status not null default 'pending',
  admin_notes text,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  CHECK (end_date >= start_date)
);
GRANT SELECT, INSERT, UPDATE ON public.leave_requests TO authenticated;
GRANT ALL ON public.leave_requests TO service_role;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "emp reads own leave" ON public.leave_requests
  FOR SELECT TO authenticated USING (auth.uid() = employee_id OR public.is_staff(auth.uid()));
CREATE POLICY "emp inserts own leave" ON public.leave_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = employee_id AND status='pending' AND admin_notes IS NULL AND reviewed_at IS NULL);
CREATE POLICY "staff updates leave" ON public.leave_requests
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE INDEX idx_leave_emp ON public.leave_requests(employee_id, created_at DESC);

-- ============ 4. GENERAL REQUESTS ============
CREATE TABLE public.general_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employee_profiles(id) on delete cascade,
  request_type text not null CHECK (request_type IN ('shift_change','tools','complaint','suggestion','other')),
  title text not null,
  details text,
  status public.request_status not null default 'pending',
  admin_notes text,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE ON public.general_requests TO authenticated;
GRANT ALL ON public.general_requests TO service_role;
ALTER TABLE public.general_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "emp reads own gr" ON public.general_requests
  FOR SELECT TO authenticated USING (auth.uid() = employee_id OR public.is_staff(auth.uid()));
CREATE POLICY "emp inserts own gr" ON public.general_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = employee_id AND status='pending' AND admin_notes IS NULL AND reviewed_at IS NULL);
CREATE POLICY "staff updates gr" ON public.general_requests
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE INDEX idx_gr_emp ON public.general_requests(employee_id, created_at DESC);

-- ============ 5. EVALUATIONS ============
CREATE TABLE public.evaluations (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employee_profiles(id) on delete cascade,
  evaluator_id uuid references auth.users(id),
  period_month date not null,
  commitment smallint not null CHECK (commitment BETWEEN 1 AND 5),
  quality smallint not null CHECK (quality BETWEEN 1 AND 5),
  attitude smallint not null CHECK (attitude BETWEEN 1 AND 5),
  hygiene smallint not null CHECK (hygiene BETWEEN 1 AND 5),
  customer_satisfaction smallint not null CHECK (customer_satisfaction BETWEEN 1 AND 5),
  notes text,
  created_at timestamptz not null default now()
);
GRANT SELECT ON public.evaluations TO authenticated;
GRANT ALL ON public.evaluations TO service_role;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "emp reads own eval" ON public.evaluations
  FOR SELECT TO authenticated USING (auth.uid() = employee_id OR public.is_staff(auth.uid()));
CREATE POLICY "staff manages eval" ON public.evaluations
  FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE INDEX idx_eval_emp ON public.evaluations(employee_id, period_month DESC);

-- ============ 6. GOALS ============
CREATE TABLE public.goals (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employee_profiles(id) on delete cascade,
  period_month date not null,
  target_services int not null default 0,
  target_value numeric(12,2) not null default 0,
  bonus_amount numeric(12,2) not null default 0,
  description text,
  created_at timestamptz not null default now(),
  unique(employee_id, period_month)
);
GRANT SELECT ON public.goals TO authenticated;
GRANT ALL ON public.goals TO service_role;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "emp reads own goals" ON public.goals
  FOR SELECT TO authenticated USING (auth.uid() = employee_id OR public.is_staff(auth.uid()));
CREATE POLICY "staff manages goals" ON public.goals
  FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- ============ 7. ANNOUNCEMENTS ============
CREATE TABLE public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  category text not null default 'general' CHECK (category IN ('general','news','instruction','alert')),
  published_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
GRANT SELECT ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all read announcements" ON public.announcements
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff manages announcements" ON public.announcements
  FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE INDEX idx_announcements_pub ON public.announcements(published_at DESC);

-- ============ 8. TRAINING ============
CREATE TABLE public.training_materials (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  media_type text not null default 'video' CHECK (media_type IN ('video','pdf','text','link')),
  media_url text,
  content text,
  is_required boolean not null default false,
  created_at timestamptz not null default now()
);
GRANT SELECT ON public.training_materials TO authenticated;
GRANT ALL ON public.training_materials TO service_role;
ALTER TABLE public.training_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all read training" ON public.training_materials
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff manages training" ON public.training_materials
  FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.training_progress (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employee_profiles(id) on delete cascade,
  material_id uuid not null references public.training_materials(id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique(employee_id, material_id)
);
GRANT SELECT, INSERT, DELETE ON public.training_progress TO authenticated;
GRANT ALL ON public.training_progress TO service_role;
ALTER TABLE public.training_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "emp manages own progress" ON public.training_progress
  FOR ALL TO authenticated USING (auth.uid() = employee_id) WITH CHECK (auth.uid() = employee_id);

-- ============ 9. ASSETS ============
CREATE TABLE public.employee_assets (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employee_profiles(id) on delete cascade,
  asset_name text not null,
  serial_number text,
  received_date date not null default current_date,
  returned_date date,
  condition text not null default 'good' CHECK (condition IN ('new','good','fair','damaged','lost')),
  notes text,
  created_at timestamptz not null default now()
);
GRANT SELECT ON public.employee_assets TO authenticated;
GRANT ALL ON public.employee_assets TO service_role;
ALTER TABLE public.employee_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "emp reads own assets" ON public.employee_assets
  FOR SELECT TO authenticated USING (auth.uid() = employee_id OR public.is_staff(auth.uid()));
CREATE POLICY "staff manages assets" ON public.employee_assets
  FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- ============ 10. EXTEND employee_services for employee submissions ============
ALTER TABLE public.employee_services
  ADD COLUMN IF NOT EXISTS status public.request_status NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS submitted_by_employee boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_notes text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

GRANT INSERT, UPDATE ON public.employee_services TO authenticated;
CREATE POLICY "emp inserts own service submission" ON public.employee_services
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = employee_id AND status = 'pending' AND submitted_by_employee = true);
CREATE POLICY "staff manages services" ON public.employee_services
  FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- ============ 11. STAFF policies on existing tables ============
CREATE POLICY "staff reads all profiles" ON public.employee_profiles
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff updates all profiles" ON public.employee_profiles
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "staff reads all attendance" ON public.attendance
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE POLICY "staff manages transactions" ON public.employee_transactions
  FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
GRANT INSERT, UPDATE, DELETE ON public.employee_transactions TO authenticated;

CREATE POLICY "staff reads all requests" ON public.employee_requests
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff updates requests" ON public.employee_requests
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
GRANT UPDATE ON public.employee_requests TO authenticated;

CREATE POLICY "staff inserts notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "staff reads all notifications" ON public.notifications
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
GRANT INSERT ON public.notifications TO authenticated;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;
