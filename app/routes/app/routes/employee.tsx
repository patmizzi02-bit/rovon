import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  // Netlify Supabase extension uses SUPABASE_DATABASE_URL
  const url = process.env.SUPABASE_DATABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing SUPABASE_DATABASE_URL (or SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY in Netlify environment variables."
    );
  }

  return createClient(url, serviceKey);
}

export async function loader({}: LoaderFunctionArgs) {
  const supabase = getSupabaseAdmin();

  const { data: jobs, error } = await supabase
    .from("jobs")
    .select("id, job_name")
    .eq("status", "open");

  if (error) return json({ jobs: [], error: error.message });
  return json({ jobs: jobs ?? [], error: null });
}

export async function action({ request }: ActionFunctionArgs) {
  const supabase = getSupabaseAdmin();
  const form = await request.formData();

  const pin = String(form.get("pin") || "").trim();
  const job_id = String(form.get("job_id") || "").trim();
  const hours = Number(form.get("hours") || 0);

  const item_name = String(form.get("item_name") || "").trim();
  const quantity = Number(form.get("quantity") || 0);
  const cost_per_unit = Number(form.get("cost_per_unit") || 0);

  if (!pin || !job_id || hours <= 0) {
    return json({ ok: false, error: "Enter PIN, select a job, and enter hours." });
  }

  const { data: emp, error: empErr } = await supabase
    .from("employees")
    .select("id")
    .eq("pin", pin)
    .eq("active", true)
    .single();

  if (empErr || !emp) return json({ ok: false, error: "Invalid PIN." });

  const { error: tErr } = await supabase.from("time_logs").insert({
    job_id,
    employee_id: emp.id,
    hours,
  });

  if (tErr) return json({ ok: false, error: `Failed to save time: ${tErr.message}` });

  if (item_name) {
    const { error: mErr } = await supabase.from("materials").insert({
      job_id,
      item_name,
      quantity,
      cost_per_unit,
    });

    if (mErr) return json({ ok: false, error: `Time saved, but materials failed: ${mErr.message}` });
  }

  return json({ ok: true, error: null });
}

export default function EmployeeClockIn() {
  const { jobs, error } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();

  return (
    <div style={{ maxWidth: 520, margin: "40px auto", padding: 16, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Employee Clock In</h1>

      {error && <p style={{ color: "red" }}>Load error: {error}</p>}

      <Form method="post" style={{ display: "grid", gap: 10, marginTop: 18 }}>
        <label>
          PIN
          <input name="pin" type="password" required style={{ width: "100%", padding: 10 }} />
        </label>

        <label>
          Job
          <select name="job_id" required style={{ width: "100%", padding: 10 }}>
            <option value="">Select a job</option>
            {jobs.map((j: any) => (
              <option key={j.id} value={j.id}>
                {j.job_name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Hours
          <input name="hours" type="number" step="0.25" min="0" required style={{ width: "100%", padding: 10 }} />
        </label>

        <div style={{ marginTop: 8, paddingTop: 10, borderTop: "1px solid #eee" }}>
          <h2 style={{ fontSize: 18, marginBottom: 6 }}>Materials (optional)</h2>
          <input name="item_name" placeholder="Item name" style={{ width: "100%", padding: 10, marginBottom: 8 }} />
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
            <input name="quantity" type="number" step="0.01" placeholder="Qty" style={{ width: "100%", padding: 10 }} />
            <input name="cost_per_unit" type="number" step="0.01" placeholder="Cost" style={{ width: "100%", padding: 10 }} />
          </div>
        </div>

        <button type="submit" style={{ marginTop: 10, padding: 12, fontWeight: 700 }}>
          Submit
        </button>
      </Form>

      {result?.error && <p style={{ marginTop: 14, color: "red" }}>{result.error}</p>}
      {result?.ok && <p style={{ marginTop: 14, color: "green" }}>Submitted!</p>}
    </div>
  );
}
