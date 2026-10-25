import { useId, useRef, useState } from 'react'
import { ImagePlus, RefreshCw, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { isMediaUrl } from '../../../shared/render.js'

const TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }
const MAX_BYTES = 5 * 1024 * 1024
const slug = s => String(s || 'product').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'product'

// A screenshot of the platform's interface, stored in the site-media bucket.
// Each upload gets a new file name, so versions published earlier keep the
// picture they were published with.
export default function ScreenshotUpload({ value, name, onChange }) {
  const id = useId()
  const input = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function upload(file) {
    setError('')
    if (!file) return
    const ext = TYPES[file.type]
    if (!ext) { setError('Use a PNG, JPG or WebP image.'); return }
    if (file.size > MAX_BYTES) { setError(`That image is ${(file.size / 1048576).toFixed(1)} MB. The limit is 5 MB.`); return }
    setBusy(true)
    try {
      const path = `products/${slug(name)}-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('site-media').upload(path, file, { contentType: file.type, cacheControl: '31536000', upsert: false })
      if (upErr) throw upErr
      const { data } = supabase.storage.from('site-media').getPublicUrl(path)
      onChange(data.publicUrl)
    } catch (err) {
      setError(/row-level security|not authorized|403/i.test(String(err?.message))
        ? 'Only admins and editors can upload screenshots.'
        : `The upload didn’t go through: ${err?.message || err}`)
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  const has = isMediaUrl(value)
  return (
    <div>
      <p className="label" id={`${id}-label`}>Interface screenshot</p>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="aspect-[16/10] w-full shrink-0 overflow-hidden bg-slate-100 sm:w-56">
          {has
            ? <img src={value} alt={`Screenshot of ${name || 'this product'}`} className="h-full w-full object-cover object-left-top" />
            : <div className="grid h-full place-items-center p-4 text-center text-[13px] text-slate-500">No screenshot yet. The card shows the amber background with the platform’s name.</div>}
        </div>
        <div className="min-w-0 space-y-3">
          <input ref={input} id={id} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only"
            aria-labelledby={`${id}-label`} onChange={e => upload(e.target.files?.[0])} disabled={busy} />
          <div className="flex flex-wrap gap-2">
            <label htmlFor={id} className={`btn-dark cursor-pointer ${busy ? 'pointer-events-none opacity-60' : ''}`}>
              {has ? <RefreshCw size={16} aria-hidden="true" /> : <ImagePlus size={16} aria-hidden="true" />}
              {busy ? 'Uploading…' : has ? 'Replace screenshot' : 'Upload screenshot'}
            </label>
            {has && !busy && (
              <button type="button" className="btn-ghost" onClick={() => { setError(''); onChange('') }}>
                <Trash2 size={16} aria-hidden="true" /> Remove
              </button>
            )}
          </div>
          <p className="help">PNG, JPG or WebP, up to 5 MB. A wide shot of the dashboard works best (about 1600 × 1000). The top-left corner always stays in view.</p>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        </div>
      </div>
    </div>
  )
}
