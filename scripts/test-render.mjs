// npm test — checks the renderer before anything ships.
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { renderHome, renderPage, validateContent, youTubeId, applyContact } from '../shared/render.js'

const read = f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
const defaults = JSON.parse(read('content/defaults.json'))
const home = read('index.html')
const clone = o => JSON.parse(JSON.stringify(o))
let passed = 0
const test = (name, fn) => { fn(); passed++; console.log(`  ✓ ${name}`) }

test('defaults are valid', () => assert.deepEqual(validateContent(defaults), []))

test('rendering the defaults reproduces index.html byte for byte', () => {
  const out = renderHome(home, defaults, defaults)
  if (out !== home) {
    const i = [...out].findIndex((ch, k) => ch !== home[k])
    assert.fail(`first difference at ${i}:\nexpected …${home.slice(i - 80, i + 80)}…\n     got …${out.slice(i - 80, i + 80)}…`)
  }
})

test('privacy and terms are unchanged by the defaults', () => {
  for (const f of ['privacy.html', 'terms.html']) assert.equal(renderPage(read(f), defaults, defaults), read(f))
})

test('rendering is stable when run twice', () => {
  const c = clone(defaults)
  c.hero.sub = 'Changed sub-headline'
  const once = renderHome(home, c, defaults)
  assert.equal(renderHome(once, c, defaults).replace(/\s+/g, ''), once.replace(/\s+/g, ''))
})

test('edits reach the page', () => {
  const c = clone(defaults)
  c.hero.headline_line1 = 'Software that'; c.hero.headline_line2 = 'runs the site'; c.hero.highlight = 'runs'
  c.products.items[0].name = 'WFS ERP Cloud'
  c.products.items[3].url = 'https://wfssalesmanager.com'
  c.products.items[2].show = false
  c.products.items.push({ show: true, icon: 'shield', status: 'coming_soon', sector: 'Security', name: 'WFS Guard', short_name: '', description: 'Site access control.', modules: ['Gates'], url: '', link_note: 'Launching 2027', cta_label: 'Join the waitlist', cta_link: '#contact' })
  c.faq.items.reverse()
  c.video.youtube_id = 'dQw4w9WgXcQ'; c.video.duration = '2:30'
  c.announcement = { enabled: true, text: 'New: TSF Monitor 2.0', link_label: 'See what changed', link_url: '#products' }
  assert.deepEqual(validateContent(c), [])
  const out = renderHome(home, c, defaults)
  assert.match(out, /<span class="word-inner amber">runs<\/span>/)
  assert.match(out, /WFS ERP Cloud/)
  assert.match(out, /href="https:\/\/wfssalesmanager.com"[^>]*>wfssalesmanager.com</)
  assert.doesNotMatch(out, /wfs-fleetmanager/, 'hidden product must vanish from cards and footer')
  assert.match(out, /<span class="status-soon">Coming soon<\/span>/)
  assert.match(out, /<span class="prod-url">Launching 2027<\/span>/)
  assert.match(out, /id="faq-q-1"[^>]*><span>Will it carry our branding or yours\?/)
  assert.match(out, /data-yt="dQw4w9WgXcQ"/)
  assert.match(out, /overview video, 2 minutes 30 seconds"/)
  assert.match(out, /<!--cms:announcement--><div class="announce" role="region" aria-label="Announcement"><p>New: TSF Monitor 2.0 <a href="#products">See what changed<\/a><\/p><\/div><!--\/cms:announcement-->/)
})

test('contact details change everywhere, including structured data and the other pages', () => {
  const c = clone(defaults)
  c.contact.email = 'sales.admin@workflow-app.net'; c.contact.whatsapp = '+233 20 111 2222'
  const out = renderHome(home, c, defaults)
  assert.doesNotMatch(out, /(?<!sales\.)admin@workflow-app\.net/)
  assert.doesNotMatch(out, /274145249|414 5249|414-5249/)
  assert.match(out, /"telephone": "\+233-20-111-2222"/)
  assert.match(out, /wa\.me\/233201112222/)
  assert.equal((out.match(/sales\.admin@workflow-app\.net/g) || []).length, (home.match(/admin@workflow-app\.net/g) || []).length)
  const privacy = renderPage(read('privacy.html'), c, defaults)
  assert.match(privacy, /sales\.admin@workflow-app\.net/); assert.doesNotMatch(privacy, /414 5249/)
})

test('text is escaped, so content cannot inject markup', () => {
  const c = clone(defaults)
  c.hero.sub = '<script>alert(1)</script> & "quotes"'
  c.faq.items[0].a = '<img src=x onerror=alert(1)>'
  const out = renderHome(home, c, defaults)
  assert.match(out, /&lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; &quot;quotes&quot;/)
  assert.match(out, /&lt;img src=x onerror=alert\(1\)&gt;/)
})

test('unsafe links are rejected', () => {
  const c = clone(defaults)
  c.hero.primary_link = 'javascript:alert(1)'
  c.products.items[0].url = 'javascript:alert(1)'
  const errors = validateContent(c)
  assert.ok(errors.some(e => e.includes('Main button link')))
  assert.ok(errors.some(e => e.includes('WFS ERP') && e.includes('https://')))
  assert.throws(() => renderHome(home, c, defaults), /Not a valid link/)
})

test('validation catches the usual mistakes', () => {
  const c = clone(defaults)
  c.contact.email = 'not-an-email'; c.contact.whatsapp = '12'; c.hero.highlight = 'banana'
  c.video.youtube_id = 'abc'; c.faq.items = []; c.products.items.forEach(i => { i.show = false })
  const e = validateContent(c).join('\n')
  for (const s of ['Contact email', 'WhatsApp number', 'Highlighted word', 'YouTube', 'at least one FAQ', 'at least one product']) assert.match(e, new RegExp(s))
})

test('YouTube links of every shape give the video ID', () => {
  for (const u of ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://youtu.be/dQw4w9WgXcQ?si=abc', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 'https://youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'])
    assert.equal(youTubeId(u), 'dQw4w9WgXcQ', u)
  assert.equal(youTubeId('https://example.com'), '')
})

test('contact swap is a single pass', () => {
  assert.equal(applyContact('a@b.co x@y.co', { email: 'a@b.co', whatsapp: '+1 555 0100' }, { email: 'x@y.co.a@b.co', whatsapp: '+1 555 0100' }), 'x@y.co.a@b.co x@y.co')
})

test('edge functions use the current renderer and defaults', () => {
  assert.equal(read('supabase/functions/_shared/render.js'), read('shared/render.js'), 'run: node scripts/sync-functions.mjs')
  assert.equal(read('supabase/functions/_shared/defaults.json'), read('content/defaults.json'), 'run: node scripts/sync-functions.mjs')
})

console.log(`\n${passed} passed`)
