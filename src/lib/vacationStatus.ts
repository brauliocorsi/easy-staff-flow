// Considera uma férias como "gozada" se estiver explicitamente marcada
// ou se a data de término já passou (anterior a hoje).
export function isVacationEnjoyed(v: { enjoyed?: boolean | null; end_date?: string | null; status?: string | null; sell_status?: string | null }): boolean {
  if (!v) return false;
  if (v.enjoyed) return true;
  if (v.sell_status) return false;
  if (v.status === "rejected" || v.status === "pending") return false;
  if (!v.end_date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(v.end_date);
  end.setHours(0, 0, 0, 0);
  return end < today;
}