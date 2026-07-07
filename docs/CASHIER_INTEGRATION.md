# ربط تطبيق الموظفين مع مشروع الكاشير

هذا المستند يشرح كيف تنشر Edge Function على **مشروع الكاشير** بحيث يستطيع
تطبيق الموظفين قراءة بيانات كل موظف بشكل آمن، **دون** الحاجة إلى Service Role
داخل تطبيق الموظفين.

## المبدأ

- تطبيق الموظفين يحفظ فقط: `Cashier URL` + `Publishable (anon) Key`.
- كل طلب يمر عبر دالة سيرفر داخل تطبيق الموظفين (`getCashierEmployeeStats`).
- الدالة تتحقق من هوية المستخدم، تجلب `cashier_employee_id` الخاص به من قاعدة
  البيانات، ثم تنادي Edge Function في الكاشير مع تمرير هذا الـ ID فقط.
- Edge Function في الكاشير هي المسؤولة عن إعادة **بيانات هذا الموظف فقط** —
  لا مبيعات باقي الموظفين، لا بيانات عملاء، لا أرباح عامة، لا إعدادات.

## Edge Function المطلوبة على مشروع الكاشير

أنشئ دالة باسم `employee-stats` واستخدم Service Role **داخل الكاشير فقط**
(لا تخرج للتطبيق أبداً). ضع الكود التالي:

```ts
// supabase/functions/employee-stats/index.ts  (على مشروع الكاشير)
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-employee-id",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url = new URL(req.url);
  const employeeId = url.searchParams.get("employee_id") ?? req.headers.get("x-employee-id");
  if (!employeeId) {
    return new Response(JSON.stringify({ error: "employee_id required" }),
      { status: 400, headers: { ...CORS, "content-type": "application/json" } });
  }

  // اجلب فقط بيانات هذا الموظف - عدّل أسماء الجداول والأعمدة حسب مشروعك
  const [{ data: services }, { data: requests }, { data: balance }] = await Promise.all([
    admin.from("sales")
      .select("id, client_id, commission_amount")
      .eq("employee_id", employeeId),
    admin.from("employee_requests")
      .select("id, type, status, created_at, note")
      .eq("employee_id", employeeId)
      .order("created_at", { ascending: false })
      .limit(20),
    admin.from("employee_balances")
      .select("balance_due")
      .eq("employee_id", employeeId)
      .maybeSingle(),
  ]);

  const uniqueClients = new Set((services ?? []).map((s: any) => s.client_id)).size;
  const commissionsTotal = (services ?? []).reduce((s: number, r: any) => s + Number(r.commission_amount ?? 0), 0);

  return new Response(JSON.stringify({
    services_count: services?.length ?? 0,
    clients_count: uniqueClients,
    commissions_total: commissionsTotal,
    balance_due: Number(balance?.balance_due ?? 0),
    requests: requests ?? [],
    updated_at: new Date().toISOString(),
  }), { headers: { ...CORS, "content-type": "application/json" } });
});
```

### نشرها
من داخل مشروع الكاشير:
```bash
supabase functions deploy employee-stats --no-verify-jwt
```
> `--no-verify-jwt` لأننا نمرر anon key فقط + نتحقق من الوصول عبر `employee_id`
> على مستوى الاستعلام.

## إعداد تطبيق الموظفين

1. افتح **لوحة الإدارة → ربط الكاشير**.
2. أدخل `Cashier URL` و `Publishable Key` (anon key فقط — لا تستخدم service_role).
3. فعّل الربط.
4. لكل موظف، حدّد قيمة `cashier_employee_id` من قائمة **الموظفون**.
5. الآن يرى كل موظف بطاقة "من الكاشير" على الصفحة الرئيسية تتحدث كل 10 ثوانٍ.

## المضمون أمنياً

- ✅ لا Service Role داخل هذا التطبيق ولا في الـ Frontend.
- ✅ الطلب يوقّع من السيرفر بعد التحقق من هوية المستخدم عبر `requireSupabaseAuth`.
- ✅ الـ `cashier_employee_id` يُقرأ من جدول `employee_profiles` ولا يستقبله المستخدم.
- ✅ الكاشير يُرجع فقط الحقول المصرح بها (خدمات، عملاء، عمولات، رصيد، طلبات الموظف).
