import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TZ = "Europe/Lisbon";

/** Returns minutes-of-day (0..1440) in Europe/Lisbon for a given UTC timestamp string. */
function tsToLisbonMinutes(ts: string): number {
  const d = new Date(ts);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === "hour")?.value || "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value || "0");
  return h * 60 + m;
}

/** "HH:MM(:SS)" → minutes-of-day. */
function timeToMinutes(t: string | null | undefined): number {
  if (!t) return 0;
  const [h, m] = t.split(":");
  return Number(h) * 60 + Number(m);
}

function isPartTimeShape(s: { lunch_in_time?: string | null; clock_out_time?: string | null }): boolean {
  return s.lunch_in_time === "00:00:00" && s.clock_out_time === "00:00:00";
}

/** Current Lisbon date (YYYY-MM-DD). */
function todayLisbon(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return `${y}-${m}-${d}`;
}

function yesterdayLisbon(): string {
  const today = todayLisbon();
  const d = new Date(today + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function eachDateInclusive(from: string, to: string): string[] {
  const out: string[] = [];
  const start = new Date(from + "T12:00:00Z");
  const end = new Date(to + "T12:00:00Z");
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return out;
  const cur = new Date(start);
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Resolve target dates: body.from/body.to (range) or body.date (single) or yesterday (default).
    let bodyDate = "";
    let bodyFrom = "";
    let bodyTo = "";
    try {
      const body = await req.json();
      bodyDate = body?.date || "";
      bodyFrom = body?.from || "";
      bodyTo = body?.to || "";
    } catch {
      // no body
    }

    let dates: string[];
    if (bodyFrom && bodyTo) {
      dates = eachDateInclusive(bodyFrom, bodyTo);
      if (!dates.length) {
        return new Response(
          JSON.stringify({ error: "Intervalo inválido (from > to ou datas inválidas)" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    } else {
      dates = [bodyDate || yesterdayLisbon()];
    }

    const rangeStart = dates[0];
    const rangeEnd = dates[dates.length - 1];

    // Holiday check
    const { data: holidays } = await supabase
      .from("holidays")
      .select("holiday_date, recurring_yearly");
    const isHolidayOn = (date: string): boolean => {
      const mmdd = date.slice(5);
      return (holidays || []).some((h: any) => {
        if (h.holiday_date === date) return true;
        if (h.recurring_yearly && String(h.holiday_date).slice(5) === mmdd) return true;
        return false;
      });
    };

    // Active employees
    const { data: employees, error: empErr } = await supabase
      .from("employees")
      .select("id, first_name, last_name, schedule_template_id")
      .eq("status", "active");
    if (empErr) throw empErr;
    if (!employees?.length) {
      return new Response(
        JSON.stringify({ from: rangeStart, to: rangeEnd, days: dates.length, candidates_found: 0, created: 0, by_kind: {} }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const employeeIds = employees.map((e: any) => e.id);

    // Punches for the whole range (single query, regroup by date)
    const { data: records } = await supabase
      .from("time_clock_records")
      .select("id, employee_id, record_date, clock_in, lunch_out, lunch_in, clock_out")
      .gte("record_date", rangeStart)
      .lte("record_date", rangeEnd)
      .in("employee_id", employeeIds);
    if (!records?.length) {
      return new Response(
        JSON.stringify({ from: rangeStart, to: rangeEnd, days: dates.length, candidates_found: 0, created: 0, by_kind: {} }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Per-employee overrides (all days-of-week, indexed by employee+dow)
    const { data: overrides } = await supabase
      .from("employee_schedules")
      .select(
        "employee_id, day_of_week, clock_in_time, lunch_out_time, lunch_in_time, clock_out_time, is_day_off",
      )
      .in("employee_id", employeeIds);
    const overrideMap = new Map<string, any>(); // key: `${employee_id}:${dow}`
    for (const o of overrides || []) overrideMap.set(`${o.employee_id}:${o.day_of_week}`, o);

    // Templates
    const templateIds = [
      ...new Set(employees.map((e: any) => e.schedule_template_id).filter(Boolean)),
    ] as string[];
    const templateDayMap = new Map<string, any>(); // key: `${template_id}:${dow}`
    const templateInfoMap = new Map<string, { tolerance_overtime_minutes: number }>();
    if (templateIds.length) {
      const [{ data: tDays }, { data: tInfo }] = await Promise.all([
        supabase
          .from("schedule_template_days")
          .select(
            "template_id, day_of_week, clock_in_time, lunch_out_time, lunch_in_time, clock_out_time, is_day_off",
          )
          .in("template_id", templateIds),
        supabase
          .from("schedule_templates")
          .select("id, tolerance_overtime_minutes")
          .in("id", templateIds),
      ]);
      for (const td of tDays || []) templateDayMap.set(`${td.template_id}:${td.day_of_week}`, td);
      for (const t of tInfo || []) {
        templateInfoMap.set(t.id, {
          tolerance_overtime_minutes: t.tolerance_overtime_minutes ?? 15,
        });
      }
    }

    const empMap = new Map<string, any>();
    for (const e of employees) empMap.set(e.id, e);

    type Row = {
      employee_id: string;
      record_date: string;
      kind: "overtime" | "day_off_work" | "holiday_work";
      minutes: number;
      status: "pending";
      time_clock_record_id: string;
      tolerance_applied_minutes: number;
    };

    const rows: Row[] = [];

    for (const rec of records) {
      const emp = empMap.get(rec.employee_id);
      if (!emp) continue;

      const hasPunch = !!(rec.clock_in || rec.clock_out || rec.lunch_in || rec.lunch_out);
      if (!hasPunch) continue;

      const recDate: string = rec.record_date;
      const dow = new Date(recDate + "T12:00:00Z").getUTCDay();
      const isHoliday = isHolidayOn(recDate);

      // Resolve schedule (override > template_day)
      const override = overrideMap.get(`${rec.employee_id}:${dow}`);
      const tDay = emp.schedule_template_id
        ? templateDayMap.get(`${emp.schedule_template_id}:${dow}`)
        : null;
      const schedule = override || tDay || null;
      const tolerance =
        (emp.schedule_template_id &&
          templateInfoMap.get(emp.schedule_template_id)?.tolerance_overtime_minutes) ??
        15;

      // Effective work minutes (entry → exit, minus lunch)
      const inTs = rec.clock_in;
      const outTs = rec.clock_out || rec.lunch_in || rec.lunch_out;
      let worked = 0;
      if (inTs && outTs) {
        worked = Math.max(0, tsToLisbonMinutes(outTs) - tsToLisbonMinutes(inTs));
        if (rec.lunch_out && rec.lunch_in) {
          worked -= Math.max(
            0,
            tsToLisbonMinutes(rec.lunch_in) - tsToLisbonMinutes(rec.lunch_out),
          );
        }
        worked = Math.max(0, worked);
      }

      // Holiday work → always wins
      if (isHoliday) {
        if (worked > 0) {
          rows.push({
            employee_id: rec.employee_id,
            record_date: recDate,
            kind: "holiday_work",
            minutes: worked,
            status: "pending",
            time_clock_record_id: rec.id,
            tolerance_applied_minutes: 0,
          });
        }
        continue;
      }

      // Day-off work (schedule explicitly says day off, or no schedule at all)
      if (!schedule || schedule.is_day_off) {
        if (worked > 0) {
          rows.push({
            employee_id: rec.employee_id,
            record_date: recDate,
            kind: "day_off_work",
            minutes: worked,
            status: "pending",
            time_clock_record_id: rec.id,
            tolerance_applied_minutes: 0,
          });
        }
        continue;
      }

      // Regular workday → overtime = actual_out - scheduled_out - tolerance
      const partTime = isPartTimeShape(schedule);
      const effectiveOut = partTime ? rec.lunch_out || rec.clock_out : rec.clock_out;
      if (!effectiveOut) continue;

      const scheduledOutMin = partTime
        ? timeToMinutes(schedule.lunch_out_time)
        : timeToMinutes(schedule.clock_out_time);
      const actualOutMin = tsToLisbonMinutes(effectiveOut);
      const extra = actualOutMin - scheduledOutMin;
      if (extra <= tolerance) continue;

      rows.push({
        employee_id: rec.employee_id,
        record_date: recDate,
        kind: "overtime",
        minutes: extra - tolerance,
        status: "pending",
        time_clock_record_id: rec.id,
        tolerance_applied_minutes: tolerance,
      });
    }

    if (!rows.length) {
      return new Response(
        JSON.stringify({ from: rangeStart, to: rangeEnd, days: dates.length, candidates_found: 0, created: 0, by_kind: {} }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Deduplicate rows by (employee_id, record_date, kind).
    // If duplicates exist (multiple time_clock_records same day), keep the one with MAX minutes.
    // Postgres refuses ON CONFLICT when the same key appears twice in one command
    // ("cannot affect row a second time"), so dedup MUST happen before upsert.
    const dedupMap = new Map<string, Row>();
    for (const r of rows) {
      const key = `${r.employee_id}:${r.record_date}:${r.kind}`;
      const existing = dedupMap.get(key);
      if (!existing || r.minutes > existing.minutes) dedupMap.set(key, r);
    }
    const dedupedRows = Array.from(dedupMap.values());

    // Count how many of the deduped candidates already exist in DB (any status)
    // so we can report accurate created counts. ignoreDuplicates:true with .select()
    // does NOT return the ignored rows, so we compute created = detected - already_existing.
    const uniqueEmpIds = [...new Set(dedupedRows.map((r) => r.employee_id))];
    const uniqueDates = [...new Set(dedupedRows.map((r) => r.record_date))];
    const { data: existing, error: exErr } = await supabase
      .from("overtime_approvals")
      .select("employee_id, record_date, kind")
      .in("employee_id", uniqueEmpIds)
      .in("record_date", uniqueDates);
    if (exErr) throw exErr;
    const existingSet = new Set(
      (existing || []).map((e: any) => `${e.employee_id}:${e.record_date}:${e.kind}`),
    );
    const newRows = dedupedRows.filter(
      (r) => !existingSet.has(`${r.employee_id}:${r.record_date}:${r.kind}`),
    );

    // Idempotent upsert — never overwrite an already-decided row. Chunk for large ranges.
    const CHUNK = 500;
    let createdCount = 0;
    const byKind: Record<string, number> = { overtime: 0, day_off_work: 0, holiday_work: 0 };
    for (let i = 0; i < dedupedRows.length; i += CHUNK) {
      const slice = dedupedRows.slice(i, i + CHUNK);
      const { error: upErr } = await supabase
        .from("overtime_approvals")
        .upsert(slice, {
          onConflict: "employee_id,record_date,kind",
          ignoreDuplicates: true,
        });
      if (upErr) throw upErr;
    }
    for (const r of newRows) {
      createdCount++;
      byKind[r.kind] = (byKind[r.kind] || 0) + 1;
    }

    if (createdCount > 0) {
      const parts: string[] = [];
      if (byKind.overtime) parts.push(`${byKind.overtime} hora(s) extra`);
      if (byKind.day_off_work) parts.push(`${byKind.day_off_work} trabalho(s) em folga`);
      if (byKind.holiday_work) parts.push(`${byKind.holiday_work} trabalho(s) em feriado`);

      const scope = dates.length === 1 ? dates[0] : `${rangeStart} → ${rangeEnd}`;
      await supabase.from("admin_notifications").insert({
        title: "Aprovações de horas pendentes",
        message: `${createdCount} candidato(s) detetado(s) em ${scope}: ${parts.join(", ")}. Reveja na aba de Aprovações.`,
        type: "overtime_pending",
      });
    }

    return new Response(
      JSON.stringify({
        from: rangeStart,
        to: rangeEnd,
        days: dates.length,
        candidates_found: rows.length,
        candidates_detected: dedupedRows.length,
        already_existing: dedupedRows.length - createdCount,
        created: createdCount,
        by_kind: byKind,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});