import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon.jsx'

// Every exercise animation is a set of key positions (every 6th GIF frame) joined by
// short cross-fades, stored at its licensed size of 180×180. Instead of playing the
// 10 fps GIF, the player decodes only the key positions and blends them itself on every
// screen refresh, with eased timing. Same picture, same size, smooth motion and no
// colour banding in the blends. Browsers without ImageDecoder get the GIF as it is.

const KEY_EVERY = 6
const KEY_MIN_DELAY_MS = 300
const BLEND_MS = 650
const MIN_HOLD_MS = 350
const cache = new Map()

// Frame delays straight from the GIF's blocks (in ms), without decoding any pictures.
export function gifDelays(buffer) {
  const bytes = new Uint8Array(buffer)
  const delays = []
  if (bytes.length < 13 || String.fromCharCode(...bytes.slice(0, 3)) !== 'GIF') return delays
  let at = 13
  if (bytes[10] & 0x80) at += 3 * (1 << ((bytes[10] & 0x07) + 1))
  let pending = 0
  const skipBlocks = () => { while (at < bytes.length && bytes[at] !== 0) at += bytes[at] + 1; at += 1 }
  while (at < bytes.length) {
    const kind = bytes[at]
    if (kind === 0x21) {
      const label = bytes[at + 1]
      if (label === 0xf9 && bytes[at + 2] >= 4) pending = (bytes[at + 4] | (bytes[at + 5] << 8)) * 10
      at += 2
      skipBlocks()
    } else if (kind === 0x2c) {
      const flags = bytes[at + 9]
      at += 10
      if (flags & 0x80) at += 3 * (1 << ((flags & 0x07) + 1))
      at += 1
      skipBlocks()
      delays.push(pending)
      pending = 0
    } else {
      break
    }
  }
  return delays
}

// The key positions are the frames the animation holds on (long delays); the short frames
// between them are cross-fades. The first frame always starts a position.
export function keyFrames(delays, count) {
  const byDelay = delays.length === count ? delays.map((delay, index) => (index === 0 || delay >= KEY_MIN_DELAY_MS ? index : -1)).filter((index) => index >= 0) : []
  if (byDelay.length >= 2) return byDelay
  const every = []
  for (let index = 0; index < count; index += KEY_EVERY) every.push(index)
  return every
}

function loadPositions(url) {
  if (cache.has(url)) {
    // Most recently used goes to the end, so eviction drops the least recently used.
    const hit = cache.get(url)
    cache.delete(url)
    cache.set(url, hit)
    return hit
  }
  const job = (async () => {
    if (typeof window === 'undefined' || !('ImageDecoder' in window)) throw new Error('unsupported')
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.arrayBuffer()
    const delays = gifDelays(data)
    const decoder = new window.ImageDecoder({ data, type: 'image/gif' })
    const positions = []
    try {
      await decoder.tracks.ready
      await decoder.completed
      const count = decoder.tracks.selectedTrack?.frameCount || 0
      for (const index of keyFrames(delays, count)) {
        const { image } = await decoder.decode({ frameIndex: index })
        try {
          const holdMs = Math.max(MIN_HOLD_MS, delays[index] || Math.round((image.duration || 1_000_000) / 1000))
          positions.push({ bitmap: await createImageBitmap(image), holdMs })
        } finally {
          image.close()
        }
      }
      if (!positions.length) throw new Error('empty')
      return positions
    } catch (error) {
      for (const item of positions) item.bitmap.close?.()
      throw error
    } finally {
      decoder.close()
    }
  })()
  job.catch(() => cache.delete(url))
  cache.set(url, job)
  // Keep the cache small: a few recent exercises are plenty. Evicted pictures are released.
  if (cache.size > 24) {
    const oldest = cache.keys().next().value
    const evicted = cache.get(oldest)
    cache.delete(oldest)
    evicted.then((list) => list.forEach((item) => item.bitmap.close?.()), () => {})
  }
  return job
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2)

// Where the loop is at time `ms`: the position shown, the next one, and how far the blend is.
function frameAt(positions, ms) {
  const total = positions.reduce((sum, item) => sum + item.holdMs + BLEND_MS, 0)
  let t = ((ms % total) + total) % total
  for (let index = 0; index < positions.length; index += 1) {
    const { holdMs } = positions[index]
    const next = (index + 1) % positions.length
    if (t < holdMs) return { from: index, to: next, mix: 0 }
    t -= holdMs
    if (t < BLEND_MS) return { from: index, to: next, mix: ease(t / BLEND_MS) }
    t -= BLEND_MS
  }
  return { from: 0, to: 0, mix: 0 }
}

// Loop time at which a given position starts being held.
function startOf(positions, index) {
  let ms = 0
  for (let i = 0; i < index; i += 1) ms += positions[i].holdMs + BLEND_MS
  return ms
}

const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export function MotionPlayer({ src, poster, title, controls = true, className = '' }) {
  const canvas = useRef(null)
  const [positions, setPositions] = useState(null)
  const [failed, setFailed] = useState(false)
  const [playing, setPlaying] = useState(() => !prefersReducedMotion())
  const [slow, setSlow] = useState(false)
  const [current, setCurrent] = useState(0)
  const [seek, setSeek] = useState(0)
  const clock = useRef({ base: 0, at: 0 })
  const speed = slow ? 0.5 : 1

  useEffect(() => {
    let alive = true
    setPositions(null)
    setFailed(false)
    setCurrent(0)
    clock.current = { base: 0, at: performance.now() }
    if (!src) return undefined
    loadPositions(src).then((list) => { if (alive) setPositions(list) }, () => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [src])

  // Size the canvas to its box so the browser scales the picture once, smoothly.
  useEffect(() => {
    const node = canvas.current
    if (!node || !positions) return undefined
    const fit = () => {
      const box = node.getBoundingClientRect()
      const ratio = Math.min(2, window.devicePixelRatio || 1)
      const side = Math.max(180, Math.round(Math.min(box.width, box.height || box.width) * ratio))
      if (node.width !== side) {
        node.width = side
        node.height = side
        // Resizing clears the canvas; draw again (a paused player has no loop running).
        setSeek((value) => value + 1)
      }
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(node)
    return () => observer.disconnect()
  }, [positions])

  useEffect(() => {
    const node = canvas.current
    if (!node || !positions) return undefined
    const ctx = node.getContext('2d')
    let raf = 0
    let shown = -1
    const draw = (now) => {
      const elapsed = playing ? clock.current.base + (now - clock.current.at) * speed : clock.current.base
      const { from, to, mix } = frameAt(positions, elapsed)
      const { width, height } = node
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.globalAlpha = 1
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(positions[from].bitmap, 0, 0, width, height)
      if (mix > 0.001) {
        ctx.globalAlpha = mix
        ctx.drawImage(positions[to].bitmap, 0, 0, width, height)
        ctx.globalAlpha = 1
      }
      const near = mix < 0.5 ? from : to
      if (near !== shown) { shown = near; setCurrent(near) }
      if (playing) raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [positions, playing, speed, seek])

  function togglePlay() {
    const now = performance.now()
    const elapsed = playing ? clock.current.base + (now - clock.current.at) * speed : clock.current.base
    clock.current = { base: elapsed, at: now }
    setPlaying((value) => !value)
  }

  function toggleSpeed() {
    const now = performance.now()
    if (playing) clock.current = { base: clock.current.base + (now - clock.current.at) * speed, at: now }
    setSlow((value) => !value)
  }

  function showPosition(index) {
    clock.current = { base: startOf(positions, index), at: performance.now() }
    setPlaying(false)
    setCurrent(index)
    setSeek((value) => value + 1)
  }

  if (failed === 'missing') {
    return <span className={`ex-img ex-img-empty motion-fallback ${className}`} aria-hidden="true"><Icon name="dumbbell" size={28} /></span>
  }
  if (failed) {
    return <img className={`motion-fallback ${className}`} src={src} alt={title ? `${title} demonstration` : ''} onError={() => setFailed('missing')} />
  }

  return (
    <div className={`motion ${positions ? 'is-ready' : 'is-loading'} ${className}`}>
      <div className="motion-stage" style={poster && !positions ? { backgroundImage: `url("${poster}")` } : undefined}>
        <canvas ref={canvas} width="180" height="180" role="img" aria-label={title ? `${title} demonstration` : 'Exercise demonstration'} />
        {!positions && <span className="motion-loading" aria-hidden="true"><span className="spinner" /></span>}
      </div>
      {controls && positions && (
        <div className="motion-bar">
          <button type="button" className="motion-btn" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'} title={playing ? 'Pause' : 'Play'}>
            <Icon name={playing ? 'pause' : 'play'} size={16} />
          </button>
          {positions.length > 1 && (
            <div className="motion-steps" role="group" aria-label="Positions">
              {positions.map((_, index) => (
                <button key={index} type="button" className={current === index ? 'on' : ''} aria-pressed={!playing && current === index}
                  aria-label={`Hold position ${index + 1}`} title={`Hold position ${index + 1}`} onClick={() => showPosition(index)}>
                  {index + 1}
                </button>
              ))}
            </div>
          )}
          <button type="button" className={`motion-btn speed ${slow ? 'on' : ''}`} onClick={toggleSpeed} aria-pressed={slow} aria-label="Half speed" title="Half speed">
            {slow ? '½×' : '1×'}
          </button>
        </div>
      )}
    </div>
  )
}
