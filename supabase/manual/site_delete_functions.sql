-- ============================================================
-- Run once in Supabase → WFS-Ops-Platform → SQL editor.
--
-- The two website-admin functions that remove things: deleting a lead (for
-- spam, or when someone asks to be erased) and removing a person's admin
-- access. They're part of supabase/migrations/20261008120000_site_admin.sql
-- too, but were held back when that was applied, because the Supabase
-- connector asks a person to confirm anything that contains DELETE.
-- Creating them deletes nothing. Safe to re-run.
-- ============================================================

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

REVOKE EXECUTE ON FUNCTION public.site_lead_delete(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.site_lead_delete(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.site_user_remove(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.site_user_remove(uuid) TO authenticated;
