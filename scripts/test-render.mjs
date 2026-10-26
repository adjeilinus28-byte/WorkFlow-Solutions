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
  c.hero.headline_line1 = 'Software that'; c.hero.headline_line2 = 'runs the site'
  c.products.items[0].name = 'WFS ERP Cloud'
  c.products.items[3].url = 'https://wfssalesmanager.com'
  c.products.items[2].show = false
  c.products.items.push({ show: true, icon: 'shield', status: 'coming_soon', sector: 'Security', name: 'WFS Guard', short_name: '', description: 'Site access control.', modules: ['Gates'], url: '', link_note: 'Launching 2027', cta_label: 'Join the waitlist', cta_link: '#contact' })
  c.faq.items.reverse()
  c.video.youtube_id = 'dQw4w9WgXcQ'; c.video.duration = '2:30'
  c.announcement = { enabled: true, text: 'New: TSF Monitor 2.0', link_label: 'See what changed', link_url: '#products' }
  assert.deepEqual(validateContent(c), [])
  const out = renderHome(home, c, defaults)
  assert.match(out, /<h1 class="hero-title"><span class="line">Software that<\/span> <span class="line amber">runs the site<\/span><\/h1>/)
  assert.match(out, /WFS ERP Cloud/)
  assert.match(out, /href="https:\/\/wfssalesmanager.com"[^>]*>wfssalesmanager.com</)
  assert.doesNotMatch(out, /wfs-fleetmanager/, 'hidden product must vanish from cards and footer')
  assert.match(out, /<span class="dot"><\/span>Coming soon<\/span><\/p>\n\s*<h3>WFS Guard<\/h3>/)
  assert.match(out, /<span class="plat-note">Launching 2027<\/span>/)
  assert.match(out, /id="faq-q-1">Will it carry our branding or yours\?/)
  assert.match(out, /data-yt="dQw4w9WgXcQ"/)
  assert.match(out, /overview video, 2 minutes 30 seconds"/)
  assert.match(out, /<!--cms:announcement--><div class="announce" role="region" aria-label="Announcement"><p>New: TSF Monitor 2.0 <a href="#products">See what changed<\/a><\/p><\/div><!--\/cms:announcement-->/)
  // Live platforms lead, coming-soon ones follow, a custom build comes last
  const grid = out.slice(out.indexOf('class="plat-grid"'), out.indexOf('<!--/cms:products-->'))
  assert.ok(grid.indexOf('WFS Guard') > grid.indexOf('MediStaff'), 'coming-soon tiles follow the live ones')
  assert.ok(grid.indexOf('Something built for you') > grid.indexOf('WFS Guard'), 'the custom build comes last')
  // No screenshot yet: the amber field with the platform's name, and no stock photos anywhere
  assert.match(grid, /<article class="plat rv">\s*<div class="plat-pic plat-pic-amber"><span class="plat-word" aria-hidden="true">[^<]+<\/span><\/div>[\s\S]*?<h3>WFS ERP Cloud<\/h3>/)
  assert.doesNotMatch(out, /\/assets\/|class="credits"/)
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
  c.contact.email = 'not-an-email'; c.contact.whatsapp = '12'
  c.video.youtube_id = 'abc'; c.faq.items = []; c.products.items.forEach(i => { i.show = false })
  const e = validateContent(c).join('\n')
  for (const s of ['Contact email', 'WhatsApp number', 'YouTube', 'at least one FAQ', 'at least one product']) assert.match(e, new RegExp(s))
})

test('uploaded screenshots replace the amber field, and only site-media images are accepted', () => {
  const c = clone(defaults)
  const shot = 'https://ippsarwgvvlarlyqobvj.supabase.co/storage/v1/object/public/site-media/products/wfs-erp-1.png'
  c.products.items[0].image = shot
  assert.deepEqual(validateContent(c), [])
  const out = renderHome(home, c, defaults)
  assert.match(out, new RegExp(`<img class="plat-shot" src="${shot.replace(/[.?]/g, '\$&')}" alt="Screenshot of WFS ERP"`))
  assert.match(out, /<div class="plat-pic"><img class="plat-shot"/)
  // a custom platform without a website or screenshot is still a normal card
  const c2 = clone(defaults); Object.assign(c2.products.items[0], { status: 'custom', url: '' })
  const grid2 = renderHome(home, c2, defaults).split('<!--cms:products-->')[1].split('<!--/cms:products-->')[0]
  assert.equal((grid2.match(/class="plat-custom/g) || []).length, 1)
  assert.match(grid2, /<h3>WFS ERP<\/h3>/)
  assert.ok(grid2.indexOf('<h3>WFS ERP</h3>') < grid2.indexOf('class="plat-custom'), 'the custom platform is a normal card before the invitation')
  // a custom item with a screenshot is a normal card, not the amber invitation
  c.products.items[5].image = shot.replace('wfs-erp-1', 'custom-2')
  const grid = renderHome(home, c, defaults).split('<!--cms:products-->')[1].split('<!--/cms:products-->')[0]
  assert.equal((grid.match(/class="plat-custom/g) || []).length, 0)
  for (const bad of ['https://example.com/a.png', 'javascript:alert(1)', shot.replace('.png', '.svg')]) {
    c.products.items[0].image = bad
    assert.ok(validateContent(c).some(e => e.includes('screenshot must be uploaded')), bad)
  }
})

test('the badge, tick points and sectors strip are editable, and older content gets the defaults', () => {
  const c = clone(defaults)
  Object.assign(c.hero, { badge: 'Made in Accra', promises: ['No card needed'], sectors_label: 'Who we build for', sectors: ['Mines', 'Banks'] })
  let out = renderHome(home, c, defaults)
  assert.match(out, /<p class="chip"><span class="dot"><\/span>Made in Accra · 5 platforms live in production<\/p>/)
  assert.match(out, /<ul class="trust">\n\s*<li><svg[^>]*>.*?<\/svg>No card needed<\/li>\n\s*<\/ul>/)
  assert.match(out, /<!--cms:sectors-->\n\s*<p class="caps">Who we build for<\/p>\n\s*<ul><li>Mines<\/li><li>Banks<\/li><\/ul>/)
  assert.doesNotMatch(out.split('<main')[1], /Built in Kumasi|keep Ghana moving|30-day free trial, no card/)
  // empty: no chip, no tick list
  Object.assign(c.hero, { badge: '', stats: [], promises: [] })
  out = renderHome(home, c, defaults)
  assert.doesNotMatch(out, /<p class="chip"><span class="dot"><\/span>[^<]*<\/p>\n\s*<h1/)
  assert.doesNotMatch(out, /class="trust"/)
  // a hero published before these fields existed renders the defaults
  const old = clone(defaults); for (const k of ['badge', 'promises', 'sectors_label', 'sectors']) delete old.hero[k]
  assert.equal(renderHome(home, old, defaults), home)
  // limits
  Object.assign(c.hero, { badge: 'x'.repeat(41), promises: ['a', 'b', 'c', 'd', 'e'], sectors: [''] })
  const e = validateContent(c).join('\n')
  for (const s of ['Badge above the headline', 'at most 4 tick points', 'Sector 1 is empty']) assert.match(e, new RegExp(s))
})

test('the footer description is editable, and older content gets the default', () => {
  const c = clone(defaults)
  c.contact.footer_about = 'Software for <mines> & hospitals.'
  let out = renderHome(home, c, defaults)
  assert.match(out, /<!--cms:footer-about-->\n\s*<p>Software for &lt;mines&gt; &amp; hospitals\.<\/p>\n\s*<!--\/cms:footer-about-->/)
  c.contact.footer_about = ''
  out = renderHome(home, c, defaults)
  assert.match(out, /<!--cms:footer-about--><!--\/cms:footer-about-->/)
  const old = clone(defaults); delete old.contact.footer_about
  assert.equal(renderHome(home, old, defaults), home)
  c.contact.footer_about = 'x'.repeat(241)
  assert.ok(validateContent(c).some(e => e.includes('Footer description')))
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
