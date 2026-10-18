import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

// A modal dialog: focus moves in and stays in, Escape closes it, the page
// behind doesn't scroll, and focus goes back where it was on close.
export function useModal(ref, onClose) {
  // Always the latest onClose, so a check it makes (unsaved notes) is current
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    const before = document.activeElement
    const el = ref.current
    const focusables = () => el.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])')
    ;(el.querySelector('[data-autofocus]') || focusables()[0])?.focus()
    // On the document, so keys still work when focus has fallen out of the
    // dialog (say, a button that just became disabled)
    const onKey = e => {
      if (e.key === 'Escape') { e.stopPropagation(); close.current(); return }
      if (e.key !== 'Tab') return
      const f = focusables(), first = f[0], last = f[f.length - 1]
      if (!el.contains(document.activeElement)) { e.preventDefault(); (e.shiftKey ? last : first)?.focus() }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; before?.focus?.() }
  }, [])   // eslint-disable-line react-hooks/exhaustive-deps
}

export default function Dialog({ title, sub, onClose, children, footer, wide }) {
  const ref = useRef(null)
  useModal(ref, onClose)
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div className="absolute inset-0 animate-fade-in bg-slate-900/50" onClick={onClose} aria-hidden="true" />
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="dialog-title"
        className={`relative flex max-h-[92vh] w-full animate-fade-up flex-col overflow-hidden rounded-t-3xl bg-white shadow-lift sm:rounded-3xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'}`}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div className="min-w-0">
            <h2 id="dialog-title" className="font-display text-xl font-extrabold tracking-tight text-navy">{title}</h2>
            {sub && <p className="mt-1 text-sm text-slate-600">{sub}</p>}
          </div>
          <button type="button" className="btn-icon h-9 w-9" onClick={onClose} aria-label="Close"><X size={18} aria-hidden="true" /></button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-5">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-slate-200 bg-slate-50 px-6 py-4">{footer}</div>}
      </div>
    </div>
  )
}
