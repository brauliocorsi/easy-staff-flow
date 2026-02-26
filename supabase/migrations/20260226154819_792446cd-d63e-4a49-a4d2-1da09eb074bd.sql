ALTER TABLE public.vacation_requests 
  ADD COLUMN sold_days integer NOT NULL DEFAULT 0,
  ADD COLUMN sell_status text DEFAULT NULL;