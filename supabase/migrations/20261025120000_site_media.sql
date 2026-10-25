-- Website media: screenshots of each platform's interface, uploaded from the
-- admin and shown on the platform cards.
--
-- The bucket is public to read (the website shows the images to everyone) and
-- only website admins and editors can add, replace or remove files. Ops-platform
-- roles grant nothing here, as with the rest of the website admin.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('site-media', 'site-media', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- True when the signed-in person may edit website content
CREATE OR REPLACE FUNCTION public.site_can_edit()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM site_users WHERE user_id = auth.uid() AND role IN ('admin', 'editor'))
$$;
REVOKE EXECUTE ON FUNCTION public.site_can_edit() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.site_can_edit() TO authenticated;

DROP POLICY IF EXISTS "site-media: editors read" ON storage.objects;
DROP POLICY IF EXISTS "site-media: editors upload" ON storage.objects;
DROP POLICY IF EXISTS "site-media: editors replace" ON storage.objects;
DROP POLICY IF EXISTS "site-media: editors remove" ON storage.objects;

-- Public URLs serve the files without a policy; this lets editors list and
-- manage them through the API
CREATE POLICY "site-media: editors read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'site-media' AND public.site_can_edit());

CREATE POLICY "site-media: editors upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'site-media' AND public.site_can_edit());

CREATE POLICY "site-media: editors replace" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'site-media' AND public.site_can_edit())
  WITH CHECK (bucket_id = 'site-media' AND public.site_can_edit());

CREATE POLICY "site-media: editors remove" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'site-media' AND public.site_can_edit());
