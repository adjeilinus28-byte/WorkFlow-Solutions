-- ============================================================
-- Website admin for workflow-app.net/admin — October 2026
--
-- Lives in the WFS-Ops-Platform Supabase project and shares only the logins
-- with it. Who may do what in the website admin is decided by site_users
-- alone — never by profiles.role — so ops-platform roles grant nothing here,
-- and website roles grant nothing in the ops platform.
--
--   site_users         who can open the admin, as admin / editor / sales
--   site_content       the draft: one row per section of the home page
--   site_publications  every published version (history, restore)
--   site_leads         contact-form messages (inserted by the site-lead function)
--   site_activity      who did what, when
--
-- Tables have RLS on and no policies: everything goes through the functions
-- below, which check the caller's role first.
--
-- Add an admin by login email (SQL editor):
--   INSERT INTO site_users (user_id, role)
--   SELECT id, 'admin' FROM auth.users WHERE lower(email) = '<email>'
--   ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
--
-- Safe to re-run.
-- ============================================================

-- ── Who can use the admin ──
CREATE TABLE IF NOT EXISTS public.site_users (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('admin', 'editor', 'sales')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.site_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.site_users FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.site_require(p_roles text[])
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE r text;
BEGIN
  SELECT role INTO r FROM site_users WHERE user_id = auth.uid();
  IF r IS NULL OR NOT (r = ANY (p_roles)) THEN
    RAISE EXCEPTION 'You don''t have access to this part of the website admin' USING ERRCODE = '42501';
  END IF;
  RETURN r;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.site_require(text[]) FROM PUBLIC, anon, authenticated;

-- ── Activity log ──
CREATE TABLE IF NOT EXISTS public.site_activity (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at         timestamptz NOT NULL DEFAULT now(),
  user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,
  action     text NOT NULL,
  detail     jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS site_activity_at_idx ON public.site_activity (at DESC);
ALTER TABLE public.site_activity ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.site_activity FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.site_log(p_action text, p_detail jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  INSERT INTO site_activity (user_id, user_email, action, detail)
  VALUES (auth.uid(), (SELECT email FROM auth.users WHERE id = auth.uid()), p_action, coalesce(p_detail, '{}'::jsonb));
$$;
REVOKE EXECUTE ON FUNCTION public.site_log(text, jsonb) FROM PUBLIC, anon, authenticated;

-- ── Draft content ──
CREATE TABLE IF NOT EXISTS public.site_content (
  section    text PRIMARY KEY CHECK (section IN ('announcement', 'hero', 'products', 'video', 'pricing', 'faq', 'contact')),
  data       jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.site_content FROM anon, authenticated;

-- ── Published versions ──
CREATE TABLE IF NOT EXISTS public.site_publications (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  content            jsonb NOT NULL CHECK (jsonb_typeof(content) = 'object'),
  note               text CHECK (char_length(note) <= 200),
  published_at       timestamptz NOT NULL DEFAULT now(),
  published_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  published_by_email text,
  -- pending: saved, build not requested yet · triggered: Netlify is building
  -- no_hook: the build hook isn't set up · failed: the hook call failed
  deploy_status      text NOT NULL DEFAULT 'pending' CHECK (deploy_status IN ('pending', 'triggered', 'no_hook', 'failed')),
  deploy_error       text
);
ALTER TABLE public.site_publications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.site_publications FROM anon, authenticated;

-- ── Leads ──
CREATE TABLE IF NOT EXISTS public.site_leads (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  first_name   text NOT NULL CHECK (char_length(first_name) BETWEEN 1 AND 80),
  last_name    text NOT NULL CHECK (char_length(last_name) BETWEEN 1 AND 80),
  email        text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 200),
  organisation text CHECK (char_length(organisation) <= 160),
  inquiry_type text CHECK (char_length(inquiry_type) <= 60),
  message      text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 5000),
  status       text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'demo_booked', 'trial', 'won', 'lost', 'spam')),
  notes        text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 5000),
  source       text CHECK (char_length(source) <= 300),
  ip_hash      text,   -- a salted hash, only for rate limiting; never the address itself
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS site_leads_created_idx ON public.site_leads (created_at DESC);
CREATE INDEX IF NOT EXISTS site_leads_status_idx ON public.site_leads (status);
CREATE INDEX IF NOT EXISTS site_leads_ip_idx ON public.site_leads (ip_hash, created_at);
ALTER TABLE public.site_leads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.site_leads FROM anon, authenticated;

-- ============================================================
-- Functions the admin calls. Each checks the caller's role first.
-- ============================================================

-- Who am I here? role is null for someone with no admin access.
CREATE OR REPLACE FUNCTION public.site_me()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'user_id', auth.uid(),
    'email', (SELECT email FROM auth.users WHERE id = auth.uid()),
    'role', (SELECT role FROM site_users WHERE user_id = auth.uid()));
$$;

-- The draft, with where it stands against the live site
CREATE OR REPLACE FUNCTION public.site_get_content()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  draft jsonb;
  meta  jsonb;
  pub   site_publications;
BEGIN
  PERFORM site_require(ARRAY['admin', 'editor']);
  SELECT coalesce(jsonb_object_agg(section, data), '{}'::jsonb) INTO draft FROM site_content;
  SELECT coalesce(jsonb_object_agg(c.section, jsonb_build_object('updated_at', c.updated_at, 'updated_by', u.email)), '{}'::jsonb)
    INTO meta FROM site_content c LEFT JOIN auth.users u ON u.id = c.updated_by;
  SELECT * INTO pub FROM site_publications ORDER BY id DESC LIMIT 1;
  RETURN jsonb_build_object(
    'content', draft,
    'sections', meta,
    'published', CASE WHEN pub.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', pub.id, 'published_at', pub.published_at, 'published_by', pub.published_by_email,
      'deploy_status', pub.deploy_status, 'deploy_error', pub.deploy_error) END,
    'unpublished_changes', pub.id IS NULL OR pub.content IS DISTINCT FROM draft);
END;
$$;

-- Save one section of the draft. Pass the updated_at you loaded, and the save
-- is refused if someone else saved that section in the meantime.
CREATE OR REPLACE FUNCTION public.site_save_section(p_section text, p_data jsonb, p_expected_updated_at timestamptz DEFAULT NULL)
RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  current_at timestamptz;
  saved_at   timestamptz;
BEGIN
  PERFORM site_require(ARRAY['admin', 'editor']);
  IF p_data IS NULL OR jsonb_typeof(p_data) <> 'object' THEN
    RAISE EXCEPTION 'Nothing to save' USING ERRCODE = '22023';
  END IF;
  IF octet_length(p_data::text) > 200000 THEN
    RAISE EXCEPTION 'That section is too large to save' USING ERRCODE = '22023';
  END IF;
  SELECT updated_at INTO current_at FROM site_content WHERE section = p_section FOR UPDATE;
  IF p_expected_updated_at IS NOT NULL AND current_at IS NOT NULL AND current_at <> p_expected_updated_at THEN
    RAISE EXCEPTION 'Someone else saved this section after you opened it. Reload to see their changes.' USING ERRCODE = '40001';
  END IF;
  INSERT INTO site_content (section, data, updated_at, updated_by)
  VALUES (p_section, p_data, now(), auth.uid())
  ON CONFLICT (section) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, updated_by = excluded.updated_by
  RETURNING updated_at INTO saved_at;
  PERFORM site_log('content.save', jsonb_build_object('section', p_section));
  RETURN saved_at;
END;
$$;

-- Snapshot the draft as a new published version. The site-publish function
-- calls this with the editor's own login, then asks Netlify to rebuild.
CREATE OR REPLACE FUNCTION public.site_create_publication(p_note text DEFAULT NULL)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  snapshot jsonb;
  new_id   bigint;
BEGIN
  PERFORM site_require(ARRAY['admin', 'editor']);
  SELECT jsonb_object_agg(section, data) INTO snapshot FROM site_content;
  IF snapshot IS NULL THEN
    RAISE EXCEPTION 'There is no content to publish yet' USING ERRCODE = '22023';
  END IF;
  INSERT INTO site_publications (content, note, published_by, published_by_email)
  VALUES (snapshot, nullif(left(trim(p_note), 200), ''), auth.uid(), (SELECT email FROM auth.users WHERE id = auth.uid()))
  RETURNING id INTO new_id;
  PERFORM site_log('publish', jsonb_build_object('publication_id', new_id, 'note', p_note));
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.site_publications_list(p_limit int DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM site_require(ARRAY['admin', 'editor']);
  RETURN coalesce((SELECT jsonb_agg(row_to_json(p) ORDER BY p.id DESC) FROM (
    SELECT id, note, published_at, published_by_email AS published_by, deploy_status, deploy_error
    FROM site_publications ORDER BY id DESC LIMIT least(greatest(p_limit, 1), 200)) p), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.site_publication_get(p_id bigint)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM site_require(ARRAY['admin', 'editor']);
  RETURN (SELECT jsonb_build_object('id', id, 'content', content, 'published_at', published_at, 'published_by', published_by_email, 'note', note)
          FROM site_publications WHERE id = p_id);
END;
$$;

-- Load a published version back into the draft (then Publish to put it live)
CREATE OR REPLACE FUNCTION public.site_restore_publication(p_id bigint)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  snap jsonb;
  k    text;
BEGIN
  PERFORM site_require(ARRAY['admin', 'editor']);
  SELECT content INTO snap FROM site_publications WHERE id = p_id;
  IF snap IS NULL THEN
    RAISE EXCEPTION 'That version no longer exists' USING ERRCODE = 'P0002';
  END IF;
  FOR k IN SELECT jsonb_object_keys(snap) LOOP
    IF k IN ('announcement', 'hero', 'products', 'video', 'pricing', 'faq', 'contact') AND jsonb_typeof(snap -> k) = 'object' THEN
      INSERT INTO site_content (section, data, updated_at, updated_by)
      VALUES (k, snap -> k, now(), auth.uid())
      ON CONFLICT (section) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, updated_by = excluded.updated_by;
    END IF;
  END LOOP;
  PERFORM site_log('content.restore', jsonb_build_object('publication_id', p_id));
END;
$$;

-- What the live site shows. Public on purpose: it is the website's own text,
-- read by the Netlify build.
CREATE OR REPLACE FUNCTION public.site_published_content()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object('id', id, 'content', content, 'published_at', published_at)
  FROM site_publications ORDER BY id DESC LIMIT 1;
$$;

-- ── Leads ──
CREATE OR REPLACE FUNCTION public.site_leads_list(p_status text DEFAULT NULL, p_search text DEFAULT NULL, p_limit int DEFAULT 100, p_offset int DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  -- chr(37) is the LIKE wildcard: "contains the search text"
  pat text := CASE WHEN nullif(trim(p_search), '') IS NULL THEN NULL ELSE chr(37) || trim(p_search) || chr(37) END;
BEGIN
  PERFORM site_require(ARRAY['admin', 'sales']);
  RETURN jsonb_build_object(
    'total', (SELECT count(*) FROM site_leads l
              WHERE (p_status IS NULL OR l.status = p_status)
                AND (pat IS NULL OR l.first_name || ' ' || l.last_name || ' ' || l.email || ' ' || coalesce(l.organisation, '') || ' ' || l.message ILIKE pat)),
    'counts', (SELECT coalesce(jsonb_object_agg(status, n), '{}'::jsonb) FROM (SELECT status, count(*) n FROM site_leads GROUP BY status) s),
    'leads', coalesce((SELECT jsonb_agg(row_to_json(x) ORDER BY x.created_at DESC) FROM (
      SELECT l.id, l.created_at, l.first_name, l.last_name, l.email, l.organisation, l.inquiry_type, l.message,
             l.status, l.notes, l.source, l.updated_at, u.email AS updated_by
      FROM site_leads l LEFT JOIN auth.users u ON u.id = l.updated_by
      WHERE (p_status IS NULL OR l.status = p_status)
        AND (pat IS NULL OR l.first_name || ' ' || l.last_name || ' ' || l.email || ' ' || coalesce(l.organisation, '') || ' ' || l.message ILIKE pat)
      ORDER BY l.created_at DESC
      LIMIT least(greatest(p_limit, 1), 500) OFFSET greatest(p_offset, 0)) x), '[]'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.site_lead_update(p_id uuid, p_status text, p_notes text)
RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  old_status text;
  saved_at   timestamptz;
BEGIN
  PERFORM site_require(ARRAY['admin', 'sales']);
  SELECT status INTO old_status FROM site_leads WHERE id = p_id FOR UPDATE;
  IF old_status IS NULL THEN
    RAISE EXCEPTION 'That lead no longer exists' USING ERRCODE = 'P0002';
  END IF;
  UPDATE site_leads SET status = p_status, notes = coalesce(p_notes, ''), updated_at = now(), updated_by = auth.uid()
  WHERE id = p_id RETURNING updated_at INTO saved_at;
  PERFORM site_log('lead.update', jsonb_build_object('lead_id', p_id, 'from', old_status, 'to', p_status));
  RETURN saved_at;
END;
$$;

-- For spam, or when someone asks for their details to be erased
CREATE OR REPLACE FUNCTION public.site_lead_delete(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE who text;
BEGIN
  PERFORM site_require(ARRAY['admin']);
  DELETE FROM site_leads WHERE id = p_id RETURNING email INTO who;
  IF who IS NULL THEN
    RAISE EXCEPTION 'That lead no longer exists' USING ERRCODE = 'P0002';
  END IF;
  PERFORM site_log('lead.delete', jsonb_build_object('lead_id', p_id));
END;
$$;

-- ── Admin users ──
CREATE OR REPLACE FUNCTION public.site_users_list()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM site_require(ARRAY['admin']);
  RETURN coalesce((SELECT jsonb_agg(row_to_json(x) ORDER BY x.email) FROM (
    SELECT s.user_id, u.email, s.role, s.created_at, u.last_sign_in_at,
           u.email_confirmed_at IS NOT NULL AS confirmed
    FROM site_users s JOIN auth.users u ON u.id = s.user_id) x), '[]'::jsonb);
END;
$$;

-- Give someone who already has a login (from the ops platform, say) access.
-- Returns false when there's no login with that email, so the admin can
-- invite them instead (the site-admin function creates the login).
CREATE OR REPLACE FUNCTION public.site_user_add_existing(p_email text, p_role text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE uid uuid;
BEGIN
  PERFORM site_require(ARRAY['admin']);
  IF p_role NOT IN ('admin', 'editor', 'sales') THEN
    RAISE EXCEPTION 'Unknown role' USING ERRCODE = '22023';
  END IF;
  SELECT id INTO uid FROM auth.users WHERE lower(email) = lower(trim(p_email));
  IF uid IS NULL THEN RETURN false; END IF;
  INSERT INTO site_users (user_id, role, created_by) VALUES (uid, p_role, auth.uid())
  ON CONFLICT (user_id) DO UPDATE SET role = excluded.role;
  PERFORM site_log('user.add', jsonb_build_object('email', lower(trim(p_email)), 'role', p_role));
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.site_user_set_role(p_user uuid, p_role text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE old_role text;
BEGIN
  PERFORM site_require(ARRAY['admin']);
  IF p_role NOT IN ('admin', 'editor', 'sales') THEN
    RAISE EXCEPTION 'Unknown role' USING ERRCODE = '22023';
  END IF;
  SELECT role INTO old_role FROM site_users WHERE user_id = p_user FOR UPDATE;
  IF old_role IS NULL THEN
    RAISE EXCEPTION 'That person no longer has access' USING ERRCODE = 'P0002';
  END IF;
  IF old_role = 'admin' AND p_role <> 'admin' AND (SELECT count(*) FROM site_users WHERE role = 'admin') <= 1 THEN
    RAISE EXCEPTION 'The admin needs at least one admin. Make someone else an admin first.' USING ERRCODE = '23514';
  END IF;
  UPDATE site_users SET role = p_role WHERE user_id = p_user;
  PERFORM site_log('user.role', jsonb_build_object('email', (SELECT email FROM auth.users WHERE id = p_user), 'from', old_role, 'to', p_role));
END;
$$;

-- Removes admin access only; their login (and any ops-platform access) stays.
CREATE OR REPLACE FUNCTION public.site_user_remove(p_user uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE old_role text;
BEGIN
  PERFORM site_require(ARRAY['admin']);
  SELECT role INTO old_role FROM site_users WHERE user_id = p_user FOR UPDATE;
  IF old_role IS NULL THEN RETURN; END IF;
  IF old_role = 'admin' AND (SELECT count(*) FROM site_users WHERE role = 'admin') <= 1 THEN
    RAISE EXCEPTION 'You can''t remove the last admin.' USING ERRCODE = '23514';
  END IF;
  DELETE FROM site_users WHERE user_id = p_user;
  PERFORM site_log('user.remove', jsonb_build_object('email', (SELECT email FROM auth.users WHERE id = p_user), 'role', old_role));
END;
$$;

CREATE OR REPLACE FUNCTION public.site_activity_list(p_limit int DEFAULT 100)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM site_require(ARRAY['admin']);
  RETURN coalesce((SELECT jsonb_agg(row_to_json(a) ORDER BY a.at DESC) FROM (
    SELECT id, at, user_email, action, detail FROM site_activity ORDER BY at DESC LIMIT least(greatest(p_limit, 1), 500)) a), '[]'::jsonb);
END;
$$;

-- ── Who may call what ──
-- New functions are callable by everyone by default; lock each one down.
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'site_me()', 'site_get_content()', 'site_save_section(text, jsonb, timestamptz)',
    'site_create_publication(text)', 'site_publications_list(int)', 'site_publication_get(bigint)',
    'site_restore_publication(bigint)', 'site_leads_list(text, text, int, int)', 'site_lead_update(uuid, text, text)',
    'site_lead_delete(uuid)', 'site_users_list()', 'site_user_add_existing(text, text)',
    'site_user_set_role(uuid, text)', 'site_user_remove(uuid)', 'site_activity_list(int)'
  ] LOOP
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.' || f || ' FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.' || f || ' TO authenticated';
  END LOOP;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.site_published_content() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.site_published_content() TO anon, authenticated;
