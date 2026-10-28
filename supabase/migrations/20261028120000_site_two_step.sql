-- Website admin: 2-step sign-in.
--
-- Everyone with a website role signs in with their password and then a code
-- from an authenticator app. Supabase marks a session that has passed the
-- second step as 'aal2' in its token; every website admin check now requires
-- it. Only the website admin's own checks change: the ops platform shares
-- these logins and keeps signing in as before.

-- The gate every admin function goes through
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
  IF coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' THEN
    RAISE EXCEPTION 'Finish signing in with the code from your authenticator app first' USING ERRCODE = '42501';
  END IF;
  RETURN r;
END;
$$;

-- Screenshot uploads (storage policies)
CREATE OR REPLACE FUNCTION public.site_can_edit()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
     AND EXISTS (SELECT 1 FROM site_users WHERE user_id = auth.uid() AND role IN ('admin', 'editor'))
$$;

-- Who am I here? The role only counts once the second step is done, so the
-- site-admin and site-publish functions (which check it) need it too.
-- has_role tells the sign-in screens whether to ask for the code at all.
CREATE OR REPLACE FUNCTION public.site_me()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'user_id', auth.uid(),
    'email', (SELECT email FROM auth.users WHERE id = auth.uid()),
    'has_role', EXISTS (SELECT 1 FROM site_users WHERE user_id = auth.uid()),
    'aal', coalesce(auth.jwt() ->> 'aal', 'aal1'),
    'role', CASE WHEN coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
                 THEN (SELECT role FROM site_users WHERE user_id = auth.uid()) END);
$$;

-- People, with whether each has 2-step set up
CREATE OR REPLACE FUNCTION public.site_users_list()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM site_require(ARRAY['admin']);
  RETURN coalesce((SELECT jsonb_agg(row_to_json(x) ORDER BY x.email) FROM (
    SELECT s.user_id, u.email, s.role, s.created_at, u.last_sign_in_at,
           u.email_confirmed_at IS NOT NULL AS confirmed,
           EXISTS (SELECT 1 FROM auth.mfa_factors f WHERE f.user_id = s.user_id AND f.status = 'verified') AS two_step
    FROM site_users s JOIN auth.users u ON u.id = s.user_id) x), '[]'::jsonb);
END;
$$;

-- For someone who has lost their phone: clears the authenticator they set up
-- here, and they set up a new one at their next sign-in. Admins only, never
-- their own (a sole admin who loses theirs removes it in the Supabase
-- dashboard), and only for people with website access.
--
-- Logins are shared with the ops platform, so only the authenticator apps
-- created by the website admin's setup screen (named "WorkFlow website
-- admin …") are removed. Any other 2-step method on the login, such as one
-- the ops platform relies on, is never touched: otherwise a website admin
-- could add an ops user here and strip their ops-platform 2-step.
CREATE OR REPLACE FUNCTION public.site_user_reset_two_step(p_user uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE removed int;
BEGIN
  PERFORM site_require(ARRAY['admin']);
  IF p_user = auth.uid() THEN
    RAISE EXCEPTION 'Ask another admin to reset your own 2-step' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM site_users WHERE user_id = p_user) THEN
    RAISE EXCEPTION 'That person no longer has access' USING ERRCODE = 'P0002';
  END IF;
  DELETE FROM auth.mfa_factors
  WHERE user_id = p_user AND factor_type = 'totp' AND friendly_name LIKE 'WorkFlow website admin%';
  GET DIAGNOSTICS removed = ROW_COUNT;
  IF removed = 0 THEN
    RAISE EXCEPTION 'Their 2-step wasn''t set up in the website admin, so it can only be reset where it was set up' USING ERRCODE = 'P0002';
  END IF;
  PERFORM site_log('user.reset_two_step', jsonb_build_object('email', (SELECT email FROM auth.users WHERE id = p_user)));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.site_user_reset_two_step(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.site_user_reset_two_step(uuid) TO authenticated;
