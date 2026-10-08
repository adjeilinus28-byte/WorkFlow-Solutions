// Edge functions are deployed from their own folder, so site-publish uses
// copies of the renderer and defaults. Run this after changing either;
// npm test fails if the copies drift.
import { copyFileSync } from 'node:fs'
const root = new URL('../', import.meta.url)
copyFileSync(new URL('shared/render.js', root), new URL('supabase/functions/_shared/render.js', root))
copyFileSync(new URL('content/defaults.json', root), new URL('supabase/functions/_shared/defaults.json', root))
console.log('Copied shared/render.js and content/defaults.json into supabase/functions/_shared/')
