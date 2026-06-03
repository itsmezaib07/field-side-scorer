
CREATE OR REPLACE FUNCTION public.set_last_modified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.last_modified_at := now();
  NEW.last_modified_by := auth.uid();
  RETURN NEW;
END;
$$;
