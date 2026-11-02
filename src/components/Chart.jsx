import { useEffect, useRef, useState } from 'react'

// Charts draw at the real pixel width of their box, so text and lines keep their size.
function useWidth(fallback = 640) {
  const ref = useRef(null)
  const [width, setWidth] = useState(fallback)
  useEffect(() => {
    const node = ref.current
    if (!node) return undefined
    const measure = () => {
      const next = Math.round(node.getBoundingClientRect().width)
      if (next > 0) setWidth((current) => (Math.abs(current - next) > 1 ? next : current))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return [ref, Math.max(280, width)]
}

function niceTicks(min, max, count = 4) {
  const span = max - min
  if (!(span > 0)) return [min]
  const raw = span / count
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((m) => m >= raw) || raw
  const start = Math.ceil(min / step) * step
  const ticks = []
  for (let value = start; value <= max + step * 1e-9; value += step) ticks.push(Math.round(value * 1000) / 1000)
  return ticks
}

function formatTick(value) {
  if (Math.abs(value) >= 10000) return `${Math.round(value / 1000)}k`
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return String(Math.round(value * 10) / 10)
}

function useHover(width, count, padLeft, innerWidth) {
  const ref = useRef(null)
  const [hover, setHover] = useState(null)
  function onMove(event) {
    const box = ref.current?.getBoundingClientRect()
    if (!box || !count) return
    const x = ((event.clientX - box.left) / box.width) * width
    const step = count > 1 ? innerWidth / (count - 1) : innerWidth
    const index = count > 1 ? Math.round((x - padLeft) / step) : 0
    setHover(Math.max(0, Math.min(count - 1, index)))
  }
  return { ref, hover, onMove, onLeave: () => setHover(null) }
}

export function LineChart({ labels = [], series = [], unit = '', height = 220 }) {
  const [boxRef, width] = useWidth()
  const pad = { l: 42, r: 14, t: 14, b: 30 }
  const innerW = width - pad.l - pad.r
  const innerH = height - pad.t - pad.b
  const { ref, hover, onMove, onLeave } = useHover(width, labels.length, pad.l, innerW)
  const values = series.flatMap((item) => item.values).filter((value) => Number.isFinite(value))
  if (!values.length) return null
  let min = Math.min(...values)
  let max = Math.max(...values)
  if (min === max) {
    min -= 1
    max += 1
  }
  const padY = (max - min) * 0.15
  min -= padY
  max += padY
  const xAt = (index) => (labels.length <= 1 ? pad.l + innerW / 2 : pad.l + (index / (labels.length - 1)) * innerW)
  const yAt = (value) => pad.t + ((max - value) / (max - min)) * innerH
  const ticks = niceTicks(min, max)
  const every = Math.max(1, Math.ceil(labels.length / Math.max(3, Math.floor(width / 90))))

  return (
    <div className="chart-wrap" ref={boxRef}>
      <svg ref={ref} className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${series.map((item) => item.name).join(', ')} chart`} onMouseMove={onMove} onMouseLeave={onLeave}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line className="grid-line" x1={pad.l} x2={width - pad.r} y1={yAt(tick)} y2={yAt(tick)} />
            <text className="axis" x={pad.l - 8} y={yAt(tick) + 4} textAnchor="end">{formatTick(tick)}</text>
          </g>
        ))}
        {labels.map((label, index) => (index % every === 0 || index === labels.length - 1) && (index === labels.length - 1 || labels.length - 1 - index >= every / 2) ? (
          <text key={`${label}-${index}`} className="axis" x={xAt(index)} y={height - 8} textAnchor="middle">{label}</text>
        ) : null)}
        {hover != null && <line className="cross" x1={xAt(hover)} x2={xAt(hover)} y1={pad.t} y2={pad.t + innerH} />}
        {series.map((item) => {
          const points = item.values.map((value, index) => (Number.isFinite(value) ? [xAt(index), yAt(value)] : null)).filter(Boolean)
          if (!points.length) return null
          const d = points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
          return (
            <g key={item.name}>
              <path d={d} fill="none" style={{ stroke: item.color }} strokeWidth={item.dashed ? 2 : 2.5} strokeDasharray={item.dashed ? '6 5' : undefined} strokeLinejoin="round" strokeLinecap="round" />
              {!item.dashed && points.length <= 60 && points.map(([x, y], index) => <circle key={index} cx={x} cy={y} r="3.2" style={{ fill: 'var(--surface)', stroke: item.color }} strokeWidth="2" />)}
              {hover != null && Number.isFinite(item.values[hover]) && <circle cx={xAt(hover)} cy={yAt(item.values[hover])} r="5" style={{ fill: item.color }} />}
            </g>
          )
        })}
      </svg>
      {hover != null && (
        <div className="chart-tip" style={{ left: `${(xAt(hover) / width) * 100}%` }}>
          <strong>{labels[hover]}</strong>
          {series.map((item) => Number.isFinite(item.values[hover]) && (
            <span key={item.name}><i style={{ background: item.color }} />{item.name} {item.values[hover]} {unit}</span>
          ))}
        </div>
      )}
      {series.length > 1 && (
        <div className="chart-legend">
          {series.map((item) => <span key={item.name}><i className={item.dashed ? 'dash' : ''} style={{ background: item.color }} />{item.name}</span>)}
        </div>
      )}
    </div>
  )
}

export function BarChart({ rows = [], unit = '', goal = 0, color = 'var(--accent)', height = 210, goalLabel = 'Goal' }) {
  const [boxRef, width] = useWidth()
  const pad = { l: 42, r: 14, t: 14, b: 30 }
  const innerW = width - pad.l - pad.r
  const innerH = height - pad.t - pad.b
  const slot = rows.length ? innerW / rows.length : innerW
  const ref = useRef(null)
  const [hover, setHover] = useState(null)
  if (!rows.length) return null
  const max = Math.max(goal || 0, ...rows.map((row) => row.value), 1) * 1.12
  const yAt = (value) => pad.t + innerH - (value / max) * innerH
  const ticks = niceTicks(0, max).filter((tick) => tick <= max)
  const barW = Math.max(3, Math.min(34, slot * 0.66))
  const every = Math.max(1, Math.ceil(rows.length / Math.max(4, Math.floor(width / 48))))

  function onMove(event) {
    const box = ref.current?.getBoundingClientRect()
    if (!box) return
    const x = ((event.clientX - box.left) / box.width) * width
    const index = Math.floor((x - pad.l) / slot)
    setHover(index >= 0 && index < rows.length ? index : null)
  }

  return (
    <div className="chart-wrap" ref={boxRef}>
      <svg ref={ref} className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Bar chart" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line className="grid-line" x1={pad.l} x2={width - pad.r} y1={yAt(tick)} y2={yAt(tick)} />
            <text className="axis" x={pad.l - 8} y={yAt(tick) + 4} textAnchor="end">{formatTick(tick)}</text>
          </g>
        ))}
        {rows.map((row, index) => {
          const x = pad.l + index * slot + (slot - barW) / 2
          const h = Math.max(0, innerH - (yAt(row.value) - pad.t))
          return (
            <g key={`${row.label}-${index}`}>
              {row.value > 0
                ? <rect x={x} y={yAt(row.value)} width={barW} height={h} rx={Math.min(5, barW / 2)} style={{ fill: row.color || color }} opacity={hover == null || hover === index ? 1 : 0.45} />
                : <rect x={x} y={pad.t + innerH - 2} width={barW} height={2} rx={1} className="bar-empty" />}
              {(index % every === 0) && <text className="axis" x={x + barW / 2} y={height - 8} textAnchor="middle">{row.label}</text>}
            </g>
          )
        })}
        {goal > 0 && (
          <g>
            <line className="goal-line" x1={pad.l} x2={width - pad.r} y1={yAt(goal)} y2={yAt(goal)} />
            <text className="axis goal-text" x={width - pad.r} y={yAt(goal) - 6} textAnchor="end">{goalLabel} {Math.round(goal).toLocaleString()}</text>
          </g>
        )}
      </svg>
      {hover != null && rows[hover] && (
        <div className="chart-tip" style={{ left: `${((pad.l + hover * slot + slot / 2) / width) * 100}%` }}>
          <strong>{rows[hover].tipLabel || rows[hover].label}</strong>
          <span>{Math.round(rows[hover].value).toLocaleString()} {unit}</span>
          {rows[hover].note && <span className="muted">{rows[hover].note}</span>}
        </div>
      )}
    </div>
  )
}

export function HBars({ rows, unit = '' }) {
  const max = Math.max(1, ...rows.map((row) => row.value))
  return (
    <div className="hbars">
      {rows.map((row) => (
        <div key={row.label} className="hbar">
          <span className="hbar-label">{row.label}</span>
          <span className="hbar-track"><i style={{ width: `${(row.value / max) * 100}%`, background: row.color || 'var(--accent)' }} /></span>
          <span className="hbar-value">{row.value} {row.value === 1 && unit.endsWith("s") ? unit.slice(0, -1) : unit}</span>
        </div>
      ))}
    </div>
  )
}
