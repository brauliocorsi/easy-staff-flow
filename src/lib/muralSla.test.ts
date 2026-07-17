import { describe, it, expect } from "vitest";
import { computeSla } from "./muralSla";

describe("computeSla", () => {
  const now = new Date("2026-07-17T12:00:00Z");

  it("returns none when there is no due date", () => {
    expect(computeSla(null, "todo", null, now).status).toBe("none");
  });

  it("marks overdue when past due and not done", () => {
    expect(computeSla("2026-07-10", "in_progress", null, now).status).toBe("overdue");
  });

  it("marks due_soon within 3 days", () => {
    expect(computeSla("2026-07-18", "todo", null, now).status).toBe("due_soon");
  });

  it("marks on_track when >3 days out", () => {
    expect(computeSla("2026-07-30", "todo", null, now).status).toBe("on_track");
  });

  it("marks done_on_time when completed before due", () => {
    expect(computeSla("2026-07-20", "done", "2026-07-15T10:00:00Z", now).status).toBe("done_on_time");
  });

  it("marks done_late when completed after due", () => {
    expect(computeSla("2026-07-10", "done", "2026-07-15T10:00:00Z", now).status).toBe("done_late");
  });
});