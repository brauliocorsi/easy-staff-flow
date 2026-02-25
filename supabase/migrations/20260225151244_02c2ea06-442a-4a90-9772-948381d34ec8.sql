
-- Rename cpf to nif
ALTER TABLE public.employees RENAME COLUMN cpf TO nif;

-- Add niss column
ALTER TABLE public.employees ADD COLUMN niss TEXT;

-- Rename address columns to Portuguese
ALTER TABLE public.employees RENAME COLUMN address_street TO morada;
ALTER TABLE public.employees RENAME COLUMN address_city TO cidade;
ALTER TABLE public.employees RENAME COLUMN address_state TO distrito;
ALTER TABLE public.employees RENAME COLUMN address_zip TO codigo_postal;
