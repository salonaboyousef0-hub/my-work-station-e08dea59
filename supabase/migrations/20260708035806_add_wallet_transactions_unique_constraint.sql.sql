-- Add unique constraint for wallet transactions to prevent duplicates
ALTER TABLE wallet_transactions 
ADD CONSTRAINT wallet_transactions_reference_unique 
UNIQUE (reference_id, reference_type);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_employee_type 
ON wallet_transactions(employee_id, transaction_type, created_at DESC);
