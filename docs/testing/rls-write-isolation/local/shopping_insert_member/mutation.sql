ALTER POLICY shopping_insert_member ON public.pantry_shopping_items WITH CHECK (created_by = auth.uid());
