# Website admin

**https://workflow-app.net/admin** — edit the website, publish it, and work the leads from the contact form.

| Role | Can |
|---|---|
| Admin | everything, including People and the Activity log |
| Editor | Website content, Publish, Publish history |
| Sales | the Leads inbox |

Logins are shared with the WFS-Ops-Platform Supabase project, but access is separate: a website role gives nothing in the ops platform, and an ops role gives nothing here. People added from the admin are marked `website` in their Supabase app metadata, so the ops platform creates no profile for them and they have no ops access.

## How publishing works

1. Editors change the **draft** (Supabase table `site_content`). The live site doesn't change.
2. **Preview** renders the page with the same code the build uses (`shared/render.js`).
3. **Publish** (edge function `site-publish`) checks the draft, saves it as a numbered version (`site_publications`) and calls the Netlify build hook.
4. Netlify runs `npm run build`: `scripts/build-site.mjs` fetches the latest version and renders it into the marked regions of `index.html` (`<!--cms:…-->`), then the admin app is built into `/admin`. Live in about a minute.

If the content were ever invalid, the build fails on purpose and Netlify keeps the current site live. **Publish history** can load any earlier version back into the draft.

The contact form posts to the `site-lead` edge function, which stores the message in `site_leads` and (with a Brevo key) emails an alert. If that function is down, the form falls back to Netlify Forms so nothing is lost.

## One-time setup

1. **Netlify build hook** — Netlify → *Project configuration → Build & deploy → Continuous deployment → Build hooks → Add build hook* (name it "Admin publish", branch `main`). Copy its URL (or the whole `curl` line Netlify shows) into Supabase → WFS-Ops-Platform → *Edge Functions → Secrets* as `NETLIFY_BUILD_HOOK_URL`. Until then, Publish saves the version and the site picks it up on the next deploy.
2. **Sign-in links** — Supabase → *Authentication → URL Configuration → Redirect URLs*: add `https://workflow-app.net/admin/` (and `https://*--workflowsolution.netlify.app/admin/` for deploy previews). Invite and password-reset emails land back in the admin.
3. **Lead alert emails** (optional) — Brevo → *SMTP & API → API keys*: create a key and add it to the Supabase secrets as `BREVO_API_KEY`. Alerts go to `admin@workflow-app.net` from the verified sender `admin@workflow-app.net`; change with `LEAD_ALERT_EMAIL` / `LEAD_ALERT_FROM`.
4. **Two database functions** — run `supabase/manual/site_delete_functions.sql` in the Supabase SQL editor. They delete a lead and remove a person's access; until they're added, those two buttons say a database update is needed.

The first admin is `adjeilinus28@gmail.com`, with the same password as the ops platform ("Forgot your password?" works once step 2 is done).

## Working on it

```bash
npm install
npm test                 # renderer: defaults reproduce index.html byte for byte, escaping, validation
npm run build:local      # builds dist/ with content/defaults.json, offline
npm run dev:admin        # the admin at http://localhost:5173/admin/ (uses the real Supabase project)
deno test --allow-env --allow-read supabase/functions/tests/
```

- Changed `shared/render.js` or `content/defaults.json`? Run `npm run sync:functions` (the `site-publish` function uses copies) and redeploy it.
- Deploy functions with the Supabase CLI: `supabase functions deploy site-publish`, `supabase functions deploy site-admin`, `supabase functions deploy site-lead --no-verify-jwt` (the form is public; it checks the origin, a honeypot and a rate limit itself).
- Database: `supabase/migrations/20261008120000_site_admin.sql`. Tables are closed to direct access; everything goes through functions that check the caller's role.
- Making something else editable: wrap it in `<!--cms:name-->…<!--/cms:name-->` in `index.html`, add its renderer and defaults, add an editor tab in `admin/src/pages/Content.jsx`, and allow the section name in the `site_content` check.
