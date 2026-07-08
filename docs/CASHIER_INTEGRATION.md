# ربط تطبيق الموظفين مع مشروع الكاشير - الدليل الكامل

هذا المستند يشرح كيف تنشر Edge Functions على **مشروع الكاشier** بحيث يستطيع
تطبيق الموظفين المزامنة بشكل آمن وثنائي الاتجاه.

## المبدأ الأساسي

- تطبيق الموظفين يستخدم بيانات الاتصال المحفوظة كـ Secrets (CASHIER_SUPABASE_URL, CASHIER_SUPABASE_PUBLISHABLE_KEY, CASHIER_SERVICE_ROLE_KEY).
- كل طلب يمر عبر Server Functions مع `requireSupabaseAuth` للتحقق من الهوية.
- الكاشير هو Source of Truth لجميع البيانات المالية والتشغيلية.
- مزامنة ثنائية الاتجاه للحضور، الرصيد، العمولات، السلف، والرواتب.

---

## Edge Functions المطلوبة على مشروع الكاشير

### 1. `employee-stats` - إحصائيات الموظف

```typescript
// supabase/functions/employee-stats/index.ts (على مشروع الكاشير)
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-cashier-employee-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const employeeId = req.headers.get("x-cashier-employee-id");
  if (!employeeId) {
    return new Response(JSON.stringify({ error: "employee_id required" }), {
      status: 400,
      headers: { ...CORS, "content-type": "application/json" },
    });
  }

  const body = await req.json().catch(() => ({}));

  // إذا كان طلب اختبار
  if (body.test) {
    return new Response(JSON.stringify({ ok: true, employee_id: employeeId }), {
      headers: { ...CORS, "content-type": "application/json" },
    });
  }

  // اجلب بيانات الموظف
  const [{ data: services }, { data: requests }, { data: balance }] = await Promise.all([
    admin.from("sales").select("id, client_id, commission_amount").eq("employee_id", employeeId),
    admin.from("employee_requests").select("id, type, status, created_at, note").eq("employee_id", employeeId).order("created_at", { ascending: false }).limit(20),
    admin.from("employee_balances").select("balance_due").eq("employee_id", employeeId).maybeSingle(),
  ]);

  const uniqueClients = new Set((services ?? []).map((s: any) => s.client_id)).size;
  const commissionsTotal = (services ?? []).reduce((s: number, r: any) => s + Number(r.commission_amount ?? 0), 0);

  return new Response(
    JSON.stringify({
      services_count: services?.length ?? 0,
      clients_count: uniqueClients,
      commissions_total: commissionsTotal,
      balance_due: Number(balance?.balance_due ?? 0),
      requests: requests ?? [],
      updated_at: new Date().toISOString(),
    }),
    { headers: { ...CORS, "content-type": "application/json" } }
  );
});
```

---

### 2. `attendance-sync` - مزامنة الحضور والانصراف

```typescript
// supabase/functions/attendance-sync/index.ts
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-cashier-employee-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const employeeId = req.headers.get("x-cashier-employee-id");
  if (!employeeId) {
    return new Response(JSON.stringify({ error: "employee_id required" }), {
      status: 400,
      headers: { ...CORS, "content-type": "application/json" },
    });
  }

  const body = await req.json();
  const { action, action_time, branch_id, latitude, longitude, device_info, cashier_employee_id } = body;

  // سجل الحضور أو الانصراف في جدول attendance
  const attendanceRecord = {
    employee_id: employeeId,
    action_type: action, // 'check_in' or 'check_out'
    action_time: action_time || new Date().toISOString(),
    branch_id: branch_id || null,
    latitude: latitude || null,
    longitude: longitude || null,
    device_info: device_info || null,
    created_at: new Date().toISOString(),
  };

  // أدخل أو حدّث سجل الحضور
  let result;
  if (action === "check_in") {
    const { data, error } = await admin
      .from("attendance")
      .insert({
        employee_id: employeeId,
        check_in: action_time,
        branch_id,
        check_in_lat: latitude,
        check_in_lng: longitude,
        device_info,
      })
      .select()
      .single();
    result = { data, error };
  } else if (action === "check_out") {
    // ابحث عن سجل الحضور اليوم وحدّثه
    const today = new Date().toISOString().split("T")[0];
    const { data: existing } = await admin
      .from("attendance")
      .select("id")
      .eq("employee_id", employeeId)
      .gte("check_in", today)
      .lte("check_in", today + " 23:59:59")
      .is("check_out", null)
      .maybeSingle();

    if (existing) {
      const { data, error } = await admin
        .from("attendance")
        .update({
          check_out: action_time,
          check_out_lat: latitude,
          check_out_lng: longitude,
        })
        .eq("id", existing.id)
        .select()
        .single();
      result = { data, error };
    } else {
      result = { data: null, error: "No check_in record found" };
    }
  }

  // إضافة يومية تلقائياً للموظفين باليومية (اختياري)
  // يمكنك إضافة منطق هنا لإضافة يومية تلقائياً

  return new Response(
    JSON.stringify({
      ok: !result?.error,
      data: result?.data,
      error: result?.error?.message || result?.error,
    }),
    { headers: { ...CORS, "content-type": "application/json" } }
  );
});
```

---

### 3. `wallet-sync` - مزامنة المحفظة

```typescript
// supabase/functions/wallet-sync/index.ts
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-cashier-employee-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const employeeId = req.headers.get("x-cashier-employee-id");
  if (!employeeId) {
    return new Response(JSON.stringify({ error: "employee_id required" }), {
      status: 400,
      headers: { ...CORS, "content-type": "application/json" },
    });
  }

  // اجلب رصيد الموظف
  const { data: wallet } = await admin
    .from("employee_wallets")
    .select("*")
    .eq("employee_id", employeeId)
    .maybeSingle();

  // اجلب آخر العمليات
  const { data: transactions } = await admin
    .from("wallet_transactions")
    .select("id, type, amount, description, created_at, balance_after")
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false })
    .limit(20);

  // حساب دخل الشهر واليوم
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const { data: monthTx } = await admin
    .from("wallet_transactions")
    .select("amount, type")
    .eq("employee_id", employeeId)
    .gte("created_at", monthStart)
    .in("type", ["commission", "salary", "bonus", "attendance_reward"]);

  const { data: todayTx } = await admin
    .from("wallet_transactions")
    .select("amount, type")
    .eq("employee_id", employeeId)
    .gte("created_at", todayStart)
    .in("type", ["commission", "salary", "bonus", "attendance_reward"]);

  const monthly_income = (monthTx || []).reduce((s: number, t: any) => s + Number(t.amount), 0);
  const daily_income = (todayTx || []).reduce((s: number, t: any) => s + Number(t.amount), 0);

  return new Response(
    JSON.stringify({
      current_balance: Number(wallet?.balance ?? 0),
      available_balance: Number(wallet?.available_balance ?? wallet?.balance ?? 0),
      pending_balance: Number(wallet?.pending_balance ?? 0),
      monthly_income,
      daily_income,
      transactions: transactions || [],
      updated_at: new Date().toISOString(),
    }),
    { headers: { ...CORS, "content-type": "application/json" } }
  );
});
```

---

### 4. `commission-sync` - مزامنة العمولات

```typescript
// supabase/functions/commission-sync/index.ts
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-cashier-employee-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const employeeId = req.headers.get("x-cashier-employee-id");
  if (!employeeId) {
    return new Response(JSON.stringify({ error: "employee_id required" }), {
      status: 400,
      headers: { ...CORS, "content-type": "application/json" },
    });
  }

  // اجلب العمولات غير المحفوظة
  const lastSync = new URL(req.url).searchParams.get("since");

  let query = admin
    .from("commissions")
    .select("id, amount, description, service_name, client_name, created_at")
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (lastSync) {
    query = query.gte("created_at", lastSync);
  }

  const { data: commissions, error } = await query;

  return new Response(
    JSON.stringify({
      ok: !error,
      commissions: commissions || [],
      error: error?.message,
    }),
    { headers: { ...CORS, "content-type": "application/json" } }
  );
});
```

---

### 5. `salary-sync` - مزامنة الراتب

```typescript
// supabase/functions/salary-sync/index.ts
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-cashier-employee-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const employeeId = req.headers.get("x-cashier-employee-id");
  if (!employeeId) {
    return new Response(JSON.stringify({ error: "employee_id required" }), {
      status: 400,
      headers: { ...CORS, "content-type": "application/json" },
    });
  }

  // اجلب تفاصيل الراتب
  const { data: salary } = await admin
    .from("employee_salaries")
    .select("*")
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return new Response(
    JSON.stringify({
      ok: true,
      base_salary: Number(salary?.base_salary ?? 0),
      allowances: Number(salary?.allowances ?? 0),
      deductions: Number(salary?.deductions ?? 0),
      net_salary: Number(salary?.net_salary ?? 0),
      payment_date: salary?.payment_date,
      payment_status: salary?.payment_status || "pending",
    }),
    { headers: { ...CORS, "content-type": "application/json" } }
  );
});
```

---

### 6. `advance-sync` - مزامنة السلف

```typescript
// supabase/functions/advance-sync/index.ts
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-cashier-employee-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const employeeId = req.headers.get("x-cashier-employee-id");
  if (!employeeId) {
    return new Response(JSON.stringify({ error: "employee_id required" }), {
      status: 400,
      headers: { ...CORS, "content-type": "application/json" },
    });
  }

  // اجلب السلف المعتمدة
  const { data: advances } = await admin
    .from("employee_advances")
    .select("id, amount, description, approved_by, status, created_at")
    .eq("employee_id", employeeId)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(50);

  return new Response(
    JSON.stringify({
      ok: true,
      advances: advances || [],
    }),
    { headers: { ...CORS, "content-type": "application/json" } }
  );
});
```

---

### 7. `withdrawal-sync` - مزامنة الصرف

```typescript
// supabase/functions/withdrawal-sync/index.ts
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-cashier-employee-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const employeeId = req.headers.get("x-cashier-employee-id");
  if (!employeeId) {
    return new Response(JSON.stringify({ error: "employee_id required" }), {
      status: 400,
      headers: { ...CORS, "content-type": "application/json" },
    });
  }

  // اجلب عمليات الصرف
  const { data: withdrawals } = await admin
    .from("employee_withdrawals")
    .select("id, amount, description, approved_by, method, created_at")
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false })
    .limit(50);

  return new Response(
    JSON.stringify({
      ok: true,
      withdrawals: withdrawals || [],
    }),
    { headers: { ...CORS, "content-type": "application/json" } }
  );
});
```

---

## نشر الدوال على مشروع الكاشير

من داخل مشروع الكاشير:

```bash
supabase functions deploy employee-stats --no-verify-jwt
supabase functions deploy attendance-sync --no-verify-jwt
supabase functions deploy wallet-sync --no-verify-jwt
supabase functions deploy commission-sync --no-verify-jwt
supabase functions deploy salary-sync --no-verify-jwt
supabase functions deploy advance-sync --no-verify-jwt
supabase functions deploy withdrawal-sync --no-verify-jwt
```

> **ملاحظة:** `--no-verify-jwt` لأننا نمرر anon key + نتحقق من الوصول عبر `x-cashier-employee-id` header.

---

## إعداد تطبيق الموظفين

### 1. أ secrets المطلوبة

تم إضافة الـ Secrets التالية تلقائياً:
- `CASHIER_SUPABASE_URL`
- `CASHIER_SUPABASE_PUBLISHABLE_KEY`
- `CASHIER_SERVICE_ROLE_KEY`

### 2. ربط الموظفين

لكل موظف في تطبيق الموظفين، يجب:
1. فتح **لوحة الإدارة → ربط الكاشير → ربط الموظفين**
2. إضافة mapping بين `employee_id` في التطبيق و `cashier_employee_id` في الكاشير
3. تحديد `branch_id` إذا لزم الأمر

### 3. تفعيل التكامل

1. افتح **لوحة الإدارة → ربط الكاشير → الإعدادات**
2. فعّل التكامل (`enabled = true`)
3. تحقق من الاتصال بضغط زر "اختبار الاتصال"

---

## المزامنة التلقائية

- **المحفظة:** تُحدّث كل 10 ثوانٍ تلقائياً
- **الحضور:** يُزامن فوراً عند تسجيل الحضور/الانصراف
- **العمولات/السلف/الرواتب:** تُزامن عند طلب المستخدم

---

## الأمان

- لا Service Role داخل Frontend تطبيق الموظفين
- جميع الطلبات تمر عبر Server Functions مع `requireSupabaseAuth`
- الكاشير يُرجع فقط بيانات الموظف المطلوب (بواسطة `x-cashier-employee-id`)
- RLS policies على جميع الجداول في التطبيقين

---

## استكشاف الأخطاء

### فشل الاتصال بالكاشير
1. تأكد من صحة `CASHIER_SUPABASE_URL`
2. تأكد من أن Edge Functions منشورة على الكاشير
3. راجع `sync_audit_log` للاطلاع على تفاصيل الأخطاء

### بيانات المحفظة غير متزامنة
1. تأكد من وجود `employee_wallets` table في الكاشير
2. تأكد من ربط الموظف (`cashier_employee_mapping`)
3. راجع Edge Function `wallet-sync` logs

### الحضور لا يُزامن
1. تأكد من وجود `attendance` table في الكاشير
2. تأكد من تفعيل التكامل في الإعدادات
3. راجع `offline_attendance_queue` للعمليات المعلقة
