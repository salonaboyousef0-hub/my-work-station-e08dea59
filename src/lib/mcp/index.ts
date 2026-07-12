import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getMyProfile from "./tools/get-my-profile";
import listMyAttendance from "./tools/list-my-attendance";
import listMyTransactions from "./tools/list-my-transactions";
import listMyShifts from "./tools/list-my-shifts";
import listAnnouncements from "./tools/list-announcements";
import createLeaveRequest from "./tools/create-leave-request";

// The OAuth issuer must be the direct Supabase host, not the .lovable.cloud proxy.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "salon-employee-mcp",
  title: "Salon Employee Portal",
  version: "0.1.0",
  instructions:
    "Tools for a salon employee to check their profile, attendance, financial transactions, shifts, and announcements, and to submit leave requests. Every tool acts as the signed-in employee under RLS.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    getMyProfile,
    listMyAttendance,
    listMyTransactions,
    listMyShifts,
    listAnnouncements,
    createLeaveRequest,
  ],
});
