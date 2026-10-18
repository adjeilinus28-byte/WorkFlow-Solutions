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

export const PRODUCT_STATUSES = { live: 'Live', coming_soon: 'Coming soon', custom: 'Custom' }
export const PLAN_STYLES = { amber: 'Amber', featured: 'Featured (Most popular)', purple: 'Purple', blue: 'Blue' }
export const SECTIONS = ['announcement', 'hero', 'products', 'video', 'pricing', 'faq', 'contact']

const svg = (inner, w = 2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`
const ARROW = svg('<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>', 2.2)
const EXTERNAL = svg('<path d="M7 7h10v10"/><path d="M7 17 17 7"/>', 2.2)
const CHECK = svg('<path d="M20 6 9 17l-5-5"/>', 2.6)
const CHEVRON = svg('<path d="m6 9 6 6 6-6"/>', 2.2)
const ICON_SVG = inner => svg(inner, 1.8)
const MAIL = '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>'
const CHAT = '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>'
const PIN = '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>'
const CLOCK = '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'

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
  maxLen(h.eyebrow, 'Hero small label', 60)
  need(h.headline_line1, 'Headline line 1', 40)
  maxLen(h.headline_line2, 'Headline line 2', 40)
  if (h.highlight && !`${h.headline_line1} ${h.headline_line2}`.split(/\s+/).includes(h.highlight)) errors.push(`Highlighted word "${h.highlight}" isn't one of the headline's words`)
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

function hero(h, ind) {
  const out = []
  if (h.eyebrow) out.push(`${ind}<p class="eyebrow"><span class="pulse" aria-hidden="true"></span>${esc(h.eyebrow)}</p>`)
  // One flowing headline: the words wrap where the screen needs them to
  out.push(`${ind}<h1 class="hero-title">`)
  const words = [h.headline_line1, h.headline_line2].map(l => String(l || '').trim()).filter(Boolean).join(' ').split(/\s+/)
  let marked = false
  for (const w of words) {
    const amber = !marked && h.highlight && w === h.highlight
    if (amber) marked = true
    out.push(`${ind}  <span class="word"><span class="word-inner${amber ? ' amber' : ''}">${esc(w)}</span></span>`)
  }
  out.push(`${ind}</h1>`)
  out.push(`${ind}<p class="hero-sub">${esc(h.sub)}</p>`)
  out.push(`${ind}<div class="hero-actions">`)
  out.push(`${ind}  <a href="${link(h.primary_link)}" class="btn btn-primary btn-lg">${esc(h.primary_label)} ${ARROW}</a>`)
  if (h.secondary_label) out.push(`${ind}  <a href="${link(h.secondary_link)}" class="btn btn-inverse btn-lg">${esc(h.secondary_label)}</a>`)
  out.push(`${ind}</div>`)
  if ((h.stats || []).length) {
    out.push(`${ind}<dl class="hero-stats">`)
    for (const s of h.stats) {
      const count = /^\d+$/.test(String(s.value)) ? ` data-count="${esc(s.value)}"` : ''
      out.push(`${ind}  <div class="stat"><dt>${esc(s.label)}</dt><dd${count}>${esc(s.value)}</dd></div>`)
    }
    out.push(`${ind}</dl>`)
  }
  return out
}

const BADGE = {
  live: '<span class="badge badge-live">Live</span>',
  coming_soon: '<span class="badge badge-soon">Coming soon</span>',
  custom: '<span class="badge badge-custom">Custom</span>',
}

const SPARK_LINE = 'M0 64 L30 58 L60 62 L90 46 L120 50 L150 34 L180 40 L210 24 L240 30 L270 14 L300 18'
const SPARK = `<svg class="pv-spark" viewBox="0 0 300 84" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="pv-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F59E0B" stop-opacity=".35"/><stop offset="1" stop-color="#F59E0B" stop-opacity="0"/></linearGradient></defs><path d="${SPARK_LINE} L300 84 L0 84 Z" fill="url(#pv-fill)"/><path d="${SPARK_LINE}" fill="none" stroke="#F59E0B" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`

// The wide card's window into the product. Decorative: the figures are
// examples, so it's hidden from screen readers.
function preview(icon, ind) {
  const i = `${ind}  `
  const kpi = (label, value, note, tone) => `${i}  <div class="pv-kpi"><span class="pv-label">${label}</span><span class="pv-value">${value}</span><span class="pv-note ${tone}">${note}</span></div>`
  const row = (a, b) => `${i}<div class="pv-row"><span>${a}</span><span>${b}</span></div>`
  const out = [`${ind}<div class="prod-preview" aria-hidden="true">`, `${i}<div class="pv-dots"><span></span><span></span><span></span></div>`]
  if (icon === 'truck') {
    out.push(`${i}<div class="pv-kpis">`, kpi('On route', '18 of 22', 'vehicles', 'good'), kpi('Service due', '2', 'this week', 'warn'), `${i}</div>`,
      `${i}<div class="pv-track"><span></span></div>`, row('GT-4471 · Tema → Kumasi', 'On route'), row('GR-2290 · Fuel logged', '62 L'))
  } else if (icon === 'bag') {
    out.push(`${i}<div class="pv-kpis">`, kpi('Today’s sales', 'GH₵ 18,420', '+12%', 'good'), kpi('Stock alerts', '3', 'items low', 'warn'), `${i}</div>`,
      `${i}${SPARK}`, row('INV-2041 · Kofi Stores', 'GH₵ 1,240'), row('INV-2040 · Ama Pharmacy', 'GH₵ 860'))
  } else {
    out.push(`${i}<div class="pv-kpis">`, kpi('Approvals', '4', 'waiting', 'warn'), kpi('Records', '12,480', 'this month', 'good'), `${i}</div>`,
      `${i}${SPARK}`, row('Leave request · Ama O.', 'Approved'), row('Purchase order · Diesel', 'Pending'))
  }
  out.push(`${ind}</div>`)
  return out
}

const tags = (list, cls = 'tags') => `<ul class="${cls}">${list.map(m => `<li>${esc(m)}</li>`).join('')}</ul>`
const urlLink = u => `<a class="prod-url" href="${link(u)}" target="_blank" rel="noopener noreferrer">${esc(displayUrl(u))}${EXTERNAL}</a>`

function productCard(it, ind, wide) {
  const foot = it.url ? urlLink(it.url) : it.link_note ? `<span class="prod-url">${esc(it.link_note)}</span>` : ''
  const out = [
    `${ind}<article class="prod-card${wide ? ' wide' : ''} rv">`,
    `${ind}  <div class="prod-body">`,
    `${ind}    <div class="prod-top"><span class="icon-tile">${ICON_SVG(ICONS[it.icon] || ICONS.box)}</span>${BADGE[it.status] || ''}</div>`,
    `${ind}    <div class="prod-title"><p class="prod-sector">${esc(it.sector)}</p><h3 class="prod-name">${esc(it.name)}</h3></div>`,
    `${ind}    <p class="prod-desc">${esc(it.description)}</p>`,
  ]
  if ((it.modules || []).length) out.push(`${ind}    ${tags(it.modules)}`)
  out.push(`${ind}    <div class="prod-foot"><a href="${link(it.cta_link)}" class="link">${esc(it.cta_label)} ${ARROW}</a>${foot}</div>`, `${ind}  </div>`)
  if (wide) out.push(...preview(it.icon, `${ind}  `))
  out.push(`${ind}</article>`)
  return out
}

function customStrip(it, ind) {
  const out = [
    `${ind}<article class="custom-strip rv">`,
    `${ind}  <span class="icon-tile icon-tile-dark">${ICON_SVG(ICONS[it.icon] || ICONS.star)}</span>`,
    `${ind}  <div class="cs-copy">`,
    `${ind}    <p class="prod-sector">${esc(it.sector)}</p>`,
    `${ind}    <h3 class="cs-name">${esc(it.name)}</h3>`,
    `${ind}    <p class="cs-desc">${esc(it.description)}</p>`,
  ]
  if ((it.modules || []).length) out.push(`${ind}    ${tags(it.modules, 'tags tags-dark')}`)
  const note = it.link_note ? `<p class="cs-note">${esc(it.link_note)}</p>` : ''
  out.push(`${ind}  </div>`,
    `${ind}  <div class="cs-action">${BADGE.custom}${note}${it.url ? urlLink(it.url) : ''}<a href="${link(it.cta_link)}" class="btn btn-primary btn-lg">${esc(it.cta_label)} ${ARROW}</a></div>`,
    `${ind}</article>`)
  return out
}

// Items separated by blank lines inside their container, for readable source
function spaced(open, blocks, close) {
  const out = [open]
  for (const b of blocks) out.push('', ...b)
  out.push('', close)
  return out
}

// Live products lead (the first one, wide, with a window into the product),
// then the ones coming soon. A custom build gets its own strip below.
function products(p, ind) {
  const shown = (p.items || []).filter(it => it.show !== false)
  const cards = [...shown.filter(it => it.status === 'live'), ...shown.filter(it => it.status === 'coming_soon')]
  const wide = cards.length > 1 && cards[0].status === 'live'
  const out = [
    `${ind}<div class="section-head">`,
    `${ind}  <div class="section-heading">`,
    `${ind}    <p class="eyebrow-label rv">Platforms</p>`,
    `${ind}    <h2 class="section-title rv">${esc(p.title)}</h2>`,
    `${ind}  </div>`,
    `${ind}  <div class="section-aside rv">${p.note ? `<p>${esc(p.note)}</p>` : ''}<a href="#platform" class="link">See what’s under the hood ${ARROW}</a></div>`,
    `${ind}</div>`,
    ...spaced(`${ind}<div class="prod-grid" id="prod-grid" data-carousel data-stagger>`, cards.map((it, i) => productCard(it, `${ind}  `, wide && i === 0)), `${ind}</div>`),
  ]
  for (const it of shown.filter(it => it.status === 'custom')) out.push(...customStrip(it, ind))
  return out
}

function footerProducts(p, ind) {
  return (p.items || []).filter(it => it.show !== false && it.url)
    .map(it => `${ind}<li><a href="${link(it.url)}" target="_blank" rel="noopener noreferrer">${esc(it.short_name || it.name)}</a></li>`)
}

function video(v, ind) {
  const words = durationWords(v.duration)
  const out = [
    `${ind}<button class="video-facade" id="video-facade"`,
    `${ind}        data-yt="${esc(v.youtube_id || 'REPLACE_WITH_YOUTUBE_ID')}"`,
    `${ind}        style="background-image:url('/video-poster.jpg')"`,
    `${ind}        aria-label="Play the WorkFlow Solutions overview video${words ? `, ${words}` : ''}">`,
    `${ind}  <span class="play-btn">`,
    `${ind}    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>`,
    `${ind}  </span>`,
    `${ind}  <span class="video-meta">`,
  ]
  if (v.duration) out.push(`${ind}    <span class="vm-chip">${esc(v.duration)}</span>`)
  out.push(`${ind}    <span class="vm-chip">Sound on</span>`, `${ind}  </span>`, `${ind}</button>`)
  return out
}

const PLAN_CLASS = { amber: '', featured: ' featured', purple: ' tone-purple', blue: ' tone-blue' }

function pricing(pr, ind) {
  const out = [
    `${ind}<div class="section-head">`,
    `${ind}  <div class="section-heading">`,
    `${ind}    <p class="eyebrow-label rv">Pricing</p>`,
    `${ind}    <h2 class="section-title rv">${esc(pr.title)}</h2>`,
    `${ind}    <p class="section-sub rv">${esc(pr.intro)}</p>`,
    `${ind}  </div>`,
    `${ind}</div>`,
    `${ind}<div class="price-grid" data-stagger>`,
  ]
  for (const pl of pr.plans || []) {
    const quote = String(pl.quote || '').split('\n').map(l => esc(l.trim())).filter(Boolean).join(' ')
    out.push(`${ind}  <article class="price-card${PLAN_CLASS[pl.style] ?? ''} rv">`, `${ind}    <div class="plan-head">`,
      `${ind}      <p class="plan-name">${esc(pl.name)}</p>`, `${ind}      <h3 class="plan-quote">${quote}</h3>`)
    if (pl.period) out.push(`${ind}      <p class="plan-period">${esc(pl.period)}</p>`)
    out.push(`${ind}    </div>`, `${ind}    <p class="plan-desc">${esc(pl.description)}</p>`)
    if ((pl.features || []).length) {
      out.push(`${ind}    <ul class="plan-features">`)
      for (const f of pl.features) out.push(`${ind}      <li><span class="check">${CHECK}</span>${esc(f)}</li>`)
      out.push(`${ind}    </ul>`)
    }
    out.push(`${ind}    <a href="${link(pl.cta_link)}" class="btn ${pl.style === 'featured' ? 'btn-primary' : 'btn-secondary'} btn-block">${esc(pl.cta_label)} ${ARROW}</a>`, `${ind}  </article>`)
  }
  out.push(`${ind}</div>`)
  const methods = String(pr.payment_methods || '').split('·').map(s => s.trim()).filter(Boolean)
  if (methods.length) out.push(`${ind}<div class="pay-row rv"><span class="pay-label">We accept</span>${tags(methods)}</div>`)
  return out
}

// Every answer is in the page and open, so it reads fine without JavaScript;
// the script folds all but the first when it starts.
function faq(f, ind) {
  const items = (f.items || []).map((it, i) => {
    const n = i + 1
    return [
      `${ind}  <div class="faq-item rv">`,
      `${ind}    <h3 class="faq-h"><button type="button" class="faq-q" id="faq-q-${n}" aria-expanded="true" aria-controls="faq-a-${n}"><span>${esc(it.q)}</span><span class="faq-icon">${CHEVRON}</span></button></h3>`,
      `${ind}    <div class="faq-a" id="faq-a-${n}" role="region" aria-labelledby="faq-q-${n}"><p>${esc(it.a)}</p></div>`,
      `${ind}  </div>`,
    ]
  })
  return spaced(`${ind}<div class="faq-list" data-stagger>`, items, `${ind}</div>`)
}

function contact(c, ind) {
  const item = (tag, attrs, icon, label, val, go) =>
    `${ind}  <li class="rv"><${tag} class="contact-item"${attrs}><span class="icon-tile">${ICON_SVG(icon)}</span><span class="ci-text"><span class="ci-label">${label}</span><span class="ci-val">${val}</span></span>${go ? `<span class="ci-go">${EXTERNAL}</span>` : ''}</${tag}></li>`
  const out = [`${ind}<ul class="contact-list" data-stagger>`]
  out.push(item('a', ` href="mailto:${esc(c.email)}"`, MAIL, 'Email', esc(c.email), true))
  out.push(item('a', ` href="https://wa.me/${phoneDigits(c.whatsapp)}" target="_blank" rel="noopener noreferrer"`, CHAT, 'WhatsApp', esc(c.whatsapp), true))
  if (c.location) out.push(item('div', '', PIN, 'Based in', esc(c.location), false))
  if (c.response_time) out.push(item('div', '', CLOCK, 'Response time', esc(c.response_time), false))
  out.push(`${ind}</ul>`)
  return out
}

function announcement(a) {
  if (!a || !a.enabled || !a.text) return ''
  const more = a.link_url && a.link_label ? `<a href="${link(a.link_url)}">${esc(a.link_label)} ${ARROW}</a>` : ''
  return `<div class="announce" role="region" aria-label="Announcement"><div class="announce-in"><span class="tag tag-new">New</span><p>${esc(a.text)}</p>${more}</div></div>`
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
