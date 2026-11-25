ALTER POLICY items_insert_member ON public.pantry_items WITH CHECK (created_by = auth.uid());
