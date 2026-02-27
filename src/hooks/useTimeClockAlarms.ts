import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useTimeClockAlarms() {
  const firedRef = useRef<Set<string>>(new Set());
  const alarmsRef = useRef<{ alarm_time: string; is_active: boolean; label: string }[]>([]);

  // Fetch alarms once on mount
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("time_clock_alarms")
        .select("alarm_time, is_active, label")
        .eq("is_active", true);
      alarmsRef.current = data || [];
    };
    load();
    // Refresh every 5 minutes in case admin changes settings
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const playAlarm = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = "square";
      gain.gain.value = 0.3;
      osc.start();
      // Beep pattern: 3 beeps
      setTimeout(() => { gain.gain.value = 0; }, 300);
      setTimeout(() => { gain.gain.value = 0.3; }, 500);
      setTimeout(() => { gain.gain.value = 0; }, 800);
      setTimeout(() => { gain.gain.value = 0.3; }, 1000);
      setTimeout(() => { gain.gain.value = 0; osc.stop(); ctx.close(); }, 1300);
    } catch {
      // Audio not supported
    }
  }, []);

  // Check every second
  useEffect(() => {
    const check = () => {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      
      for (const alarm of alarmsRef.current) {
        const alarmHHMM = alarm.alarm_time.slice(0, 5);
        if (alarmHHMM === hhmm && !firedRef.current.has(alarmHHMM)) {
          firedRef.current.add(alarmHHMM);
          playAlarm();
        }
      }

      // Reset fired set at midnight
      if (hhmm === "00:00") {
        firedRef.current.clear();
      }
    };

    const interval = setInterval(check, 1000);
    return () => clearInterval(interval);
  }, [playAlarm]);
}
