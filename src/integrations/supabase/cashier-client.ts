// Direct client to the cashier's Supabase project.
// Used to read/write shared salon data (attendance, operations, withdrawals)
// keyed by the employee's name (as stored in this app's profile).
// All access is subject to the cashier project's RLS; failures are handled
// silently by the callers and the UI degrades gracefully.
import { createClient } from "@supabase/supabase-js";

const CASHIER_URL = "https://ztgazyjzzoinihbguyfi.supabase.co";
const CASHIER_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0Z2F6eWp6em9pbmloYmd1eWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0OTM2MzMsImV4cCI6MjA5ODA2OTYzM30.fcYXtUxg4897OYlvTLOnmHj4OgzpnNbQ2-e3M4I7EXg";

export const cashierClient = createClient(CASHIER_URL, CASHIER_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    storageKey: "sb-cashier-anon",
  },
});
