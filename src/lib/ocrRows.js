// Turns OCR text boxes into reading-order rows, so a table row such as
// "能量 | 1580千焦 | 19%" comes back as one line even when the photo is tilted
// and each cell was detected as its own box.
// Plain JavaScript with no imports: the desktop label reader runs it in Node too.

function boxOf(item) {
  const points = item.box || item.poly || null
  if (!Array.isArray(points) || points.length < 4) return null
  return points.map((point) => [Number(point[0]), Number(point[1])])
}

function angleOf(points) {
  const [a, b] = points
  return Math.atan2(b[1] - a[1], b[0] - a[0])
}

function median(values) {
  if (!values.length) return 0
  const sorted = [...values].sort((x, y) => x - y)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export function groupRows(items) {
  const boxes = []
  for (const item of items || []) {
    const text = String(item?.text || '').replace(/\s+/g, ' ').trim()
    const points = boxOf(item)
    if (!text || !points) continue
    boxes.push({ text, points })
  }
  if (!boxes.length) return []

  // Tilt of the photo, from boxes that are clearly wider than tall.
  const wide = boxes.filter(({ points }) => {
    const width = Math.hypot(points[1][0] - points[0][0], points[1][1] - points[0][1])
    const height = Math.hypot(points[3][0] - points[0][0], points[3][1] - points[0][1])
    return width > height * 2.5
  })
  let tilt = median(wide.map(({ points }) => angleOf(points)))
  if (!Number.isFinite(tilt) || Math.abs(tilt) > 0.35) tilt = 0
  const cos = Math.cos(-tilt)
  const sin = Math.sin(-tilt)

  const placed = boxes.map(({ text, points }) => {
    const turned = points.map(([x, y]) => [x * cos - y * sin, x * sin + y * cos])
    const xs = turned.map((point) => point[0])
    const ys = turned.map((point) => point[1])
    const top = Math.min(...ys)
    const bottom = Math.max(...ys)
    return { text, x: Math.min(...xs), y: (top + bottom) / 2, height: Math.max(1, bottom - top) }
  }).sort((a, b) => a.y - b.y || a.x - b.x)

  const rows = []
  for (const box of placed) {
    let target = null
    for (let i = rows.length - 1; i >= 0 && i >= rows.length - 3; i -= 1) {
      const row = rows[i]
      const limit = Math.max(8, Math.min(row.height, box.height) * 0.55)
      if (Math.abs(row.y - box.y) <= limit) {
        target = row
        break
      }
    }
    if (target) {
      target.parts.push(box)
      target.y = target.parts.reduce((sum, part) => sum + part.y, 0) / target.parts.length
      target.height = Math.max(target.height, box.height)
    } else {
      rows.push({ y: box.y, height: box.height, parts: [box] })
    }
  }
  return rows.map((row) => row.parts.sort((a, b) => a.x - b.x).map((part) => part.text).join(' '))
}
