import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Holiday = {
  id: string;
  holiday_date: string;
  name: string;
  description: string | null;
  recurring_yearly: boolean;
};

/**
 * Fetches all holidays and returns:
 *  - holidays: raw rows
 *  - isHoliday(dateStr): true if dateStr (yyyy-mm-dd) matches any holiday,
 *    considering recurring holidays as repeating every year on same MM-DD.
 *  - getHoliday(dateStr): returns the Holiday entry that matched or undefined.
 */
export function useHolidays() {
  const query = useQuery({
    queryKey: ["holidays"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("holidays")
        .select("*")
        .order("holiday_date");
      if (error) throw error;
      return data as Holiday[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const holidays = query.data || [];

  const getHoliday = (dateStr: string): Holiday | undefined => {
    if (!dateStr) return undefined;
    const mmdd = dateStr.slice(5); // MM-DD
    return holidays.find((h) => {
      if (h.holiday_date === dateStr) return true;
      if (h.recurring_yearly && h.holiday_date.slice(5) === mmdd) return true;
      return false;
    });
  };

  const isHoliday = (dateStr: string): boolean => !!getHoliday(dateStr);

  return { ...query, holidays, isHoliday, getHoliday };
}
