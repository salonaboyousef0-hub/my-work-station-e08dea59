// Second Supabase client connected to the manager (cashier) project.
// Used to read shifts and tasks that the manager creates in the other project.
import { createClient } from "@supabase/supabase-js";

const MANAGER_SUPABASE_URL = "https://ztgazyjzzoinihbguyfi.supabase.co";
const MANAGER_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0Z2F6eWp6em9pbmloYmd1eWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0OTM2MzMsImV4cCI6MjA5ODA2OTYzM30.fcYXtUxg4897OYlvTLOnmHj4OgzpnNbQ2-e3M4I7EXg";

export const managerSupabase = createClient(MANAGER_SUPABASE_URL, MANAGER_SUPABASE_ANON_KEY, {
  auth: {
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
    storageKey: "sb-manager-auth-token", // separate key so it doesn't clash with the main client
  },
});
