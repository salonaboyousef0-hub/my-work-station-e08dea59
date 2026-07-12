import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type AuthOAuth = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};

function oauth(): AuthOAuth {
  return (supabase.auth as unknown as { oauth: AuthOAuth }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    const next = location.pathname + location.searchStr;
    if (!data.session) throw redirect({ to: "/auth", search: { next } });
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
    if (error) throw error;
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="min-h-screen flex items-center justify-center p-6 text-center">
      <div className="max-w-md">
        <h1 className="text-xl font-bold mb-2">تعذر تحميل طلب الاتصال</h1>
        <p className="text-sm text-muted-foreground">{String((error as Error)?.message ?? error)}</p>
      </div>
    </main>
  ),
});

function Consent() {
  const details: any = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientName = details?.client?.name ?? details?.client?.client_name ?? "تطبيق خارجي";
  const redirectUri =
    details?.client?.redirect_uris?.[0] ?? details?.client?.redirect_uri ?? null;
  const scopes: string[] = Array.isArray(details?.scopes)
    ? details.scopes
    : typeof details?.scope === "string"
    ? details.scope.split(/\s+/).filter(Boolean)
    : [];

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    if (error) { setBusy(false); setError(error.message); return; }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) { setBusy(false); setError("No redirect returned by the authorization server."); return; }
    window.location.href = target;
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-3xl shadow-elevated p-6 space-y-5">
        <header className="text-center">
          <h1 className="text-lg font-bold">ربط {clientName} بحسابك</h1>
          <p className="text-sm text-muted-foreground mt-1">
            سيتمكن {clientName} من استخدام أدوات هذا التطبيق نيابةً عنك.
          </p>
        </header>

        {redirectUri && (
          <div className="text-xs bg-muted rounded-xl p-3 break-all" dir="ltr">
            <span className="font-semibold">Redirect:</span> {redirectUri}
          </div>
        )}

        {scopes.length > 0 && (
          <div>
            <p className="text-sm font-semibold mb-1">الصلاحيات المطلوبة</p>
            <ul className="text-sm text-muted-foreground list-disc pr-5 space-y-0.5">
              {scopes.map(s => <li key={s} dir="ltr">{s}</li>)}
            </ul>
          </div>
        )}

        <p className="text-xs text-muted-foreground bg-warning/10 border border-warning/20 rounded-xl p-3">
          هذا لا يتجاوز صلاحيات التطبيق أو سياسات RLS في قاعدة البيانات. سترى الأداة فقط بياناتك أنت.
        </p>

        {error && (
          <p role="alert" className="text-sm text-destructive">{error}</p>
        )}

        <div className="flex gap-2">
          <button
            disabled={busy}
            onClick={() => decide(false)}
            className="flex-1 rounded-xl border border-border py-3 font-semibold disabled:opacity-50"
          >رفض</button>
          <button
            disabled={busy}
            onClick={() => decide(true)}
            className="flex-1 rounded-xl bg-primary text-primary-foreground py-3 font-semibold disabled:opacity-50"
          >{busy ? "جارٍ..." : "موافقة"}</button>
        </div>
      </div>
    </main>
  );
}
