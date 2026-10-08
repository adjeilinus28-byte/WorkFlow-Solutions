import { useEffect, useId, useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'

export function Text({ label, value, onChange, help, max, placeholder, type = 'text', disabled, mono }) {
  const id = useId()
  const v = value ?? ''
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <input id={id} type={type} className={`inp ${mono ? 'font-mono' : ''}`} value={v} maxLength={max} placeholder={placeholder}
        disabled={disabled} onChange={e => onChange(e.target.value)} />
      <Help help={help} max={max} length={v.length} />
    </div>
  )
}

export function Area({ label, value, onChange, help, max, rows = 3, placeholder, disabled }) {
  const id = useId()
  const v = value ?? ''
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <textarea id={id} className="inp resize-y" rows={rows} value={v} maxLength={max} placeholder={placeholder}
        disabled={disabled} onChange={e => onChange(e.target.value)} />
      <Help help={help} max={max} length={v.length} />
    </div>
  )
}

function Help({ help, max, length }) {
  if (!help && !max) return null
  return (
    <p className="help flex justify-between gap-3">
      <span>{help}</span>
      {max ? <span className={length > max * 0.9 ? 'text-amber-700' : ''}>{length}/{max}</span> : null}
    </p>
  )
}

export function Select({ label, value, onChange, options, help }) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <select id={id} className="inp" value={value ?? ''} onChange={e => onChange(e.target.value)}>
        {Object.entries(options).map(([v, text]) => <option key={v} value={v}>{text}</option>)}
      </select>
      {help && <p className="help">{help}</p>}
    </div>
  )
}

export function Toggle({ label, checked, onChange, help }) {
  const id = useId()
  return (
    <div className="flex items-start gap-3">
      <input id={id} type="checkbox" className="mt-1 h-4 w-4 accent-amber-600" checked={!!checked} onChange={e => onChange(e.target.checked)} />
      <label htmlFor={id} className="text-sm text-slate-700">
        <span className="font-medium text-navy">{label}</span>
        {help && <span className="block text-xs text-slate-500">{help}</span>}
      </label>
    </div>
  )
}

// A list of things (products, FAQs, stats…) with add, remove and reorder.
export function ListEditor({ items, onChange, render, make, addLabel, itemLabel, max, min = 0 }) {
  const list = items || []
  const move = (i, d) => {
    const next = [...list]
    ;[next[i], next[i + d]] = [next[i + d], next[i]]
    onChange(next)
  }
  return (
    <div className="space-y-3">
      {list.map((item, i) => (
        <div key={i} data-list-item className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{itemLabel(item, i)}</span>
            <div className="flex gap-1">
              <IconButton label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={15} /></IconButton>
              <IconButton label="Move down" disabled={i === list.length - 1} onClick={() => move(i, 1)}><ArrowDown size={15} /></IconButton>
              <IconButton label="Remove" danger disabled={list.length <= min}
                onClick={() => { if (confirm(`Remove ${itemLabel(item, i)}?`)) onChange(list.filter((_, j) => j !== i)) }}>
                <Trash2 size={15} />
              </IconButton>
            </div>
          </div>
          {render(item, patch => onChange(list.map((x, j) => (j === i ? { ...x, ...patch } : x))), i)}
        </div>
      ))}
      {(!max || list.length < max) && (
        <button type="button" className="btn-ghost" onClick={() => onChange([...list, make()])}><Plus size={15} /> {addLabel}</button>
      )}
    </div>
  )
}

function IconButton({ label, onClick, disabled, danger, children }) {
  return (
    <button type="button" title={label} aria-label={label} onClick={onClick} disabled={disabled}
      className={`rounded-md p-1.5 text-slate-500 hover:bg-white disabled:opacity-30 ${danger ? 'hover:text-red-600' : 'hover:text-navy'}`}>
      {children}
    </button>
  )
}

// A list of short strings edited as one line each (modules, plan points).
// The text is kept as typed, so pressing Enter gives an empty line to type
// on; only the non-empty lines are handed back.
const toLines = text => text.split('\n').map(s => s.trim()).filter(Boolean)
export function Lines({ label, value, onChange, help, placeholder }) {
  const id = useId()
  const [text, setText] = useState((value || []).join('\n'))
  useEffect(() => {
    if (JSON.stringify(toLines(text)) !== JSON.stringify(value || [])) setText((value || []).join('\n'))
  }, [value])   // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <textarea id={id} className="inp resize-y text-[13px]" rows={Math.max(3, (value || []).length + 1)}
        placeholder={placeholder} value={text}
        onChange={e => { setText(e.target.value); onChange(toLines(e.target.value)) }} />
      <p className="help">{help || 'One per line'}</p>
    </div>
  )
}

export function Problems({ problems, title = 'Fix these first' }) {
  if (!problems?.length) return null
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <p className="font-semibold">{title}</p>
      <ul className="mt-1 list-disc pl-5">{problems.map(p => <li key={p}>{p}</li>)}</ul>
    </div>
  )
}

export function Notice({ tone = 'info', children }) {
  const tones = {
    info: 'border-sky-200 bg-sky-50 text-sky-900',
    ok: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    warn: 'border-amber-200 bg-amber-50 text-amber-900',
    error: 'border-red-200 bg-red-50 text-red-800',
  }
  return <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-xl border p-4 text-sm ${tones[tone]}`}>{children}</div>
}
