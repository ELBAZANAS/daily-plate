import { poseDraw, BONES } from '../data/poseDraw.js'

function Equipment({ item, color }) {
  const stroke = item.kind === 'bench' ? '#c8bfb2' : item.kind === 'bell' ? color : '#1c1915'
  if (item.type === 'circle') {
    return <circle cx={item.cx} cy={item.cy} r={item.r} fill="none" stroke={stroke} strokeWidth="6" />
  }
  const [x1, y1, x2, y2] = item.points
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={stroke}
      strokeWidth={item.kind === 'bench' ? 8 : 5}
      strokeLinecap="round"
    />
  )
}

export function ExerciseArt({ pose = 'squat', color = '#0f6e62', label = 'Exercise illustration' }) {
  const data = poseDraw[pose] || poseDraw.squat
  const hidden = new Set(data.hide || [])
  const under = (data.equipment || []).filter((item) => item.kind === 'bench')
  const over = (data.equipment || []).filter((item) => item.kind !== 'bench')
  return (
    <svg className="art" viewBox="0 0 200 220" role="img" aria-label={label}>
      <ellipse cx="100" cy="208" rx="54" ry="7" fill="rgba(28,25,21,0.08)" />
      {under.map((item, index) => <Equipment key={`u${index}`} item={item} color={color} />)}
      <g fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round">
        {BONES.map(([from, to], index) => {
          if (hidden.has(from) || hidden.has(to)) return null
          const start = data.joints[from]
          const end = data.joints[to]
          const torso = from === 'neck' && to === 'hip'
          return (
            <line
              key={index}
              x1={start[0]}
              y1={start[1]}
              x2={end[0]}
              y2={end[1]}
              strokeWidth={torso ? 11 : 8}
            />
          )
        })}
        <circle cx={data.joints.head[0]} cy={data.joints.head[1]} r="12" fill="#fffdf8" stroke={color} strokeWidth="6" />
      </g>
      {over.map((item, index) => <Equipment key={`o${index}`} item={item} color={color} />)}
    </svg>
  )
}
