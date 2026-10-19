// Renders the website's editable regions from content.
//
// Used in two places so they can never disagree:
//   - scripts/build-site.mjs, when Netlify builds the published site
//   - the admin's live preview, before anything is published
//
// index.html holds the default content between <!--cms:NAME--> markers, so the
// page works on its own. Rendering replaces each region; rendering the defaults
// reproduces the file byte for byte (checked by scripts/test-render.mjs).

export const ICONS = {
  grid: '<rect x="2" y="2" width="9" height="9" rx="1"/><rect x="13" y="2" width="9" height="9" rx="1"/><rect x="2" y="13" width="9" height="9" rx="1"/><path d="M13 17.5h9M17.5 13v9"/>',
  mountain: '<path d="M3 18l6-9 4 5 3-4 5 8z"/><circle cx="8" cy="5" r="2"/>',
  truck: '<path d="M1 3h15v13H1zM16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
  bag: '<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18M16 10a4 4 0 0 1-8 0"/>',
  hospital: '<path d="M12 3v6M9 6h6M4 21V9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12z"/><path d="M9 21v-5h6v5"/>',
  star: '<path d="M12 2l3 6 6 1-4.5 4.2 1.2 6.3L12 16.5 6.3 19.5l1.2-6.3L3 9l6-1z"/>',
  chart: '<path d="M12 20V10M18 20V4M6 20v-4"/>',
  building: '<path d="M3 21h18M4 21V7l8-4 8 4v14M9 21V11h6v10"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  box: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12"/>',
}

// What a product's tile shows, keyed like ICONS (the stored field is still "icon")
export const TILE_PICTURES = Object.fromEntries(Object.keys(ICONS).map(k => [k, {
  grid: 'Photo: Kumasi from Kronum', mountain: 'Photo: Damang gold mine pit', truck: 'Photo: haul truck at the Ahafo mine',
  bag: 'Photo: Kejetia market hall', hospital: 'Photo: Komfo Anokye Teaching Hospital',
}[k] || 'The platform’s name, set large']))

export const PRODUCT_STATUSES = { live: 'Live', coming_soon: 'Coming soon', custom: 'Custom' }
// purple and blue are kept as keys so saved content still validates; both now draw in navy
export const PLAN_STYLES = { amber: 'Amber', featured: 'Featured (Most popular)', purple: 'Navy', blue: 'Navy (alternate)' }
export const SECTIONS = ['announcement', 'hero', 'products', 'video', 'pricing', 'faq', 'contact']

// ── Escaping and validation ───────────────────────────────

export const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export const isEmail = v => /^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i.test(String(v || ''))
export const isPhone = v => /^\+?[0-9][0-9 \-]{6,18}[0-9]$/.test(String(v || ''))
export const isYouTubeId = v => /^[A-Za-z0-9_-]{11}$/.test(String(v || ''))
export function isLink(v) {
  const s = String(v || '')
  return /^#[A-Za-z0-9_-]*$/.test(s) || /^\/(?!\/)[^\s"<>]*$/.test(s) || /^https?:\/\/[^\s"<>]+$/i.test(s) || /^mailto:[^\s"<>]+$/i.test(s) || /^tel:\+?[0-9 \-]+$/i.test(s)
}
const link = v => { if (!isLink(v)) throw new Error(`Not a valid link: ${v}`); return esc(v) }

export const phoneDigits = v => String(v || '').replace(/\D/g, '')
// JSON-LD writes the phone with hyphens: +233-27-414-5249
const phoneLd = v => String(v || '').trim().replace(/\s+/g, '-')

// "https://wfs-erp.netlify.app/" → "wfs-erp.netlify.app"
export const displayUrl = u => String(u || '').replace(/^https?:\/\//i, '').replace(/\/$/, '')

// "1:00" → "1 minute", "2:30" → "2 minutes 30 seconds"
function durationWords(d) {
  const m = /^(\d{1,2}):([0-5]\d)$/.exec(String(d || '').trim())
  if (!m) return ''
  const min = +m[1], sec = +m[2], parts = []
  if (min) parts.push(`${min} minute${min === 1 ? '' : 's'}`)
  if (sec) parts.push(`${sec} second${sec === 1 ? '' : 's'}`)
  return parts.join(' ')
}

// Pull an 11-character video ID out of anything YouTube gives you
export function youTubeId(input) {
  const s = String(input || '').trim()
  if (isYouTubeId(s)) return s
  const m = /(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([A-Za-z0-9_-]{11})/.exec(s)
  return m ? m[1] : ''
}

// Every problem with the content, as readable messages. The build refuses to
// publish content with any, so a mistake can't take the site down — the
// previous deploy simply stays live.
export function validateContent(c) {
  const errors = []
  const need = (v, label, max) => {
    if (!String(v ?? '').trim()) errors.push(`${label} is empty`)
    else if (max && String(v).length > max) errors.push(`${label} is longer than ${max} characters`)
  }
  const maxLen = (v, label, max) => { if (String(v ?? '').length > max) errors.push(`${label} is longer than ${max} characters`) }
  const lnk = (v, label) => { if (!isLink(v)) errors.push(`${label} isn't a valid link (use https://…, #section, /page, mailto: or tel:)`) }

  const a = c.announcement || {}
  if (a.enabled) {
    need(a.text, 'Announcement text', 120)
    if (a.link_url || a.link_label) { need(a.link_label, 'Announcement link label', 30); lnk(a.link_url, 'Announcement link') }
  }

  const h = c.hero || {}
  need(h.headline_line1, 'Headline line 1', 40)
  maxLen(h.headline_line2, 'Headline line 2', 40)
  need(h.sub, 'Hero paragraph', 400)
  need(h.primary_label, 'Main button text', 30); lnk(h.primary_link, 'Main button link')
  if (h.secondary_label) lnk(h.secondary_link, 'Second button link')
  ;(h.stats || []).forEach((s, i) => { need(s.value, `Stat ${i + 1} number`, 8); need(s.label, `Stat ${i + 1} label`, 40) })
  if ((h.stats || []).length > 4) errors.push('Use at most 4 hero stats')

  const p = c.products || {}
  need(p.title, 'Products heading', 80); maxLen(p.note, 'Products note', 60)
  const shown = (p.items || []).filter(i => i.show !== false)
  if (!shown.length) errors.push('Show at least one product')
  ;(p.items || []).forEach((it, i) => {
    const n = `Product ${i + 1}${it.name ? ` (${it.name})` : ''}`
    need(it.name, `${n} name`, 60); maxLen(it.short_name, `${n} footer name`, 40); need(it.sector, `${n} sector`, 40)
    need(it.description, `${n} description`, 400)
    if (!ICONS[it.icon]) errors.push(`${n} has no icon`)
    if (!PRODUCT_STATUSES[it.status]) errors.push(`${n} has no status`)
    if (it.url) { if (!/^https?:\/\//i.test(it.url) || !isLink(it.url)) errors.push(`${n} website must start with https://`) }
    else maxLen(it.link_note, `${n} note`, 40)
    need(it.cta_label, `${n} button text`, 30); lnk(it.cta_link, `${n} button link`)
    ;(it.modules || []).forEach((m, j) => need(m, `${n} module ${j + 1}`, 30))
  })

  const v = c.video || {}
  if (v.youtube_id && !isYouTubeId(v.youtube_id)) errors.push('YouTube video ID should be 11 characters — paste the video link and it is picked out for you')
  maxLen(v.duration, 'Video length', 8)

  const pr = c.pricing || {}
  need(pr.title, 'Pricing heading', 80); need(pr.intro, 'Pricing paragraph', 500); maxLen(pr.payment_methods, 'Payment methods line', 200)
  if (!(pr.plans || []).length) errors.push('Add at least one pricing card')
  ;(pr.plans || []).forEach((pl, i) => {
    const n = `Pricing card ${i + 1}${pl.name ? ` (${pl.name})` : ''}`
    if (!PLAN_STYLES[pl.style]) errors.push(`${n} has no style`)
    need(pl.name, `${n} name`, 40); need(pl.quote, `${n} big text`, 60); maxLen(pl.period, `${n} small line`, 40)
    need(pl.description, `${n} description`, 300); need(pl.cta_label, `${n} button text`, 30); lnk(pl.cta_link, `${n} button link`)
    ;(pl.features || []).forEach((f, j) => need(f, `${n} point ${j + 1}`, 60))
  })

  const f = c.faq || {}
  if (!(f.items || []).length) errors.push('Add at least one FAQ')
  ;(f.items || []).forEach((it, i) => { need(it.q, `FAQ ${i + 1} question`, 120); need(it.a, `FAQ ${i + 1} answer`, 1200) })

  const ct = c.contact || {}
  if (!isEmail(ct.email)) errors.push('Contact email isn\'t a valid email address')
  if (!isPhone(ct.whatsapp)) errors.push('WhatsApp number should look like +233 27 414 5249')
  maxLen(ct.location, 'Location', 60); maxLen(ct.response_time, 'Response time', 60)
  return errors
}

// ── Regions ────────────────────────────────────────────────
//
// The dark WorkFlow design (Figma: "WorkFlow Solutions — Website Redesign").
// Pictures are real places in Ghana, credited in the footer.

// "Day free trial" → "day free trial", for a label that continues a sentence
const lower = s => { const t = String(s || ''); return t.charAt(0).toLowerCase() + t.slice(1) }
const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'

// Two headline lines; the second one is set in amber
function hero(h, ind) {
  const lines = [h.headline_line1, h.headline_line2].map(l => String(l || '').trim()).filter(Boolean)
  const facts = (h.stats || []).map(s => `${esc(s.value)} ${esc(lower(s.label))}`).join(' · ')
  const out = [`${ind}<p class="chip"><span class="dot"></span>Built in Kumasi${facts ? ` · ${facts}` : ''}</p>`]
  out.push(`${ind}<h1 class="hero-title">${lines.map((l, i) => `<span class="line${i === lines.length - 1 && lines.length > 1 ? ' amber' : ''}">${esc(l)}</span>`).join(' ')}</h1>`)
  out.push(`${ind}<p class="hero-sub">${esc(h.sub)}</p>`)
  const second = h.secondary_label ? `<a href="${link(h.secondary_link)}" class="btn btn-ghost">${esc(h.secondary_label)} ${ARROW}</a>` : ''
  out.push(`${ind}<p class="hero-actions"><a href="${link(h.primary_link)}" class="btn btn-primary">${esc(h.primary_label)} ${ARROW}</a>${second}</p>`)
  return out
}

// Every platform card carries a real photograph of its world in Ghana
const PHOTOS = {
  grid: { src: '/assets/kumasi-kronum.jpg', alt: 'Kumasi seen from the hills at Kronum, low roofs under a wide blue sky' },
  mountain: { src: '/assets/damang-pit.jpg', alt: 'The terraced walls of the Damang gold mine pit in Ghana' },
  truck: { src: '/assets/ahafo-pit.jpg', alt: 'A loaded haul truck crossing a dusty pit floor at the Ahafo gold mine, Ghana' },
  bag: { src: '/assets/kejetia-market.jpg', alt: 'The long market hall of Kejetia market in Kumasi, under its striped roof' },
  hospital: { src: '/assets/kath-hospital.jpg', alt: 'Komfo Anokye Teaching Hospital in Kumasi, seen across its lawn' },
}
const STATUS_CHIP = { live: 'Live', coming_soon: 'Coming soon' }
const urlLink = u => `<a href="${link(u)}" target="_blank" rel="noopener noreferrer" class="plat-url">${esc(displayUrl(u))}</a>`

function platformCard(it, ind) {
  const photo = PHOTOS[it.icon]
  const pic = photo
    ? `<img src="${photo.src}" alt="${esc(photo.alt)}" width="1400" height="1050" loading="lazy"/>`
    : `<span class="plat-word" aria-hidden="true">${esc(it.short_name || it.name)}</span>`
  const note = it.url ? urlLink(it.url) : it.link_note ? `<span class="plat-note">${esc(it.link_note)}</span>` : ''
  const out = [
    `${ind}<article class="plat rv">`,
    `${ind}  <div class="plat-pic">${pic}</div>`,
    `${ind}  <div class="plat-body">`,
    `${ind}    <p class="plat-top"><span class="caps">${esc(it.sector)}</span><span class="chip chip-sm"><span class="dot${it.status === 'live' ? ' live' : ''}"></span>${STATUS_CHIP[it.status] || 'Live'}</span></p>`,
    `${ind}    <h3>${esc(it.name)}</h3>`,
    `${ind}    <p class="plat-desc">${esc(it.description)}</p>`,
  ]
  if ((it.modules || []).length) out.push(`${ind}    <p class="plat-mods">${it.modules.map(esc).join(' · ')}</p>`)
  out.push(`${ind}    <p class="plat-links"><a href="${link(it.cta_link)}" class="text-link">${esc(it.cta_label)}</a>${note}</p>`, `${ind}  </div>`, `${ind}</article>`)
  return out
}

function customCard(it, ind) {
  return [
    `${ind}<article class="plat-custom rv">`,
    `${ind}  <p class="caps">${esc(it.sector)}</p>`,
    `${ind}  <h3>${esc(it.name)}</h3>`,
    `${ind}  <p>${esc(it.description)}</p>`,
    `${ind}  <a href="${link(it.cta_link)}" class="btn btn-dark">${esc(it.cta_label)} ${ARROW}</a>`,
    `${ind}</article>`,
  ]
}

// Items separated by blank lines inside their container, for readable source
function spaced(open, blocks, close) {
  const out = [open]
  for (const b of blocks) out.push('', ...b)
  out.push('', close)
  return out
}

// Live platforms first, then the ones coming soon, then a custom build
function products(p, ind) {
  const shown = (p.items || []).filter(it => it.show !== false)
  const cards = [...shown.filter(it => it.status === 'live'), ...shown.filter(it => it.status === 'coming_soon')].map(it => platformCard(it, `${ind}  `))
  const custom = shown.filter(it => it.status === 'custom').map(it => customCard(it, `${ind}  `))
  const head = [
    `${ind}<div class="sec-head rv">`,
    `${ind}  <p class="chip"><span class="dot"></span>The platforms</p>`,
    `${ind}  <h2 id="products-title">${esc(p.title)}</h2>`,
  ]
  if (p.note) head.push(`${ind}  <p class="lead">${esc(p.note)}</p>`)
  head.push(`${ind}</div>`)
  return [...head, ...spaced(`${ind}<div class="plat-grid" data-stagger>`, [...cards, ...custom], `${ind}</div>`)]
}

function footerProducts(p, ind) {
  return (p.items || []).filter(it => it.show !== false && it.url)
    .map(it => `${ind}<li><a href="${link(it.url)}" target="_blank" rel="noopener noreferrer">${esc(it.short_name || it.name)}</a></li>`)
}

function video(v, ind) {
  const words = durationWords(v.duration)
  return [
    `${ind}<button class="video-facade" id="video-facade"`,
    `${ind}        data-yt="${esc(v.youtube_id || 'REPLACE_WITH_YOUTUBE_ID')}"`,
    `${ind}        style="background-image:url('/video-poster.jpg')"`,
    `${ind}        aria-label="Play the WorkFlow Solutions overview video${words ? `, ${words}` : ''}">`,
    `${ind}  <span class="play-btn"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></span>`,
    `${ind}  <span class="video-meta">${v.duration ? `${esc(v.duration)}, sound on` : 'Sound on'}</span>`,
    `${ind}</button>`,
  ]
}

// "a · b · c" → ["a", "b", "c"]
const dotList = s => String(s || '').split('·').map(x => x.trim()).filter(Boolean)

// Plans side by side; the featured plan is the amber card
function pricing(pr, ind) {
  const out = [
    `${ind}<div class="sec-head sec-head-center rv">`,
    `${ind}  <p class="chip"><span class="dot"></span>Pricing</p>`,
    `${ind}  <h2 id="pricing-title">${esc(pr.title)}</h2>`,
    `${ind}  <p class="lead">${esc(pr.intro)}</p>`,
    `${ind}</div>`,
    `${ind}<div class="plans" data-stagger>`,
  ]
  for (const pl of pr.plans || []) {
    const featured = pl.style === 'featured'
    const quote = String(pl.quote || '').split('\n').map(l => esc(l.trim())).filter(Boolean).join(' ')
    out.push(`${ind}  <article class="plan${featured ? ' plan-featured' : ''} rv">`,
      `${ind}    <p class="caps">${esc(pl.name)}</p>`,
      `${ind}    <h3>${quote}</h3>`)
    if (pl.period) out.push(`${ind}    <p class="plan-period">${featured ? 'Most popular · ' : ''}${esc(pl.period)}</p>`)
    out.push(`${ind}    <p class="plan-desc">${esc(pl.description)}</p>`)
    if ((pl.features || []).length) {
      out.push(`${ind}    <ul class="ticks">`)
      for (const f of pl.features) out.push(`${ind}      <li>${esc(f)}</li>`)
      out.push(`${ind}    </ul>`)
    }
    out.push(`${ind}    <a href="${link(pl.cta_link)}" class="btn ${featured ? 'btn-dark' : 'btn-primary'} btn-block">${esc(pl.cta_label)} ${ARROW}</a>`, `${ind}  </article>`)
  }
  out.push(`${ind}</div>`)
  const methods = dotList(pr.payment_methods)
  if (methods.length) out.push(`${ind}<p class="pay rv"><span>We accept</span>${methods.map(m => `<span class="chip chip-sm">${esc(m)}</span>`).join('')}</p>`)
  return out
}

// Questions as an open list; every answer visible
function faq(f, ind) {
  const items = (f.items || []).map((it, i) => [
    `${ind}  <div class="qa rv">`,
    `${ind}    <h3 id="faq-q-${i + 1}">${esc(it.q)}</h3>`,
    `${ind}    <p>${esc(it.a)}</p>`,
    `${ind}  </div>`,
  ])
  return spaced(`${ind}<div class="qa-list">`, items, `${ind}</div>`)
}

function contact(c, ind) {
  const out = [
    `${ind}<ul class="reach">`,
    `${ind}  <li><span class="caps">Email</span><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></li>`,
    `${ind}  <li><span class="caps">WhatsApp</span><a href="https://wa.me/${phoneDigits(c.whatsapp)}" target="_blank" rel="noopener noreferrer">${esc(c.whatsapp)}</a></li>`,
  ]
  if (c.location) out.push(`${ind}  <li><span class="caps">Based in</span><span>${esc(c.location)}</span></li>`)
  if (c.response_time) out.push(`${ind}  <li><span class="caps">Replies</span><span>${esc(c.response_time)}</span></li>`)
  out.push(`${ind}</ul>`)
  return out
}

function announcement(a) {
  if (!a || !a.enabled || !a.text) return ''
  const more = a.link_url && a.link_label ? ` <a href="${link(a.link_url)}">${esc(a.link_label)}</a>` : ''
  return `<div class="announce" role="region" aria-label="Announcement"><p>${esc(a.text)}${more}</p></div>`
}

const BLOCK_REGIONS = {
  hero: c => ind => hero(c.hero, ind),
  products: c => ind => products(c.products, ind),
  'footer-products': c => ind => footerProducts(c.products, ind),
  video: c => ind => video(c.video, ind),
  pricing: c => ind => pricing(c.pricing, ind),
  faq: c => ind => faq(c.faq, ind),
  contact: c => ind => contact(c.contact, ind),
}

function replaceRegion(html, name, render) {
  const re = new RegExp(`(^([ \\t]*)<!--cms:${name}-->)([\\s\\S]*?)(<!--/cms:${name}-->)`, 'm')
  if (!re.test(html)) return html
  return html.replace(re, (_, open, ind, _inner, close) => {
    const body = render(ind)
    const inner = typeof body === 'string' ? body : `\n${body.join('\n')}\n${ind}`
    return open + inner + close
  })
}

// Email and phone appear all over the pages (structured data, footer, the
// form's fallback message, privacy and terms). Swap the defaults for the
// published values in one pass, so a new value containing an old one can't be
// replaced twice.
export function applyContact(html, from, to) {
  if (!from || !to) return html
  const pairs = [
    [from.email, to.email],
    [from.whatsapp, to.whatsapp],
    [phoneDigits(from.whatsapp), phoneDigits(to.whatsapp)],
    [phoneLd(from.whatsapp), phoneLd(to.whatsapp)],
  ].filter(([a, b]) => a && b && a !== b)
  if (!pairs.length) return html
  const map = new Map(pairs)
  const pattern = new RegExp([...map.keys()].sort((a, b) => b.length - a.length).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g')
  return html.replace(pattern, m => map.get(m))
}

// Missing sections (say, content saved before a new section existed) fall back
// to the defaults instead of breaking the page.
export function withDefaults(content, defaults) {
  const out = { ...defaults }
  for (const k of SECTIONS) if (content && content[k] && typeof content[k] === 'object') out[k] = content[k]
  return out
}

// The home page: every region, plus the contact swap.
export function renderHome(template, content, defaults) {
  const c = withDefaults(content, defaults)
  let html = applyContact(template, defaults.contact, c.contact)
  for (const [name, make] of Object.entries(BLOCK_REGIONS)) html = replaceRegion(html, name, make(c))
  html = replaceRegion(html, 'announcement', () => announcement(c.announcement))
  return html
}

// Privacy, terms: only the contact details appear on them.
export function renderPage(template, content, defaults) {
  const c = withDefaults(content, defaults)
  return applyContact(template, defaults.contact, c.contact)
}
