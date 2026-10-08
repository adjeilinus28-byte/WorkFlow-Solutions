import { useEffect, useMemo, useState } from 'react'
import { Monitor, Smartphone, X } from 'lucide-react'
import { previewHtml } from '../lib/content'

// The home page rendered from content by the same code the build uses.
// Sandboxed: its scripts run, but it can't touch the admin or your login.
export default function Preview({ content, title = 'Preview', onClose }) {
  const [phone, setPhone] = useState(false)
  const html = useMemo(() => previewHtml(content), [content])

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [onClose])

  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 flex flex-col bg-slate-900/90">
      <div className="flex items-center justify-between gap-3 bg-navy px-4 py-3 text-white">
        <p className="truncate text-sm font-semibold">{title}</p>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-white/10 p-0.5" role="group" aria-label="Screen size">
            <button type="button" onClick={() => setPhone(false)} aria-pressed={!phone}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold ${!phone ? 'bg-white text-navy' : 'text-slate-200'}`}>
              <Monitor size={14} /> Desktop
            </button>
            <button type="button" onClick={() => setPhone(true)} aria-pressed={phone}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold ${phone ? 'bg-white text-navy' : 'text-slate-200'}`}>
              <Smartphone size={14} /> Phone
            </button>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 hover:bg-white/10" aria-label="Close preview"><X size={20} /></button>
        </div>
      </div>
      <div className="flex flex-1 justify-center overflow-hidden p-3 sm:p-6">
        <iframe title="Website preview" sandbox="allow-scripts" srcDoc={html}
          className={`h-full rounded-lg bg-white shadow-2xl transition-all ${phone ? 'w-[390px]' : 'w-full'}`} />
      </div>
    </div>
  )
}
