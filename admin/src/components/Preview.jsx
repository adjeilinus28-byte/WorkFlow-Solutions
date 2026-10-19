import { useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, Maximize2, Monitor, Smartphone, X } from 'lucide-react'
import { previewHtml } from '../lib/content'
import { useModal } from './Dialog'

function SizeSwitch({ phone, setPhone, dark }) {
  const on = dark ? 'bg-white text-navy' : 'bg-white text-navy'
  const off = dark ? 'text-slate-200 hover:text-white' : 'text-slate-600 hover:text-navy'
  return (
    <div className={`flex p-1 ${dark ? 'bg-white/10' : 'bg-slate-100'}`} role="group" aria-label="Screen size">
      {[[false, Monitor, 'Desktop'], [true, Smartphone, 'Phone']].map(([value, Icon, label]) => (
        <button key={label} type="button" onClick={() => setPhone(value)} aria-pressed={phone === value}
          className={`flex min-h-[34px] items-center gap-1.5 px-3 text-sm font-semibold transition-colors ${phone === value ? on : off}`}>
          <Icon size={15} aria-hidden="true" /> {label}
        </button>
      ))}
    </div>
  )
}

// The home page rendered from content by the same code the build uses.
// Sandboxed: its scripts run, but it can't touch the admin or your login.
export default function Preview({ content, title = 'Preview', onClose }) {
  const [phone, setPhone] = useState(false)
  const html = useMemo(() => previewHtml(content), [content])
  const ref = useRef(null)
  useModal(ref, onClose)

  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 flex animate-fade-in flex-col bg-slate-900/90">
      <div className="flex items-center justify-between gap-3 bg-navy px-4 py-3 text-white">
        <p className="truncate text-sm font-semibold">{title}</p>
        <div className="flex items-center gap-2">
          <SizeSwitch phone={phone} setPhone={setPhone} dark />
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center hover:bg-white/10" aria-label="Close preview"><X size={20} aria-hidden="true" /></button>
        </div>
      </div>
      <div className="flex flex-1 justify-center overflow-hidden p-3 sm:p-6">
        <iframe title="Website preview" sandbox="allow-scripts" srcDoc={html}
          className={`h-full bg-white ${phone ? 'w-[390px]' : 'w-full'}`} />
      </div>
    </div>
  )
}

// Beside the editor on wide screens: the page as it stands, unsaved edits
// included, scaled to fit. Re-renders a moment after typing stops.
export function LivePreview({ content, onExpand }) {
  const [phone, setPhone] = useState(false)
  const [settled, setSettled] = useState(content)
  const [box, setBox] = useState({ w: 0, h: 0 })
  const frame = useRef(null)
  const stage = useRef(null)
  const scroll = useRef(0)

  useEffect(() => { const t = setTimeout(() => setSettled(content), 400); return () => clearTimeout(t) }, [content])
  useEffect(() => {
    const onMsg = e => { if (e.source === frame.current?.contentWindow && typeof e.data?.wfsPreviewScroll === 'number') scroll.current = e.data.wfsPreviewScroll }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(stage.current)
    return () => ro.disconnect()
  }, [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const html = useMemo(() => previewHtml(settled, { still: true, scrollY: scroll.current }), [settled, phone])

  const width = phone ? 390 : 1280
  const scale = box.w ? Math.min(1, box.w / width) : 0
  return (
    <section className="card flex h-full flex-col p-5" aria-labelledby="live-preview-title">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="live-preview-title" className="card-title">Preview</h2>
          <p className="text-sm text-slate-600">Unsaved edits included</p>
        </div>
        <div className="flex items-center gap-2">
          <SizeSwitch phone={phone} setPhone={setPhone} />
          <button type="button" className="btn-icon h-[42px] w-[42px]" onClick={onExpand} aria-label="Open the preview full size" title="Full size"><Maximize2 size={16} aria-hidden="true" /></button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden border border-slate-200 bg-slate-100">
        <div className="flex items-center gap-3 bg-slate-100 px-3 py-2" aria-hidden="true">
          <span className="flex gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-red-400" /><i className="h-2.5 w-2.5 rounded-full bg-amber" /><i className="h-2.5 w-2.5 rounded-full bg-emerald-400" /></span>
          <span className="flex-1 truncate rounded-full bg-slate-100 px-3 py-1 text-center text-xs text-slate-600">workflow-app.net</span>
          <ExternalLink size={14} className="text-slate-400" />
        </div>
        <div ref={stage} className="relative min-h-0 flex-1 overflow-hidden">
          {scale > 0 && (
            <iframe ref={frame} title="Live preview of the website" sandbox="allow-scripts" srcDoc={html}
              className="absolute left-1/2 top-0 origin-top bg-white"
              style={{ width, height: box.h / scale, transform: `translateX(-50%) scale(${scale})` }} />
          )}
        </div>
      </div>
    </section>
  )
}
