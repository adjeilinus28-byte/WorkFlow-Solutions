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

const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>'
const ARROW_SM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>'
const EXTERNAL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>'
const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>'
const PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>'
const ICON_SVG = inner => `<svg viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`
const CONTACT_SVG = inner => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`
const MAIL = '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>'
const PHONE = '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>'
const PIN = '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>'
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
  if (h.eyebrow) out.push(`${ind}<div class="hero-eyebrow"><span class="eyebrow-pulse"></span>${esc(h.eyebrow)}</div>`)
  out.push(`${ind}<h1 class="hero-title">`)
  const lines = [h.headline_line1, h.headline_line2].map(l => String(l || '').trim()).filter(Boolean)
  let marked = false
  lines.forEach((line, li) => {
    const words = line.split(/\s+/)
    words.forEach((w, wi) => {
      const amber = !marked && h.highlight && w === h.highlight
      if (amber) marked = true
      const br = wi === words.length - 1 && li < lines.length - 1 ? '<br>' : ''
      out.push(`${ind}  <span class="word"><span class="word-inner${amber ? ' amber' : ''}">${esc(w)}</span></span>${br}`)
    })
  })
  out.push(`${ind}</h1>`)
  out.push(`${ind}<p class="hero-sub">${esc(h.sub)}</p>`)
  out.push(`${ind}<div class="hero-actions">`)
  out.push(`${ind}  <a href="${link(h.primary_link)}" class="btn-primary">${esc(h.primary_label)} ${ARROW}</a>`)
  if (h.secondary_label) out.push(`${ind}  <a href="${link(h.secondary_link)}" class="btn-ghost">${esc(h.secondary_label)}</a>`)
  out.push(`${ind}</div>`)
  if ((h.stats || []).length) {
    out.push(`${ind}<div class="hero-stats">`)
    for (const s of h.stats) {
      const count = /^\d+$/.test(String(s.value)) ? ` data-count="${esc(s.value)}"` : ''
      out.push(`${ind}  <div class="glass-stat"><div class="stat-num"${count}>${esc(s.value)}</div><div class="stat-label">${esc(s.label)}</div></div>`)
    }
    out.push(`${ind}</div>`)
  }
  return out
}

// Reveal delays as hand-written in the original page, then repeating
const CARD_DELAYS = ['', ' d1', ' d2', ' d1', ' d2', ' d3']
const cardDelay = i => (i < CARD_DELAYS.length ? CARD_DELAYS[i] : ['', ' d1', ' d2'][i % 3])

function productCard(it, i, ind) {
  const badge = it.status === 'live' ? '<span class="status-live"><span class="status-dot"></span>Live</span>'
    : it.status === 'custom' ? '<span class="badge badge-custom">Custom</span>'
    : '<span class="status-soon">Coming soon</span>'
  const foot = it.url
    ? `<a class="prod-url" href="${link(it.url)}" target="_blank" rel="noopener noreferrer">${esc(displayUrl(it.url))}${EXTERNAL}</a>`
    : `<span class="prod-url">${esc(it.link_note)}</span>`
  const out = [
    `${ind}<div class="prod-card rv${cardDelay(i)}">`,
    `${ind}  <div class="prod-top">`,
    `${ind}    <div class="prod-icon">${ICON_SVG(ICONS[it.icon] || ICONS.box)}</div>`,
    `${ind}    ${badge}`,
    `${ind}  </div>`,
    `${ind}  <div class="prod-sector">${esc(it.sector)}</div>`,
    `${ind}  <h3 class="prod-name">${esc(it.name)}</h3>`,
    `${ind}  <p class="prod-desc">${esc(it.description)}</p>`,
  ]
  if ((it.modules || []).length) out.push(`${ind}  <div class="mod-row">${it.modules.map(m => `<span class="mod">${esc(m)}</span>`).join('')}</div>`)
  out.push(
    `${ind}  <div class="prod-foot">`,
    `${ind}    ${foot}`,
    `${ind}    <a href="${link(it.cta_link)}" class="prod-link">${esc(it.cta_label)} ${ARROW_SM}</a>`,
    `${ind}  </div>`,
    `${ind}</div>`,
  )
  return out
}

// Items separated by blank lines inside their grid, as in the original page
function spaced(open, blocks, close) {
  const out = [open]
  for (const b of blocks) out.push('', ...b)
  out.push('', close)
  return out
}

function products(p, ind) {
  const out = [
    `${ind}<div class="products-head">`,
    `${ind}  <div>`,
    `${ind}    <p class="section-label rv">Products</p>`,
    `${ind}    <h2 class="section-title rv d1">${esc(p.title)}</h2>`,
    `${ind}  </div>`,
  ]
  if (p.note) out.push(`${ind}  <div class="products-note rv d1">${esc(p.note)}</div>`)
  out.push(`${ind}</div>`)
  const shown = (p.items || []).filter(it => it.show !== false)
  return out.concat(spaced(`${ind}<div class="products-grid">`, shown.map((it, i) => productCard(it, i, ind + '  ')), `${ind}</div>`))
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

const PLAN = {
  amber: { card: '', quote: ' a', btn: 'btn-ghost' },
  featured: { card: ' featured', quote: '', btn: 'btn-primary' },
  purple: { card: '', quote: ' p', btn: 'btn-ghost' },
  blue: { card: '', quote: ' b', btn: 'btn-ghost' },
}
const BTN_STYLE = {
  'btn-ghost': 'justify-content:center;border-color:rgba(15,23,42,.15);color:#0F172A',
  'btn-primary': 'justify-content:center',
}

function pricing(pr, ind) {
  const out = [
    `${ind}<div class="pricing-intro">`,
    `${ind}  <p class="section-label rv">Pricing</p>`,
    `${ind}  <h2 class="section-title rv d1">${esc(pr.title)}</h2>`,
    `${ind}  <p class="section-sub rv d2">${esc(pr.intro)}</p>`,
    `${ind}</div>`,
    `${ind}<div class="pricing-grid">`,
  ]
  ;(pr.plans || []).forEach((pl, i) => {
    const s = PLAN[pl.style] || PLAN.amber
    const quote = String(pl.quote || '').split('\n').map(l => esc(l.trim())).filter(Boolean).join('<br>')
    out.push(
      `${ind}  <div class="price-card${s.card} rv${['', ' d1', ' d2'][i % 3]}">`,
      `${ind}    <p class="plan-name">${esc(pl.name)}</p>`,
      `${ind}    <div class="plan-quote${s.quote}">${quote}</div>`,
    )
    if (pl.period) out.push(`${ind}    <p class="plan-period">${esc(pl.period)}</p>`)
    out.push(`${ind}    <p class="plan-desc">${esc(pl.description)}</p>`)
    if ((pl.features || []).length) {
      out.push(`${ind}    <ul class="plan-features">`)
      for (const f of pl.features) out.push(`${ind}      <li>${CHECK}${esc(f)}</li>`)
      out.push(`${ind}    </ul>`)
    }
    out.push(`${ind}    <a href="${link(pl.cta_link)}" class="${s.btn}" style="${BTN_STYLE[s.btn]}">${esc(pl.cta_label)}</a>`, `${ind}  </div>`)
  })
  out.push(`${ind}</div>`)
  if (pr.payment_methods) out.push(`${ind}<p class="pricing-foot rv">${esc(pr.payment_methods)}</p>`)
  return out
}

function faq(f, ind) {
  const items = (f.items || []).map((it, i) => {
    const n = i + 1
    return [
      `${ind}  <div class="faq-item rv${i % 2 ? ' d1' : ''}">`,
      `${ind}    <button type="button" class="faq-q" id="faq-q-${n}" aria-expanded="false" aria-controls="faq-a-${n}"><span>${esc(it.q)}</span><span class="faq-icon">${PLUS}</span></button>`,
      `${ind}    <div class="faq-a" id="faq-a-${n}" role="region" aria-labelledby="faq-q-${n}"><div><p>${esc(it.a)}</p></div></div>`,
      `${ind}  </div>`,
    ]
  })
  return spaced(`${ind}<div class="faq-grid">`, items, `${ind}</div>`)
}

function contact(c, ind) {
  const item = (svg, label, val) => [
    `${ind}  <div class="contact-item">`,
    `${ind}    <div class="contact-icon">${CONTACT_SVG(svg)}</div>`,
    `${ind}    <div><div class="contact-item-label">${label}</div><div class="contact-item-val">${val}</div></div>`,
    `${ind}  </div>`,
  ]
  const out = [`${ind}<div class="contact-details rv d3">`]
  out.push(...item(MAIL, 'Email', `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`))
  out.push(...item(PHONE, 'WhatsApp', `<a href="https://wa.me/${phoneDigits(c.whatsapp)}" target="_blank" rel="noopener noreferrer">${esc(c.whatsapp)}</a>`))
  if (c.location) out.push(...item(PIN, 'Based in', esc(c.location)))
  if (c.response_time) out.push(...item(CLOCK, 'Response time', esc(c.response_time)))
  out.push(`${ind}</div>`)
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
