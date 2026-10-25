import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useParams, useNavigate } from 'react-router-dom'
import { CloudUpload, Eye, Undo2 } from 'lucide-react'
import { PLAN_STYLES, PRODUCT_STATUSES, youTubeId } from '../../../shared/render.js'
import { sectionProblems, useDraft } from '../lib/content'
import { PageTitle } from '../components/Layout'
import { Area, Lines, ListEditor, Notice, Problems, Select, Skeleton, Text, Toggle } from '../components/fields'
import Preview, { LivePreview } from '../components/Preview'
import ScreenshotUpload from '../components/ScreenshotUpload'
import { PublishDialog, SECTION_LABELS, SECTION_TAB } from '../components/Publish'

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
  const navigate = useNavigate()
  const { tab = 'top' } = useParams()
  const active = TABS.find(t => t.key === tab) || TABS[0]
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const [preview, setPreview] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [showProblems, setShowProblems] = useState(false)
  const problemsRef = useRef(null)

  // Leaving the site with unsaved changes asks first
  useEffect(() => {
    if (!draft.dirty.length) return
    const warn = e => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [draft.dirty.length])
  useEffect(() => setMessage(null), [tab])

  // Problems in anything edited, wherever it is
  const problems = useMemo(
    () => (draft.saved ? draft.dirty.flatMap(s => sectionProblems(s, draft.current(s)).map(p => ({ section: s, text: p }))) : []),
    [draft],
  )
  useEffect(() => { if (!problems.length) setShowProblems(false) }, [problems.length])
  if (draft.error) return <Notice tone="error">{draft.error}</Notice>
  if (draft.loading) return <div className="card"><Skeleton rows={4} /></div>

  const dirty = draft.dirty
  async function save() {
    setMessage(null)
    // Saving stays possible; problems are shown, and the first one's tab opened
    if (problems.length) {
      setShowProblems(true)
      if (!active.sections.includes(problems[0].section)) navigate(`/content/${SECTION_TAB[problems[0].section]}`)
      requestAnimationFrame(() => problemsRef.current?.focus())
      return
    }
    setBusy(true)
    try {
      await draft.save(dirty)
      setMessage({ tone: 'ok', text: 'Saved to the draft. Publish when you’re ready for it to go live.' })
    } catch (err) {
      setMessage({ tone: 'error', text: err.message })
    } finally {
      setBusy(false)
    }
  }
  const waiting = draft.saved?.unpublished_changes

  return (
    <>
      <PageTitle title="Website content" sub="Changes save to a draft. The live site only changes when you publish.">
        <span className={`badge badge-dot px-3 py-1.5 text-[13px] ${dirty.length ? 'bg-amber-50 text-amber-800' : waiting ? 'bg-sky-50 text-sky-700' : 'bg-emerald-50 text-emerald-700'}`} aria-live="polite">
          {dirty.length ? `Draft · ${dirty.length} unsaved ${dirty.length === 1 ? 'change' : 'changes'}` : waiting ? 'Saved · not live yet' : 'Live site up to date'}
        </span>
        <button type="button" className="btn-ghost xl:hidden" onClick={() => setPreview(true)}><Eye size={15} aria-hidden="true" /> Preview</button>
        <button type="button" className="btn-ghost" disabled={!dirty.length || busy} onClick={save}>{busy ? 'Saving…' : 'Save draft'}</button>
        <button type="button" className="btn-primary" onClick={() => setPublishing(true)}>Publish… <CloudUpload size={16} aria-hidden="true" /></button>
      </PageTitle>

      <nav aria-label="Parts of the page" className="-mx-1 mb-6 flex gap-1 overflow-x-auto px-1">
        {TABS.map(t => {
          const edited = t.sections.some(s => dirty.includes(s))
          return (
            <NavLink key={t.key} to={`/content/${t.key}`}
              className={({ isActive }) => `relative flex min-h-[44px] items-center gap-2 whitespace-nowrap px-3 text-[15px] font-semibold transition-colors ${isActive || (t.key === 'top' && tab === 'top') ? 'bg-navy text-white' : 'bg-white text-slate-700 hover:text-navy'}`}>
              {t.label}{edited && <span className="h-2 w-2 rounded-full bg-amber" title="Unsaved changes" />}{edited && <span className="sr-only">(unsaved changes)</span>}
            </NavLink>
          )
        })}
      </nav>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-6">
          <div aria-live="polite">{message && <Notice tone={message.tone}>{message.text}</Notice>}</div>
          {showProblems && problems.length > 0 && (
            <div ref={problemsRef} tabIndex={-1} className="focus:outline-none">
              <Problems title="Fix these before saving" problems={problems.map(p => `${SECTION_LABELS[p.section]}: ${p.text}`)} />
            </div>
          )}
          <active.Editor draft={draft} />
          {dirty.length > 0 && (
            <div className="sticky bottom-4 z-20 flex animate-fade-up flex-wrap items-center justify-between gap-3 bg-navy px-5 py-3 text-white shadow-lift">
              <p className="text-sm">Unsaved changes in {dirty.map(n => SECTION_LABELS[n]).join(', ')}</p>
              <div className="flex gap-2">
                <button type="button" className="btn text-slate-200 hover:bg-white/10" onClick={() => { if (confirm('Throw away all your unsaved changes?')) draft.discard(dirty) }}>
                  <Undo2 size={15} aria-hidden="true" /> Discard
                </button>
                <button type="button" className="btn-primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save draft'}</button>
              </div>
            </div>
          )}
        </div>
        <div className="sticky top-6 hidden h-[calc(100vh-3rem)] xl:block">
          <LivePreview content={draft.content()} onExpand={() => setPreview(true)} />
        </div>
      </div>


      {preview && <Preview content={draft.content()} title="Preview, including unsaved changes" onClose={() => setPreview(false)} />}
      {publishing && <PublishDialog onClose={() => setPublishing(false)} />}
    </>
  )
}

function Card({ title, sub, section, draft, action, children }) {
  const edited = section && draft?.dirty.includes(section)
  return (
    <section className="card space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold text-navy">
            {title}{edited && <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">Edited</span>}
          </h2>
          {sub && <p className="mt-0.5 text-sm text-slate-600">{sub}</p>}
        </div>
        {action}
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
  return (
    <>
      <Card title="Announcement bar" sub="A strip across the very top of the site, for news or offers." section="announcement" draft={draft}
        action={<Toggle compact label={a.enabled ? 'Shown' : 'Hidden'} checked={a.enabled} onChange={enabled => setA({ enabled })} />}>
        {a.enabled && (
          <>
            <Text label="Text" value={a.text} max={120} onChange={text => setA({ text })} placeholder="e.g. New: TSF Monitor 2.0 is live…"
              help="It's one line: about 40 characters (with the link) fit on a phone before it's cut off. Check with Preview → Phone." />
            <div className="grid gap-4 sm:grid-cols-2">
              <Text label="Link text (optional)" value={a.link_label} max={30} onChange={link_label => setA({ link_label })} placeholder="See what’s new…" />
              <Text label="Link (optional)" value={a.link_url} onChange={link_url => setA({ link_url })} help={LINK_HELP} mono inputMode="url" />
            </div>
          </>
        )}
      </Card>

      <Card title="Headline" sub="The first thing visitors read." section="hero" draft={draft}>
        <Text label="Badge above the headline (optional)" value={h.badge} max={40} onChange={badge => setH({ badge })} placeholder="e.g. Built in Kumasi"
          help="Shown in the small pill above the headline, followed by the numbers below." />
        <div className="grid gap-4 sm:grid-cols-2">
          <Text label="Headline, line 1" value={h.headline_line1} max={40} onChange={headline_line1 => setH({ headline_line1 })}
            help="Keep each line to about 12 characters, so the headline stays on two lines on every screen." />
          <Text label="Headline, line 2" value={h.headline_line2} max={40} onChange={headline_line2 => setH({ headline_line2 })} />
        </div>
        <Area label="Paragraph under the headline" value={h.sub} max={400} onChange={sub => setH({ sub })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Text label="Main button text" value={h.primary_label} max={30} onChange={primary_label => setH({ primary_label })} />
          <Text label="Main button link" value={h.primary_link} onChange={primary_link => setH({ primary_link })} help={LINK_HELP} mono inputMode="url" />
          <Text label="Second button text (optional)" value={h.secondary_label} max={30} onChange={secondary_label => setH({ secondary_label })} />
          <Text label="Second button link" value={h.secondary_link} onChange={secondary_link => setH({ secondary_link })} help={LINK_HELP} mono inputMode="url" />
        </div>
      </Card>

      <Card title="Tick points under the buttons" sub="Short promises, each with a tick. Up to four; leave empty to hide them." section="hero" draft={draft}>
        <Lines label="Tick points" value={h.promises} onChange={promises => setH({ promises })} help="One per line, about 35 characters each" />
      </Card>

      <Card title="Numbers in the badge" sub="Up to four. They follow the badge above the headline, as a line." section="hero" draft={draft}>
        <ListEditor items={h.stats} onChange={stats => setH({ stats })} max={4} addLabel="Add a number"
          itemLabel={(s, i) => `Number ${i + 1}`} make={() => ({ value: '', label: '' })}
          render={(s, set) => (
            <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
              <Text label="Number" value={s.value} max={8} onChange={value => set({ value })} inputMode="numeric" />
              <Text label="What it counts" value={s.label} max={40} onChange={label => set({ label })} />
            </div>
          )} />
      </Card>

      <Card title="Sectors strip" sub="The band under the top of the page that names who the software is for." section="hero" draft={draft}>
        <Text label="Heading" value={h.sectors_label} max={80} onChange={sectors_label => setH({ sectors_label })} />
        <Lines label="Sectors" value={h.sectors} onChange={sectors => setH({ sectors })} help="One per line, up to eight" />
      </Card>
    </>
  )
}

// ── Products ──────────────────────────────────────────────

const newProduct = () => ({
  show: true, icon: 'box', status: 'coming_soon', sector: '', name: '', short_name: '', description: '',
  modules: [], url: '', link_note: '', image: '', cta_label: 'Book a demo', cta_link: '#contact',
})

function ProductsEditor({ draft }) {
  const [p, setP] = useSection(draft, 'products')
  return (
    <>
      <Card title="Products heading" section="products" draft={draft}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Text label="Heading" value={p.title} max={80} onChange={title => setP({ title })} />
          <Text label="Small note beside it (optional)" value={p.note} max={60} onChange={note => setP({ note })} />
        </div>
      </Card>
      <Card title="Product cards" sub="Live products lead, then the ones coming soon, then custom ones. Upload a screenshot of each platform to show it on its card. Products with a website also appear in the footer." section="products" draft={draft}>
        <ListEditor items={p.items} onChange={items => setP({ items })} addLabel="Add a product" make={newProduct} min={1}
          itemLabel={(it, i) => `${i + 1}. ${it.name || 'New product'}${it.show === false ? ' (hidden)' : ''}`}
          render={(it, set) => (
            <div className="space-y-4">
              <Toggle label="Show on the website" checked={it.show !== false} onChange={show => set({ show })}
                help="Turn off to hide it without deleting it." />
              <div className="grid gap-4 sm:grid-cols-2">
                <Text label="Name" value={it.name} max={60} onChange={name => set({ name })} />
                <Text label="Shorter name for the footer (optional)" value={it.short_name} max={40} onChange={short_name => set({ short_name })} />
                <Text label="Sector" value={it.sector} max={40} onChange={sector => set({ sector })} placeholder="e.g. Mining & industrial…" />
                <Select label="Badge" value={it.status} onChange={status => set({ status })} options={PRODUCT_STATUSES} />
              </div>
              <ScreenshotUpload value={it.image} name={it.name} onChange={image => set({ image })} />
              <Area label="Description" value={it.description} max={400} onChange={description => set({ description })} />
              <Lines label="Features (small tags)" value={it.modules} onChange={modules => set({ modules })} placeholder={'HR & payroll\nInventory'} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Text label="Website (optional)" type="url" value={it.url} onChange={url => set({ url: url.trim() })} mono
                  placeholder="https://…" help="Shown as a link on the card and in the footer." />
                {!it.url && <Text label="Text instead of a link" value={it.link_note} max={40} onChange={link_note => set({ link_note })} placeholder="e.g. Quoted per project…" />}
                <Text label="Button text" value={it.cta_label} max={30} onChange={cta_label => set({ cta_label })} />
                <Text label="Button link" value={it.cta_link} onChange={cta_link => set({ cta_link })} help={LINK_HELP} mono inputMode="url" />
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
      <Card title="Pricing introduction" section="pricing" draft={draft}>
        <Text label="Heading" value={pr.title} max={80} onChange={title => setPr({ title })} />
        <Area label="Paragraph" value={pr.intro} max={500} onChange={intro => setPr({ intro })} />
        <Text label="Payment methods line (under the cards)" value={pr.payment_methods} max={200} onChange={payment_methods => setPr({ payment_methods })} />
      </Card>
      <Card title="Pricing cards" sub="Three fit side by side on a computer." section="pricing" draft={draft}>
        <ListEditor items={pr.plans} onChange={plans => setPr({ plans })} addLabel="Add a card" min={1} max={6}
          itemLabel={(pl, i) => `${i + 1}. ${pl.name || 'New card'}`}
          make={() => ({ style: 'amber', name: '', quote: '', period: '', description: '', features: [], cta_label: 'Get a quote', cta_link: '#contact' })}
          render={(pl, set) => (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Text label="Name" value={pl.name} max={40} onChange={name => set({ name })} placeholder="e.g. Monthly subscription…" />
                <Select label="Style" value={pl.style} onChange={style => set({ style })} options={PLAN_STYLES}
                  help="Featured is the dark card with the amber button." />
              </div>
              <Area label="Big text" value={pl.quote} max={60} rows={2} onChange={quote => set({ quote })}
                help="Each line here is a line on the card." />
              <Text label="Small line under it (optional)" value={pl.period} max={40} onChange={period => set({ period })} />
              <Area label="Description" value={pl.description} max={300} onChange={description => set({ description })} />
              <Lines label="Points with ticks" value={pl.features} onChange={features => set({ features })} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Text label="Button text" value={pl.cta_label} max={30} onChange={cta_label => set({ cta_label })} />
                <Text label="Button link" value={pl.cta_link} onChange={cta_link => set({ cta_link })} help={LINK_HELP} mono inputMode="url" />
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
    <Card title="Frequently asked questions" sub="In the order they appear. Answers are plain text." section="faq" draft={draft}>
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
      <Card title="Contact details" sub="Changed everywhere they appear: the contact section, footer, WhatsApp button, privacy and terms pages, and search engines’ business details." section="contact" draft={draft}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Text label="Email" type="email" value={c.email} onChange={email => setC({ email: email.trim() })} />
          <Text label="WhatsApp number" type="tel" value={c.whatsapp} onChange={whatsapp => setC({ whatsapp })} placeholder="+233 27 414 5249…"
            help="With the country code, as you’d like it shown." />
          <Text label="Where you’re based" value={c.location} max={60} onChange={location => setC({ location })} />
          <Text label="Response time" value={c.response_time} max={60} onChange={response_time => setC({ response_time })} />
        </div>
      </Card>
      <Card title="Overview video" sub="The “A minute inside the platform” section. It only appears on the site when a video is set." section="video" draft={draft}>
        <Text label="YouTube video link" type="url" value={link} onChange={onLink} mono placeholder="https://www.youtube.com/watch?v=…"
          help={v.youtube_id && /^[A-Za-z0-9_-]{11}$/.test(v.youtube_id) ? `Video ID ${v.youtube_id} — the section will show once published.` : 'Paste the link from YouTube’s Share button. Leave empty to hide the section.'} />
        <Text label="Length shown on the video" value={v.duration} max={8} onChange={duration => setV({ duration })} placeholder="1:00…" />
      </Card>
    </>
  )
}
