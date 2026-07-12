import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, notAuthed } from "../supabase";

export default defineTool({
  name: "create_leave_request",
  title: "Create leave request",
  description: "Submit a new leave request for the signed-in employee. Requires manager approval.",
  inputSchema: {
    start_date: z.string().describe("Leave start date (YYYY-MM-DD)."),
    end_date: z.string().describe("Leave end date (YYYY-MM-DD)."),
    reason: z.string().min(1).describe("Reason for the leave."),
    leave_type: z.string().optional().describe("Type of leave (e.g. sick, personal, vacation)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ start_date, end_date, reason, leave_type }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthed();
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("leave_requests")
      .insert({
        user_id: ctx.getUserId(),
        start_date,
        end_date,
        reason,
        leave_type: leave_type ?? "personal",
        status: "pending",
      })
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Leave request submitted (id: ${data.id}).` }],
      structuredContent: { request: data },
    };
  },
});
