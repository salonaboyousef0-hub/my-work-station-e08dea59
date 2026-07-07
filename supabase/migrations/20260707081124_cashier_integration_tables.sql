-- Cashier Integration Tables
-- Employee Mapping: Links staff hub employees to cashier employees
CREATE TABLE IF NOT EXISTS cashier_employee_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employee_profiles(id) ON DELETE CASCADE,
  cashier_employee_id TEXT NOT NULL,
  cashier_user_id TEXT,
  branch_id TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id),
  UNIQUE(cashier_employee_id)
);

-- Wallet Transactions from Cashier
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employee_profiles(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('attendance_reward', 'commission', 'salary', 'bonus', 'advance', 'deduction', 'withdrawal', 'refund', 'adjustment')),
  amount DECIMAL(12,2) NOT NULL,
  balance_after DECIMAL(12,2),
  reference_id TEXT,
  reference_type TEXT,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  cashier_synced BOOLEAN DEFAULT false,
  cashier_transaction_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  synced_at TIMESTAMPTZ
);

-- Sync Audit Log
CREATE TABLE IF NOT EXISTS sync_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('to_cashier', 'from_cashier')),
  employee_id UUID REFERENCES employee_profiles(id) ON DELETE SET NULL,
  payload JSONB,
  response JSONB,
  status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed')),
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Offline Queue for Attendance
CREATE TABLE IF NOT EXISTS offline_attendance_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employee_profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('check_in', 'check_out')),
  action_time TIMESTAMPTZ NOT NULL,
  branch_id TEXT,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  device_info TEXT,
  synced BOOLEAN DEFAULT false,
  sync_attempts INTEGER DEFAULT 0,
  last_sync_attempt TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add columns to integration_settings for extended settings
ALTER TABLE integration_settings 
ADD COLUMN IF NOT EXISTS attendance_function_path TEXT DEFAULT '/functions/v1/attendance-sync',
ADD COLUMN IF NOT EXISTS wallet_function_path TEXT DEFAULT '/functions/v1/wallet-sync',
ADD COLUMN IF NOT EXISTS commission_function_path TEXT DEFAULT '/functions/v1/commission-sync',
ADD COLUMN IF NOT EXISTS sync_interval_seconds INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS auto_sync_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS connection_status TEXT DEFAULT 'disconnected';

-- Enable RLS on new tables
ALTER TABLE cashier_employee_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE offline_attendance_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cashier_employee_mapping
CREATE POLICY "select_own_mapping" ON cashier_employee_mapping
  FOR SELECT TO authenticated USING (employee_id = auth.uid());

CREATE POLICY "insert_own_mapping" ON cashier_employee_mapping
  FOR INSERT TO authenticated WITH CHECK (employee_id = auth.uid());

CREATE POLICY "update_own_mapping" ON cashier_employee_mapping
  FOR UPDATE TO authenticated USING (employee_id = auth.uid()) WITH CHECK (employee_id = auth.uid());

CREATE POLICY "delete_own_mapping" ON cashier_employee_mapping
  FOR DELETE TO authenticated USING (employee_id = auth.uid());

-- Admin policies for cashier_employee_mapping
CREATE POLICY "admin_select_all_mappings" ON cashier_employee_mapping
  FOR SELECT TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "admin_insert_all_mappings" ON cashier_employee_mapping
  FOR INSERT TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "admin_update_all_mappings" ON cashier_employee_mapping
  FOR UPDATE TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "admin_delete_all_mappings" ON cashier_employee_mapping
  FOR DELETE TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- RLS Policies for wallet_transactions (employees see their own)
CREATE POLICY "select_own_wallet" ON wallet_transactions
  FOR SELECT TO authenticated USING (employee_id = auth.uid());

CREATE POLICY "insert_own_wallet" ON wallet_transactions
  FOR INSERT TO authenticated WITH CHECK (employee_id = auth.uid());

-- Admin policies for wallet_transactions
CREATE POLICY "admin_select_all_wallet" ON wallet_transactions
  FOR SELECT TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "admin_insert_all_wallet" ON wallet_transactions
  FOR INSERT TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- RLS Policies for sync_audit_log (admin only)
CREATE POLICY "admin_select_audit_log" ON sync_audit_log
  FOR SELECT TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "admin_insert_audit_log" ON sync_audit_log
  FOR INSERT TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "service_insert_audit_log" ON sync_audit_log
  FOR INSERT TO authenticated 
  WITH CHECK (true);

-- RLS Policies for offline_attendance_queue (employees see their own)
CREATE POLICY "select_own_offline_queue" ON offline_attendance_queue
  FOR SELECT TO authenticated USING (employee_id = auth.uid());

CREATE POLICY "insert_own_offline_queue" ON offline_attendance_queue
  FOR INSERT TO authenticated WITH CHECK (employee_id = auth.uid());

CREATE POLICY "update_own_offline_queue" ON offline_attendance_queue
  FOR UPDATE TO authenticated USING (employee_id = auth.uid()) WITH CHECK (employee_id = auth.uid());

CREATE POLICY "delete_own_offline_queue" ON offline_attendance_queue
  FOR DELETE TO authenticated USING (employee_id = auth.uid());

-- Admin policies for offline_attendance_queue
CREATE POLICY "admin_select_all_offline_queue" ON offline_attendance_queue
  FOR SELECT TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_employee ON wallet_transactions(employee_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_type ON wallet_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created ON wallet_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_audit_log_type ON sync_audit_log(sync_type);
CREATE INDEX IF NOT EXISTS idx_sync_audit_log_status ON sync_audit_log(status);
CREATE INDEX IF NOT EXISTS idx_sync_audit_log_created ON sync_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_offline_queue_synced ON offline_attendance_queue(synced);
CREATE INDEX IF NOT EXISTS idx_offline_queue_employee ON offline_attendance_queue(employee_id);

-- Function to log sync activity
CREATE OR REPLACE FUNCTION log_sync_activity(
  p_sync_type TEXT,
  p_direction TEXT,
  p_employee_id UUID DEFAULT NULL,
  p_payload JSONB DEFAULT NULL,
  p_response JSONB DEFAULT NULL,
  p_status TEXT DEFAULT 'pending',
  p_error_message TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO sync_audit_log (
    sync_type, direction, employee_id, payload, response, 
    status, error_message, sent_at, received_at
  ) VALUES (
    p_sync_type, p_direction, p_employee_id, p_payload, p_response,
    p_status, p_error_message,
    CASE WHEN p_direction = 'to_cashier' THEN now() ELSE NULL END,
    CASE WHEN p_direction = 'from_cashier' AND p_status = 'success' THEN now() ELSE NULL END
  ) RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update updated_at on cashier_employee_mapping
CREATE OR REPLACE FUNCTION update_cashier_mapping_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cashier_mapping_updated_at
  BEFORE UPDATE ON cashier_employee_mapping
  FOR EACH ROW EXECUTE FUNCTION update_cashier_mapping_timestamp();