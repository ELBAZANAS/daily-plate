import { useEffect, useId, useRef, useState } from 'react'
import { Icon } from './Icon.jsx'

export function Modal({ title, subtitle, onClose, children, footer, size = 'md', className = '' }) {
  const titleId = useId()
  const panel = useRef(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const previous = document.activeElement
    const onKey = (event) => {
      if (event.key === 'Escape') {
        const open = document.querySelectorAll('.modal')
        if (open[open.length - 1] !== panel.current) return
        event.stopPropagation()
        closeRef.current?.()
      }
    }
    window.addEventListener('keydown', onKey)
    document.body.classList.add('modal-open')
    const focusTarget = panel.current?.querySelector('[data-autofocus]') || panel.current
    focusTarget?.focus({ preventScroll: true })
    return () => {
      window.removeEventListener('keydown', onKey)
      if (!document.querySelector('.modal-back')) document.body.classList.remove('modal-open')
      previous?.focus?.({ preventScroll: true })
    }
  }, [])

  return (
    <div className="modal-back" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.() }}>
      <div ref={panel} tabIndex={-1} className={`modal modal-${size} ${className}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="modal-head">
          <div className="modal-titles">
            <h2 id={titleId}>{title}</h2>
            {subtitle && <p className="muted small">{subtitle}</p>}
          </div>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  )
}

export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`field ${className}`}>
      {label && <span className="field-label">{label}</span>}
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

export function Segmented({ options, value, onChange, label, size = '' }) {
  return (
    <div className={`segmented ${size}`} role="radiogroup" aria-label={label}>
      {options.map(([id, text]) => (
        <button key={id} type="button" role="radio" aria-checked={value === id} className={value === id ? 'on' : ''} onClick={() => onChange(id)}>
          {text}
        </button>
      ))}
    </div>
  )
}

export function Chips({ options, value, onChange, label }) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {options.map((option) => {
        const [id, text] = Array.isArray(option) ? option : [option, option]
        return (
          <button key={id} type="button" aria-pressed={value === id} className={`chip ${value === id ? 'on' : ''}`} onClick={() => onChange(id)}>{text}</button>
        )
      })}
    </div>
  )
}

export function Empty({ icon = 'info', title, children, action }) {
  return (
    <div className="empty">
      <span className="empty-icon"><Icon name={icon} size={22} /></span>
      {title && <strong>{title}</strong>}
      {children && <p className="muted">{children}</p>}
      {action}
    </div>
  )
}

// A two-step button for anything that deletes. The second click confirms.
export function ConfirmButton({ children, confirmText = 'Tap again to confirm', onConfirm, className = 'btn danger-ghost small', icon }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return undefined
    const id = setTimeout(() => setArmed(false), 3500)
    return () => clearTimeout(id)
  }, [armed])
  return (
    <button
      className={`${className} ${armed ? 'armed' : ''}`}
      type="button"
      onClick={() => {
        if (armed) {
          setArmed(false)
          onConfirm()
        } else setArmed(true)
      }}
    >
      {icon && <Icon name={icon} size={16} />}
      {armed ? confirmText : children}
    </button>
  )
}

export function Progress({ value, max, tone = 'accent', label }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return (
    <div className={`progress tone-${tone}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={Math.round(max || 0)} aria-valuenow={Math.round(value || 0)}>
      <div style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Stat({ label, value, detail, tone }) {
  return (
    <div className={`stat ${tone ? `tone-${tone}` : ''}`}>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      {detail && <small className="stat-detail">{detail}</small>}
    </div>
  )
}

export function PageHead({ eyebrow, title, children, actions }) {
  return (
    <header className="page-head">
      <div className="page-head-text">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {children && <div className="page-sub">{children}</div>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  )
}

export function Banner({ tone = 'info', children, icon }) {
  const glyph = icon || (tone === 'bad' ? 'alert' : tone === 'warn' ? 'alert' : tone === 'good' ? 'check' : 'info')
  return (
    <div className={`banner tone-${tone}`} role={tone === 'bad' ? 'alert' : undefined}>
      <Icon name={glyph} size={16} />
      <div>{children}</div>
    </div>
  )
}

// Text input that accepts a decimal number but keeps what the person typed.
export function NumberInput({ value, onChange, className = '', ...rest }) {
  return (
    <input
      {...rest}
      className={`num-input ${className}`}
      inputMode="decimal"
      autoComplete="off"
      value={value}
      onChange={(event) => onChange(event.target.value.replace(',', '.'))}
    />
  )
}

// One search field for the whole app: soft pill, icon that lights up on focus,
// result count, a clear button, Esc to clear and "/" to jump into it.
export function SearchField({ value, onChange, placeholder, label, autoFocus = false, modalFocus = false, hotkey = false, count, onEnter, className = '' }) {
  const input = useRef(null)
  useEffect(() => {
    if (!hotkey) return undefined
    const onKey = (event) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target
      if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return
      if (document.querySelector('.modal') && !input.current?.closest('.modal')) return
      event.preventDefault()
      input.current?.focus()
      input.current?.select()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hotkey])
  const filled = value !== ''
  return (
    <div className={`searchfield ${filled ? 'is-filled' : ''} ${className}`} role="search">
      <span className="searchfield-icon" aria-hidden="true"><Icon name="search" size={18} /></span>
      <input
        ref={input}
        type="search"
        value={value}
        autoFocus={autoFocus}
        data-autofocus={autoFocus || modalFocus ? '' : undefined}
        placeholder={placeholder}
        aria-label={label || placeholder}
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && filled) {
            event.preventDefault()
            event.stopPropagation()
            onChange('')
          } else if (event.key === 'Enter' && onEnter) {
            event.preventDefault()
            onEnter()
          }
        }}
      />
      {filled && count != null && <span className="searchfield-count" aria-live="polite">{count.toLocaleString()} {count === 1 ? 'result' : 'results'}</span>}
      {filled
        ? <button className="searchfield-clear" type="button" aria-label="Clear search" onClick={() => { onChange(''); input.current?.focus() }}><Icon name="x" size={14} /></button>
        : hotkey && <kbd className="searchfield-kbd" title="Press / to search">/</kbd>}
    </div>
  )
}
