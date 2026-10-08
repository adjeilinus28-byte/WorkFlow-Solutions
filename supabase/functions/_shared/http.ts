// Shared by the website's edge functions: which sites may call them, and
// JSON responses with the matching CORS headers.

const ALLOWED_ORIGINS = [
  /^https:\/\/workflow-app\.net$/,
  /^https:\/\/www\.workflow-app\.net$/,
  // Netlify deploy previews and branch deploys of the site
  /^https:\/\/([a-z0-9-]+--)?workflowsolution\.netlify\.app$/,
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
]

export function originAllowed(origin: string | null): boolean {
  return !!origin && ALLOWED_ORIGINS.some((re) => re.test(origin))
}

export function corsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': originAllowed(origin) ? origin! : 'https://workflow-app.net',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

export function json(req: Request, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
  })
}

// Answers the browser's CORS pre-check; null means "carry on"
export function preflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) })
  if (req.method !== 'POST') return json(req, 405, { error: 'Use POST' })
  return null
}

export function env(name: string, fallback = ''): string {
  return Deno.env.get(name) ?? fallback
}
