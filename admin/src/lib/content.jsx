import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import template from '../../../index.html?raw'
import defaults from '../../../content/defaults.json'
import { renderHome, validateContent, withDefaults } from '../../../shared/render.js'
import { callFunction, rpc } from './api'

export { defaults }

// The problems in one section alone: the other sections are the (valid)
// defaults, so whatever validation reports comes from this one.
export const sectionProblems = (name, data) => validateContent(withDefaults({ [name]: data }, defaults))

// The page exactly as the build would render it, for the preview frame.
// The side-by-side preview re-renders as you type, so it shows the page at
// rest (no entrance motion) and reports its scroll position, letting the
// next render open where you were reading.
export function previewHtml(content, { still = false, scrollY = 0 } = {}) {
  let html
  try {
    html = renderHome(template, content, defaults)
  } catch (err) {
    return `<p style="font:16px system-ui;padding:32px;color:#B91C1C">This can't be previewed yet: ${String(err.message).replace(/</g, '&lt;')}</p>`
  }
  const head = [`<base href="${window.location.origin}/">`]
  if (still) head.push(`<script>var mm=window.matchMedia;window.matchMedia=function(q){return /reduced-motion/.test(q)?{matches:true,addEventListener:function(){},addListener:function(){}}:mm.call(window,q)}</script>`)
  const tail = still
    ? `<script>requestAnimationFrame(function(){scrollTo({top:${Math.max(0, Math.round(scrollY))},behavior:'instant'})});addEventListener('scroll',function(){parent.postMessage({wfsPreviewScroll:scrollY},'*')},{passive:true})</script>`
    : ''
  return html
    .replace('<head>', `<head>\n${head.join('\n')}`)
    .replace('</head>', '<style>#cookie-banner{display:none!important}</style>\n</head>')
    .replace('</body>', `${tail}</body>`)
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const DraftContext = createContext(null)

export function DraftProvider({ children }) {
  const [saved, setSaved] = useState(null)      // what site_get_content returned
  const [edits, setEdits] = useState({})        // unsaved changes, by section
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const data = await rpc('site_get_content')
      setSaved(data)
      setEdits({})
      setError('')
      return data
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [])

  useEffect(() => { load().catch(() => {}) }, [load])

  const value = useMemo(() => {
    const current = name => edits[name] ?? saved?.content?.[name] ?? defaults[name]
    const dirty = Object.keys(edits).filter(n => !same(edits[n], saved?.content?.[n] ?? defaults[n]))
    return {
      loading: !saved && !error,
      error,
      saved,
      dirty,
      current,
      content: () => Object.fromEntries(Object.keys(defaults).map(n => [n, current(n)])),
      edit: (name, data) => setEdits(e => ({ ...e, [name]: data })),
      discard: names => setEdits(e => Object.fromEntries(Object.entries(e).filter(([n]) => !names.includes(n)))),
      reload: load,
      async save(names) {
        for (const name of names.filter(n => dirty.includes(n))) {
          await rpc('site_save_section', {
            p_section: name,
            p_data: current(name),
            p_expected_updated_at: saved?.sections?.[name]?.updated_at ?? null,
          })
        }
        return load()
      },
      async publish(note) {
        const result = await callFunction('site-publish', { note })
        await load()
        return result
      },
      async rebuild() {
        const result = await callFunction('site-publish', { action: 'rebuild' })
        await load()
        return result
      },
    }
  }, [saved, edits, error, load])

  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>
}

export const useDraft = () => useContext(DraftContext)
