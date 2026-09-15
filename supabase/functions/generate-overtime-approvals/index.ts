/**
 * Apuramento do ponto e deteção de candidatos a aprovação.
 *
 * Usa o MOTOR PARTILHADO (`_shared/attendance/engine.ts`) — exatamente o mesmo
 * que a aplicação usa nos ecrãs — e persiste o resultado em
 * `attendance_daily_evaluations`. É esse apuramento persistido que o fecho
 * mensal consulta: o servidor nunca confia num valor enviado pelo ecrã.
 *
 * Regras:
 *  - Nada é creditado automaticamente. Só se criam candidatos PENDENTES.
 *  - Candidatos de entrada antecipada e de saída tardia são SEPARADOS.
 *  - Horário individual tem prioridade sobre o modelo do departamento.
 *  - Férias, feriados e folgas são tratados como trabalho excecional.
 *  - Candidatos já decididos nunca são alterados.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  ENGINE_VERSION,
  evaluateDay,
  timestampToLisbonMinutes,
  type ScheduleLike,
} from "../_shared/attendance/engine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TZ = "Europe/Lisbon";

function todayLisbon(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}-${parts.find((p) => p.type === "day")!.value}`;
}

function yesterdayLisbon(): string {
  const d = new Date(todayLisbon() + "T12:00:00Z");
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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let bodyDate = "", bodyFrom = "", bodyTo = "";
    try {
      const body = await req.json();
      bodyDate = body?.date || "";
      bodyFrom = body?.from || "";
      bodyTo = body?.to || "";
    } catch { /* sem corpo */ }

    let dates: string[];
    if (bodyFrom && bodyTo) {
      dates = eachDateInclusive(bodyFrom, bodyTo);
      if (!dates.length) {
        return new Response(JSON.stringify({ error: "Intervalo inválido (from > to ou datas inválidas)" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      dates = [bodyDate || yesterdayLisbon()];
    }

    const rangeStart = dates[0];
    const rangeEnd = dates[dates.length - 1];

    const empty = {
      from: rangeStart, to: rangeEnd, days: dates.length,
      candidates_detected: 0, already_existing: 0, created: 0,
      evaluations_written: 0, review_days: 0, by_kind: {},
    };

    const { data: holidays } = await supabase.from("holidays").select("holiday_date, recurring_yearly");
    const isHolidayOn = (date: string): boolean => {
      const mmdd = date.slice(5);
      return (holidays || []).some((h: any) =>
        h.holiday_date === date || (h.recurring_yearly && String(h.holiday_date).slice(5) === mmdd));
    };

    const { data: employees, error: empErr } = await supabase
      .from("employees")
      .select("id, first_name, last_name, schedule_template_id")
      .eq("status", "active");
    if (empErr) throw empErr;
    if (!employees?.length) {
      return new Response(JSON.stringify(empty), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const employeeIds = employees.map((e: any) => e.id);

    // Férias aprovadas e confirmadas que se cruzam com o intervalo.
    const { data: vacations } = await supabase
      .from("vacation_requests")
      .select("employee_id, start_date, end_date")
      .eq("status", "approved").eq("admin_confirmed", true)
      .in("employee_id", employeeIds)
      .lte("start_date", rangeEnd).gte("end_date", rangeStart);
    const vacationSet = new Set<string>();
    for (const v of vacations || []) {
      const s = new Date((v.start_date as string) + "T12:00:00Z");
      const e = new Date((v.end_date as string) + "T12:00:00Z");
      for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
        vacationSet.add(`${v.employee_id}:${d.toISOString().slice(0, 10)}`);
      }
    }

    // Faltas confirmadas: o dia não gera débito nem candidato.
    const { data: absences } = await supabase
      .from("absences")
      .select("employee_id, absence_date")
      .in("employee_id", employeeIds)
      .gte("absence_date", rangeStart).lte("absence_date", rangeEnd);
    const absenceSet = new Set((absences || []).map((a: any) => `${a.employee_id}:${a.absence_date}`));

    // Meses já fechados: não se toca em nada lá dentro.
    const { data: closures } = await supabase
      .from("time_bank_monthly_closures")
      .select("employee_id, period_year, period_month, is_locked")
      .in("employee_id", employeeIds).eq("is_locked", true);
    const lockedSet = new Set(
      (closures || []).map((c: any) =>
        `${c.employee_id}:${c.period_year}-${String(c.period_month).padStart(2, "0")}`),
    );
    const isLocked = (empId: string, date: string) => lockedSet.has(`${empId}:${date.slice(0, 7)}`);

    const { data: records } = await supabase
      .from("time_clock_records")
      .select("id, employee_id, record_date, clock_in, lunch_out, lunch_in, clock_out")
      .gte("record_date", rangeStart).lte("record_date", rangeEnd)
      .in("employee_id", employeeIds);
    if (!records?.length) {
      return new Response(JSON.stringify(empty), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Horário individual (prioridade) e modelo do departamento (recurso).
    const { data: overrides } = await supabase
      .from("employee_schedules")
      .select("employee_id, day_of_week, clock_in_time, lunch_out_time, lunch_in_time, clock_out_time, is_day_off")
      .in("employee_id", employeeIds);
    const overrideMap = new Map<string, any>();
    for (const o of overrides || []) overrideMap.set(`${o.employee_id}:${o.day_of_week}`, o);

    const templateIds = [...new Set(employees.map((e: any) => e.schedule_template_id).filter(Boolean))] as string[];
    const templateDayMap = new Map<string, any>();
    const templateTolMap = new Map<string, any>();
    if (templateIds.length) {
      const [{ data: tDays }, { data: tInfo }] = await Promise.all([
        supabase.from("schedule_template_days")
          .select("template_id, day_of_week, clock_in_time, lunch_out_time, lunch_in_time, clock_out_time, is_day_off")
          .in("template_id", templateIds),
        supabase.from("schedule_templates")
          .select("id, tolerance_late_minutes, tolerance_overtime_minutes, tolerance_early_entry_minutes")
          .in("id", templateIds),
      ]);
      for (const td of tDays || []) templateDayMap.set(`${td.template_id}:${td.day_of_week}`, td);
      for (const t of tInfo || []) templateTolMap.set(t.id, t);
    }

    const empMap = new Map<string, any>();
    for (const e of employees) empMap.set(e.id, e);

    type Kind = "overtime" | "early_entry" | "day_off_work" | "holiday_work" | "vacation_work";
    type Row = {
      employee_id: string; record_date: string; kind: Kind; minutes: number;
      status: "pending"; time_clock_record_id: string; tolerance_applied_minutes: number;
    };

    const rows: Row[] = [];
    const evaluations: any[] = [];
    let reviewDays = 0;

    for (const rec of records) {
      const emp = empMap.get(rec.employee_id);
      if (!emp) continue;
      const recDate: string = rec.record_date;
      if (isLocked(rec.employee_id, recDate)) continue;

      const hasPunch = !!(rec.clock_in || rec.clock_out || rec.lunch_in || rec.lunch_out);
      if (!hasPunch) continue;

      const dow = new Date(recDate + "T12:00:00Z").getUTCDay();
      const override = overrideMap.get(`${rec.employee_id}:${dow}`);
      const tDay = emp.schedule_template_id
        ? templateDayMap.get(`${emp.schedule_template_id}:${dow}`)
        : null;
      const schedule: ScheduleLike | null = override || tDay || null;
      const tol = emp.schedule_template_id ? templateTolMap.get(emp.schedule_template_id) : null;

      const isVacation = vacationSet.has(`${rec.employee_id}:${recDate}`);
      const isHoliday = isHolidayOn(recDate);
      const isAbsence = absenceSet.has(`${rec.employee_id}:${recDate}`);

      const ev = evaluateDay(rec, schedule, tol);

      // Apuramento persistido — a fonte única do débito no fecho mensal.
      // Férias, feriados e faltas confirmadas nunca produzem débito.
      const neutralDay = isVacation || isHoliday || isAbsence || !schedule || !!schedule.is_day_off;
      evaluations.push({
        employee_id: rec.employee_id,
        record_date: recDate,
        scheduled_minutes: neutralDay ? 0 : ev.scheduled,
        worked_minutes: ev.worked,
        deficit_minutes: neutralDay ? 0 : ev.deficitMinutes,
        overtime_candidate_minutes: neutralDay ? 0 : ev.overtimeCandidateMinutes,
        early_entry_candidate_minutes: neutralDay ? 0 : ev.earlyEntryCandidateMinutes,
        needs_review: neutralDay ? false : ev.needsReview,
        review_reasons: neutralDay ? [] : ev.reviewReasons,
        is_day_off: !!schedule?.is_day_off,
        no_record: ev.noRecord,
        engine_version: ENGINE_VERSION,
        computed_at: new Date().toISOString(),
      });
      if (!neutralDay && ev.needsReview) reviewDays++;

      // Trabalho excecional (férias > feriado > folga): minutos efetivos.
      if (isVacation || isHoliday || !schedule || schedule.is_day_off) {
        const inTs = rec.clock_in;
        const outTs = rec.clock_out || rec.lunch_in || rec.lunch_out;
        if (!inTs || !outTs) continue;
        let worked = Math.max(0, timestampToLisbonMinutes(outTs) - timestampToLisbonMinutes(inTs));
        if (rec.lunch_out && rec.lunch_in) {
          worked -= Math.max(0, timestampToLisbonMinutes(rec.lunch_in) - timestampToLisbonMinutes(rec.lunch_out));
        }
        worked = Math.max(0, worked);
        if (worked <= 0) continue;
        const kind: Kind = isVacation ? "vacation_work" : isHoliday ? "holiday_work" : "day_off_work";
        rows.push({
          employee_id: rec.employee_id, record_date: recDate, kind, minutes: worked,
          status: "pending", time_clock_record_id: rec.id, tolerance_applied_minutes: 0,
        });
        continue;
      }

      // Dia normal: só se estiver validado. Dias por rever não geram candidatos.
      if (ev.needsReview) continue;

      if (ev.overtimeCandidateMinutes > 0) {
        rows.push({
          employee_id: rec.employee_id, record_date: recDate, kind: "overtime",
          minutes: ev.overtimeCandidateMinutes, status: "pending",
          time_clock_record_id: rec.id,
          tolerance_applied_minutes: tol?.tolerance_overtime_minutes ?? 15,
        });
      }
      if (ev.earlyEntryCandidateMinutes > 0) {
        rows.push({
          employee_id: rec.employee_id, record_date: recDate, kind: "early_entry",
          minutes: ev.earlyEntryCandidateMinutes, status: "pending",
          time_clock_record_id: rec.id,
          tolerance_applied_minutes: tol?.tolerance_early_entry_minutes ?? 0,
        });
      }
    }

    // Grava o apuramento (recalculável, idempotente por funcionário+dia).
    let evaluationsWritten = 0;
    const CHUNK = 500;
    for (let i = 0; i < evaluations.length; i += CHUNK) {
      const slice = evaluations.slice(i, i + CHUNK);
      const { error } = await supabase
        .from("attendance_daily_evaluations")
        .upsert(slice, { onConflict: "employee_id,record_date" });
      if (error) throw error;
      evaluationsWritten += slice.length;
    }

    if (!rows.length) {
      return new Response(
        JSON.stringify({ ...empty, evaluations_written: evaluationsWritten, review_days: reviewDays }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Deduplicação por (funcionário, dia, tipo) antes do upsert.
    const dedupMap = new Map<string, Row>();
    for (const r of rows) {
      const key = `${r.employee_id}:${r.record_date}:${r.kind}`;
      const existing = dedupMap.get(key);
      if (!existing || r.minutes > existing.minutes) dedupMap.set(key, r);
    }
    const dedupedRows = Array.from(dedupMap.values());

    const { data: existing, error: exErr } = await supabase
      .from("overtime_approvals")
      .select("employee_id, record_date, kind")
      .in("employee_id", [...new Set(dedupedRows.map((r) => r.employee_id))])
      .in("record_date", [...new Set(dedupedRows.map((r) => r.record_date))]);
    if (exErr) throw exErr;
    const existingSet = new Set((existing || []).map((e: any) => `${e.employee_id}:${e.record_date}:${e.kind}`));
    const newRows = dedupedRows.filter((r) => !existingSet.has(`${r.employee_id}:${r.record_date}:${r.kind}`));

    // Idempotente: nunca sobrepõe uma linha já decidida.
    for (let i = 0; i < dedupedRows.length; i += CHUNK) {
      const { error: upErr } = await supabase
        .from("overtime_approvals")
        .upsert(dedupedRows.slice(i, i + CHUNK), {
          onConflict: "employee_id,record_date,kind", ignoreDuplicates: true,
        });
      if (upErr) throw upErr;
    }

    const byKind: Record<string, number> = {};
    for (const r of newRows) byKind[r.kind] = (byKind[r.kind] || 0) + 1;
    const createdCount = newRows.length;

    if (createdCount > 0) {
      const labels: Record<string, string> = {
        overtime: "hora(s) extra", early_entry: "entrada(s) antecipada(s)",
        day_off_work: "trabalho(s) em folga", holiday_work: "trabalho(s) em feriado",
        vacation_work: "trabalho(s) em férias",
      };
      const parts = Object.entries(byKind).map(([k, v]) => `${v} ${labels[k] || k}`);
      const scope = dates.length === 1 ? dates[0] : `${rangeStart} → ${rangeEnd}`;
      await supabase.from("admin_notifications").insert({
        title: "Aprovações de horas pendentes",
        message: `${createdCount} candidato(s) detetado(s) em ${scope}: ${parts.join(", ")}. Reveja na aba de Aprovações.`,
        type: "overtime_pending",
      });
    }

    return new Response(
      JSON.stringify({
        from: rangeStart, to: rangeEnd, days: dates.length,
        candidates_detected: dedupedRows.length,
        already_existing: dedupedRows.length - createdCount,
        created: createdCount,
        evaluations_written: evaluationsWritten,
        review_days: reviewDays,
        by_kind: byKind,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
