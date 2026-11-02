export function Ring({ value, max, size = 176, stroke = 14, label, children }) {
  const radius = (size - stroke) / 2
  const circ = 2 * Math.PI * radius
  const safeMax = max > 0 ? max : 1
  const ratio = Math.max(0, value) / safeMax
  const over = max > 0 && value > max
  const shown = Math.min(ratio, 1)
  return (
    <div className={`ring ${over ? 'over' : ''}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} />
        {shown > 0 && (
          <circle
            className="ring-fill"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${circ * shown} ${circ}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  )
}

export function MacroBar({ label, value, goal, unit = 'g', tone }) {
  const pct = goal > 0 ? Math.min(100, (value / goal) * 100) : 0
  const over = goal > 0 && value > goal * 1.05
  return (
    <div className={`macro tone-${tone}`}>
      <div className="macro-top">
        <span className="macro-label"><i className="swatch" />{label}</span>
        <span className="macro-num"><strong>{Math.round(value)}</strong> / {goal || '—'} {unit}</span>
      </div>
      <div className={`macro-track ${over ? 'over' : ''}`}>
        <div style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
