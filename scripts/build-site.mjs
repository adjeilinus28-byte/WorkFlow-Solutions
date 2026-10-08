// Builds the public site into dist/ with the content last published from the
// admin. Netlify runs this on every deploy, including when the admin's
// Publish button triggers the build hook.
//
//   npm run build          uses the published content (needs the network)
//   npm run build:local    uses content/defaults.json, offline
//
// If the published content can't be loaded or doesn't pass validation, the
// build fails on purpose: Netlify then keeps the current site live instead of
// publishing something broken.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, rmSync } from 'node:fs'
import { renderHome, renderPage, validateContent, withDefaults } from '../shared/render.js'

const root = new URL('../', import.meta.url)
const read = f => readFileSync(new URL(f, root), 'utf8')
const config = JSON.parse(read('site.config.json'))
const defaults = JSON.parse(read('content/defaults.json'))

async function loadPublished() {
  if (process.env.SITE_CONTENT === 'defaults') return null
  const url = `${config.supabaseUrl}/rest/v1/rpc/site_published_content`
  let lastError
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { apikey: config.supabaseAnonKey, Authorization: `Bearer ${config.supabaseAnonKey}`, 'Content-Type': 'application/json' },
        body: '{}',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`)
      return await res.json()
    } catch (err) {
      lastError = err
      await new Promise(r => setTimeout(r, attempt * 1500))
    }
  }
  throw new Error(`Could not load the published content from Supabase (${lastError.message})`)
}

const published = await loadPublished()
const content = withDefaults(published?.content, defaults)
const errors = validateContent(content)
if (errors.length) {
  console.error(`Published version #${published?.id} has problems, so it was not built:\n  - ${errors.join('\n  - ')}`)
  process.exit(1)
}
console.log(published
  ? `Building published version #${published.id} from ${published.published_at}`
  : 'Nothing published yet: building the default content from content/defaults.json')

const dist = new URL('dist/', root)
rmSync(dist, { recursive: true, force: true })
mkdirSync(dist, { recursive: true })

// Everything at the top level that the site serves
const STATIC = /\.(html|png|jpe?g|ico|txt|xml|svg|webp)$/i
for (const f of readdirSync(root)) if (STATIC.test(f) || f === '_headers') copyFileSync(new URL(f, root), new URL(f, dist))

writeFileSync(new URL('index.html', dist), renderHome(read('index.html'), content, defaults))
for (const f of ['privacy.html', 'terms.html']) writeFileSync(new URL(f, dist), renderPage(read(f), content, defaults))
if (published?.published_at) {
  const day = String(published.published_at).slice(0, 10)
  writeFileSync(new URL('sitemap.xml', dist), read('sitemap.xml').replace(/<lastmod>[^<]*<\/lastmod>/, `<lastmod>${day}</lastmod>`))
}
console.log('Site built into dist/')
