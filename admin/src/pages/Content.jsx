import { useEffect, useMemo, useState } from 'react'
import { NavLink, useParams } from 'react-router-dom'
import { Eye, Save, Undo2 } from 'lucide-react'
import { ICONS, PLAN_STYLES, PRODUCT_STATUSES, youTubeId } from '../../../shared/render.js'
import { sectionProblems, useDraft } from '../lib/content'
import { PageTitle } from '../components/Layout'
import { Area, Lines, ListEditor, Notice, Problems, Select, Text, Toggle } from '../components/fields'
import Preview from '../components/Preview'

const LINK_HELP = 'A part of the page (#contact, #products…) or a full web address (https://…)'

const TABS = [
  { key: 'top', label: 'Top of the page', sections: ['announcement', 'hero'], Editor: TopEditor },
  { key: 'products', label: 'Products', sections: ['products'], Editor: ProductsEditor },
  { key: 'pricing', label: 'Pricing', sections: ['pricing'], Editor: PricingEditor },
  { key: 'faq', label: 'FAQ', sections: ['faq'], Editor: FaqEditor },
  { key: 'contact', label: 'Contact & video', sections: ['contact', 'video'], Editor: ContactEditor },
]

export default function Content() {
  const draft = useDraft()
  const { tab = 'top' } = useParams()
  const active = TABS.find(t => t.key === tab) || TABS[0]
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const [preview, setPreview] = useState(false)

  // Leaving the page with unsaved changes asks first
  useEffect(() => {
    if (!draft.dirty.length) return
    const warn = e => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [draft.dirty.length])
  useEffect(() => setMessage(null), [tab])

  const problems = useMemo(
    () => (draft.saved ? active.sections.flatMap(s => sectionProblems(s, draft.current(s))) : []),
    [draft, active],
  )
  if (draft.error) return <Notice tone="error">{draft.error}</Notice>
  if (draft.loading) return <p className="text-sm text-slate-500">Loading the website content…</p>

  const dirtyHere = active.sections.filter(s => draft.dirty.includes(s))
  async function save() {
    setBusy(true); setMessage(null)
    try {
      await draft.save(active.sections)
      setMessage({ tone: 'ok', text: 'Saved. Publish from the Overview when you\'re ready for it to go live.' })
    } catch (err) {
      setMessage({ tone: 'error', text: err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageTitle title="Website content" sub="Changes are saved as a draft. Nothing on the live site changes until someone publishes." />

      <nav aria-label="Parts of the page" className="mb-6 flex gap-1 overflow-x-auto rounded-xl bg-slate-200/70 p-1">
        {TABS.map(t => {
          const dirty = t.sections.some(s => draft.dirty.includes(s))
          return (
            <NavLink key={t.key} to={`/content/${t.key}`}
              className={({ isActive }) => `whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold ${isActive || (t.key === 'top' && tab === 'top') ? 'bg-white text-navy shadow-sm' : 'text-slate-600 hover:text-navy'}`}>
              {t.label}{dirty && <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-amber" aria-label="(unsaved changes)" />}
            </NavLink>
          )
        })}
      </nav>

      <div className="sticky top-[52px] z-10 -mx-4 mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur sm:-mx-8 sm:px-8 lg:top-0">
        <p className="text-sm text-slate-600">{dirtyHere.length ? 'You have unsaved changes on this tab.' : 'Everything on this tab is saved.'}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-ghost" onClick={() => setPreview(true)}><Eye size={15} /> Preview</button>
          {dirtyHere.length > 0 && (
            <button type="button" className="btn-ghost" onClick={() => { if (confirm('Throw away your unsaved changes on this tab?')) draft.discard(active.sections) }}>
              <Undo2 size={15} /> Discard
            </button>
          )}
          <button type="button" className="btn-primary" disabled={!dirtyHere.length || problems.length > 0 || busy} onClick={save}>
            <Save size={15} /> {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
        {dirtyHere.length > 0 && <Problems problems={problems} title="Fix these before saving" />}
        <active.Editor draft={draft} />
      </div>

      {preview && <Preview content={draft.content()} title="Preview, including unsaved changes" onClose={() => setPreview(false)} />}
    </>
  )
}

function Card({ title, sub, children }) {
  return (
    <section className="card space-y-4">
      <div>
        <h2 className="font-display text-lg font-extrabold">{title}</h2>
        {sub && <p className="text-sm text-slate-600">{sub}</p>}
      </div>
      {children}
    </section>
  )
}

const useSection = (draft, name) => {
  const value = draft.current(name)
  return [value, patch => draft.edit(name, { ...value, ...patch })]
}

// ── Top of the page ────────────────────────────────────────

function TopEditor({ draft }) {
  const [a, setA] = useSection(draft, 'announcement')
  const [h, setH] = useSection(draft, 'hero')
  const words = [...new Set(`${h.headline_line1 || ''} ${h.headline_line2 || ''}`.split(/\s+/).filter(Boolean))]
  return (
    <>
      <Card title="Announcement bar" sub="A strip across the very top of the site, for news or offers.">
        <Toggle label="Show the announcement bar" checked={a.enabled} onChange={enabled => setA({ enabled })} />
        {a.enabled && (
          <>
            <Text label="Text" value={a.text} max={120} onChange={text => setA({ text })} placeholder="e.g. New: TSF Monitor 2.0 is live"
              help="It's one line: about 40 characters (with the link) fit on a phone before it's cut off. Check with Preview → Phone." />
            <div className="grid gap-4 sm:grid-cols-2">
              <Text label="Link text (optional)" value={a.link_label} max={30} onChange={link_label => setA({ link_label })} placeholder="See what's new" />
              <Text label="Link (optional)" value={a.link_url} onChange={link_url => setA({ link_url })} help={LINK_HELP} mono />
            </div>
          </>
        )}
      </Card>

      <Card title="Headline" sub="The first thing visitors read.">
        <Text label="Small label above the headline" value={h.eyebrow} max={60} onChange={eyebrow => setH({ eyebrow })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Text label="Headline, line 1" value={h.headline_line1} max={40} onChange={headline_line1 => setH({ headline_line1 })} />
          <Text label="Headline, line 2" value={h.headline_line2} max={40} onChange={headline_line2 => setH({ headline_line2 })} />
        </div>
        <Select label="Word shown in amber" value={h.highlight} onChange={highlight => setH({ highlight })}
          options={{ '': 'None', ...Object.fromEntries(words.map(w => [w, w])) }} />
        <Area label="Paragraph under the headline" value={h.sub} max={400} onChange={sub => setH({ sub })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Text label="Main button text" value={h.primary_label} max={30} onChange={primary_label => setH({ primary_label })} />
          <Text label="Main button link" value={h.primary_link} onChange={primary_link => setH({ primary_link })} help={LINK_HELP} mono />
          <Text label="Second button text (optional)" value={h.secondary_label} max={30} onChange={secondary_label => setH({ secondary_label })} />
          <Text label="Second button link" value={h.secondary_link} onChange={secondary_link => setH({ secondary_link })} help={LINK_HELP} mono />
        </div>
      </Card>

      <Card title="Numbers under the headline" sub="Up to four. Whole numbers count up when they come into view.">
        <ListEditor items={h.stats} onChange={stats => setH({ stats })} max={4} addLabel="Add a number"
          itemLabel={(s, i) => `Number ${i + 1}`} make={() => ({ value: '', label: '' })}
          render={(s, set) => (
            <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
              <Text label="Number" value={s.value} max={8} onChange={value => set({ value })} />
              <Text label="What it counts" value={s.label} max={40} onChange={label => set({ label })} />
            </div>
          )} />
      </Card>
    </>
  )
}

// ── Products ──────────────────────────────────────────────

const newProduct = () => ({
  show: true, icon: 'box', status: 'coming_soon', sector: '', name: '', short_name: '', description: '',
  modules: [], url: '', link_note: '', cta_label: 'Book a demo', cta_link: '#contact',
})

function IconPicker({ value, onChange }) {
  return (
    <fieldset>
      <legend className="label">Icon</legend>
      <div className="flex flex-wrap gap-2">
        {Object.entries(ICONS).map(([key, svg]) => (
          <button key={key} type="button" title={key} aria-label={key} aria-pressed={value === key} onClick={() => onChange(key)}
            className={`flex h-10 w-10 items-center justify-center rounded-lg border ${value === key ? 'border-amber-600 bg-amber-50 ring-2 ring-amber/40' : 'border-slate-200 bg-white hover:border-slate-400'}`}>
            {/* ICONS are fixed drawings from the renderer, not user content */}
            <svg viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function ProductsEditor({ draft }) {
  const [p, setP] = useSection(draft, 'products')
  return (
    <>
      <Card title="Products heading">
        <div className="grid gap-4 sm:grid-cols-2">
          <Text label="Heading" value={p.title} max={80} onChange={title => setP({ title })} />
          <Text label="Small note beside it (optional)" value={p.note} max={60} onChange={note => setP({ note })} />
        </div>
      </Card>
      <Card title="Product cards" sub="In the order they appear. Products with a website also appear in the footer.">
        <ListEditor items={p.items} onChange={items => setP({ items })} addLabel="Add a product" make={newProduct} min={1}
          itemLabel={(it, i) => `${i + 1}. ${it.name || 'New product'}${it.show === false ? ' (hidden)' : ''}`}
          render={(it, set) => (
            <div className="space-y-4">
              <Toggle label="Show on the website" checked={it.show !== false} onChange={show => set({ show })}
                help="Turn off to hide it without deleting it." />
              <div className="grid gap-4 sm:grid-cols-2">
                <Text label="Name" value={it.name} max={60} onChange={name => set({ name })} />
                <Text label="Shorter name for the footer (optional)" value={it.short_name} max={40} onChange={short_name => set({ short_name })} />
                <Text label="Sector" value={it.sector} max={40} onChange={sector => set({ sector })} placeholder="e.g. Mining & industrial" />
                <Select label="Badge" value={it.status} onChange={status => set({ status })} options={PRODUCT_STATUSES} />
              </div>
              <IconPicker value={it.icon} onChange={icon => set({ icon })} />
              <Area label="Description" value={it.description} max={400} onChange={description => set({ description })} />
              <Lines label="Features (small tags)" value={it.modules} onChange={modules => set({ modules })} placeholder={'HR & payroll\nInventory'} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Text label="Website (optional)" value={it.url} onChange={url => set({ url: url.trim() })} mono
                  placeholder="https://…" help="Shown as a link on the card and in the footer." />
                {!it.url && <Text label="Text instead of a link" value={it.link_note} max={40} onChange={link_note => set({ link_note })} placeholder="e.g. Quoted per project" />}
                <Text label="Button text" value={it.cta_label} max={30} onChange={cta_label => set({ cta_label })} />
                <Text label="Button link" value={it.cta_link} onChange={cta_link => set({ cta_link })} help={LINK_HELP} mono />
              </div>
            </div>
          )} />
      </Card>
    </>
  )
}

// ── Pricing ───────────────────────────────────────────────

function PricingEditor({ draft }) {
  const [pr, setPr] = useSection(draft, 'pricing')
  return (
    <>
      <Card title="Pricing introduction">
        <Text label="Heading" value={pr.title} max={80} onChange={title => setPr({ title })} />
        <Area label="Paragraph" value={pr.intro} max={500} onChange={intro => setPr({ intro })} />
        <Text label="Payment methods line (under the cards)" value={pr.payment_methods} max={200} onChange={payment_methods => setPr({ payment_methods })} />
      </Card>
      <Card title="Pricing cards" sub="Three fit side by side on a computer.">
        <ListEditor items={pr.plans} onChange={plans => setPr({ plans })} addLabel="Add a card" min={1} max={6}
          itemLabel={(pl, i) => `${i + 1}. ${pl.name || 'New card'}`}
          make={() => ({ style: 'amber', name: '', quote: '', period: '', description: '', features: [], cta_label: 'Get a quote', cta_link: '#contact' })}
          render={(pl, set) => (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Text label="Name" value={pl.name} max={40} onChange={name => set({ name })} placeholder="e.g. Monthly subscription" />
                <Select label="Style" value={pl.style} onChange={style => set({ style })} options={PLAN_STYLES}
                  help="'Featured' adds the Most Popular tag and an amber button." />
              </div>
              <Area label="Big text" value={pl.quote} max={60} rows={2} onChange={quote => set({ quote })}
                help="Each line here is a line on the card." />
              <Text label="Small line under it (optional)" value={pl.period} max={40} onChange={period => set({ period })} />
              <Area label="Description" value={pl.description} max={300} onChange={description => set({ description })} />
              <Lines label="Points with ticks" value={pl.features} onChange={features => set({ features })} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Text label="Button text" value={pl.cta_label} max={30} onChange={cta_label => set({ cta_label })} />
                <Text label="Button link" value={pl.cta_link} onChange={cta_link => set({ cta_link })} help={LINK_HELP} mono />
              </div>
            </div>
          )} />
      </Card>
    </>
  )
}

// ── FAQ ───────────────────────────────────────────────────

function FaqEditor({ draft }) {
  const [f, setF] = useSection(draft, 'faq')
  return (
    <Card title="Frequently asked questions" sub="In the order they appear. Answers are plain text.">
      <ListEditor items={f.items} onChange={items => setF({ items })} addLabel="Add a question" min={1}
        itemLabel={(it, i) => `Question ${i + 1}`} make={() => ({ q: '', a: '' })}
        render={(it, set) => (
          <div className="space-y-4">
            <Text label="Question" value={it.q} max={120} onChange={q => set({ q })} />
            <Area label="Answer" value={it.a} max={1200} rows={4} onChange={a => set({ a })} />
          </div>
        )} />
    </Card>
  )
}

// ── Contact & video ──────────────────────────────────────

function ContactEditor({ draft }) {
  const [c, setC] = useSection(draft, 'contact')
  const [v, setV] = useSection(draft, 'video')
  const [link, setLink] = useState(v.youtube_id ? `https://youtu.be/${v.youtube_id}` : '')
  const onLink = text => {
    setLink(text)
    // Store the ID when one can be found; otherwise keep the text so the problem is shown
    setV({ youtube_id: text.trim() ? youTubeId(text) || text.trim() : '' })
  }
  return (
    <>
      <Card title="Contact details" sub="Changed everywhere they appear: the contact section, footer, WhatsApp button, privacy and terms pages, and search engines' business details.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Text label="Email" type="email" value={c.email} onChange={email => setC({ email: email.trim() })} />
          <Text label="WhatsApp number" value={c.whatsapp} onChange={whatsapp => setC({ whatsapp })} placeholder="+233 27 414 5249"
            help="With the country code, as you'd like it shown." />
          <Text label="Where you're based" value={c.location} max={60} onChange={location => setC({ location })} />
          <Text label="Response time" value={c.response_time} max={60} onChange={response_time => setC({ response_time })} />
        </div>
      </Card>
      <Card title="Overview video" sub="The 'A minute inside the platform' section. It only appears on the site when a video is set.">
        <Text label="YouTube video link" value={link} onChange={onLink} mono placeholder="https://www.youtube.com/watch?v=…"
          help={v.youtube_id && /^[A-Za-z0-9_-]{11}$/.test(v.youtube_id) ? `Video ID ${v.youtube_id} — the section will show once published.` : 'Paste the link from YouTube\'s Share button. Leave empty to hide the section.'} />
        <Text label="Length shown on the video" value={v.duration} max={8} onChange={duration => setV({ duration })} placeholder="1:00" />
      </Card>
    </>
  )
}
