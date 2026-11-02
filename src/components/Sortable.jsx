import { useLayoutEffect, useRef, useState } from 'react'

// Drag-to-reorder without a library. Items follow the pointer, neighbours glide out of
// the way (FLIP animation), and the dropped item settles into its slot. Works with mouse,
// pen and touch; a handle also answers the arrow keys so nothing depends on dragging.
//
//   const sort = useSortable({ ids, onReorder, axis: 'y' })
//   <div {...sort.itemProps(id)}> <button {...sort.handleProps(id, label)} /> </div>
//
// axis 'y' is a vertical list; 'wrap' is a row that wraps (chips, cards).
// activation 'handle' starts on the first few pixels of movement; 'press' (for a whole
// clickable item) needs 6 px with a mouse, or a short press-and-hold on touch screens.

const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)'

function reducedMotion() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function currentShift(el) {
  const value = getComputedStyle(el).transform
  if (!value || value === 'none') return { x: 0, y: 0 }
  try {
    const matrix = new DOMMatrixReadOnly(value)
    return { x: matrix.m41, y: matrix.m42 }
  } catch {
    return { x: 0, y: 0 }
  }
}

// Where an item sits in the layout, ignoring any animation or drag offset it has right now.
function layoutRect(el) {
  const box = el.getBoundingClientRect()
  const shift = currentShift(el)
  return { left: box.left - shift.x, top: box.top - shift.y, right: box.right - shift.x, bottom: box.bottom - shift.y, width: box.width, height: box.height }
}

function distance(x, y, rect) {
  const dx = Math.max(rect.left - x, 0, x - rect.right)
  const dy = Math.max(rect.top - y, 0, y - rect.bottom)
  return Math.hypot(dx, dy)
}

export function moveItem(list, from, to) {
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

export function useSortable({ ids, onReorder, axis = 'y', activation = 'handle', disabled = false }) {
  const nodes = useRef(new Map())
  const refCache = useRef(new Map())
  const [preview, setPreview] = useState(null)
  const [dragId, setDragId] = useState(null)
  const drag = useRef(null)
  const snapshot = useRef(null)
  const order = preview || ids
  const orderRef = useRef(order)
  orderRef.current = order
  const idsRef = useRef(ids)
  idsRef.current = ids
  const reorderRef = useRef(onReorder)
  reorderRef.current = onReorder

  function takeSnapshot() {
    const rects = new Map()
    nodes.current.forEach((el, id) => rects.set(id, el.getBoundingClientRect()))
    snapshot.current = rects
  }

  function placeDragged() {
    const state = drag.current
    const el = state && nodes.current.get(state.id)
    if (!el) return
    el.style.transform = ''
    const box = el.getBoundingClientRect()
    const x = axis === 'y' ? 0 : state.x - state.grabX - box.left
    const y = state.y - state.grabY - box.top
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`
  }

  // FLIP: after the order changes, start every moved item where it was on screen and let it glide.
  useLayoutEffect(() => {
    const before = snapshot.current
    if (before) {
      snapshot.current = null
      const calm = reducedMotion()
      nodes.current.forEach((el, id) => {
        if (id === drag.current?.id) return
        const prev = before.get(id)
        if (!prev) return
        el.getAnimations?.().forEach((animation) => animation.cancel())
        const next = el.getBoundingClientRect()
        const dx = prev.left - next.left
        const dy = prev.top - next.top
        if (calm || !el.animate || (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5)) return
        el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }], { duration: 240, easing: EASE })
      })
    }
    if (drag.current?.active) placeDragged()
  })

  function maybeReorder() {
    const state = drag.current
    const list = orderRef.current
    const from = list.indexOf(state.id)
    if (from < 0) return
    let best = null
    for (const id of list) {
      if (id === state.id) continue
      const el = nodes.current.get(id)
      if (!el) continue
      const rect = layoutRect(el)
      const gap = distance(state.x, state.y, rect)
      if (!best || gap < best.gap) best = { id, rect, gap }
    }
    if (!best) return
    const to = list.indexOf(best.id)
    const r = best.rect
    const after = axis === 'y'
      ? state.y > r.top + r.height / 2
      : state.y > r.bottom ? true : state.y < r.top ? false : state.x > r.left + r.width / 2
    if ((to > from && !after) || (to < from && after)) return
    const next = moveItem(list, from, to)
    takeSnapshot()
    orderRef.current = next
    setPreview(next)
  }

  function scrollStep() {
    const state = drag.current
    if (!state?.active) return
    const edge = 72
    let dy = 0
    if (state.y < edge) dy = -Math.ceil((edge - state.y) / 4)
    else if (state.y > window.innerHeight - edge) dy = Math.ceil((state.y - (window.innerHeight - edge)) / 4)
    if (dy) {
      const before = window.scrollY
      window.scrollBy(0, dy)
      if (window.scrollY !== before) {
        placeDragged()
        maybeReorder()
      }
    }
    state.frame = requestAnimationFrame(scrollStep)
  }

  function activate() {
    const state = drag.current
    state.active = true
    clearTimeout(state.timer)
    document.body.classList.add('is-sorting')
    if (state.pointerType === 'touch') navigator.vibrate?.(8)
    orderRef.current = [...idsRef.current]
    setPreview(orderRef.current)
    setDragId(state.id)
    placeDragged()
    state.frame = requestAnimationFrame(scrollStep)
  }

  function onMove(event) {
    const state = drag.current
    if (!state || event.pointerId !== state.pointerId) return
    state.x = event.clientX
    state.y = event.clientY
    if (!state.active) {
      const moved = Math.hypot(state.x - state.startX, state.y - state.startY)
      if (activation === 'press' && state.pointerType === 'touch') {
        if (moved > 10) finish(false) // a scroll, not a drag
        return
      }
      if (moved < (activation === 'press' ? 6 : 3)) return
      activate()
    }
    event.preventDefault()
    placeDragged()
    maybeReorder()
  }

  function onTouchMove(event) {
    if (drag.current?.active) event.preventDefault()
  }

  function onUp(event) {
    if (drag.current && event.pointerId !== drag.current.pointerId) return
    finish(event.type === 'pointerup')
  }

  function onKeyEscape(event) {
    if (event.key === 'Escape' && drag.current?.active) {
      event.preventDefault()
      event.stopPropagation()
      finish(false)
    }
  }

  function finish(commit) {
    const state = drag.current
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
    window.removeEventListener('touchmove', onTouchMove)
    window.removeEventListener('keydown', onKeyEscape, true)
    if (!state) return
    clearTimeout(state.timer)
    cancelAnimationFrame(state.frame)
    drag.current = null
    if (!state.active) return

    document.body.classList.remove('is-sorting')
    // A drag ends with a click on whatever was under the pointer; swallow that one click.
    const swallow = (click) => { click.preventDefault(); click.stopPropagation() }
    window.addEventListener('click', swallow, { capture: true, once: true })
    setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0)

    const final = commit ? orderRef.current : idsRef.current
    const changed = final.length === idsRef.current.length && final.some((id, index) => id !== idsRef.current[index])
    if (!commit) {
      takeSnapshot()
      snapshot.current.delete(state.id)
    }

    const el = nodes.current.get(state.id)
    if (el) {
      const from = el.getBoundingClientRect()
      el.style.transform = ''
      el.classList.add('is-dropping')
      const settle = () => {
        const to = el.getBoundingClientRect()
        const dx = from.left - to.left
        const dy = from.top - to.top
        if (reducedMotion() || !el.animate || (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5)) {
          el.classList.remove('is-dropping')
          return
        }
        const animation = el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }], { duration: 220, easing: EASE })
        animation.onfinish = animation.oncancel = () => el.classList.remove('is-dropping')
      }
      // Let React put the list in its final order first, then animate from where the item was dropped.
      requestAnimationFrame(settle)
    }
    setDragId(null)
    setPreview(null)
    if (commit && changed) reorderRef.current?.(final)
  }

  function onPointerDown(event, id) {
    if (disabled || drag.current || (event.pointerType === 'mouse' && event.button !== 0)) return
    if (activation === 'handle') event.preventDefault()
    const el = nodes.current.get(id)
    if (!el) return
    const box = el.getBoundingClientRect()
    drag.current = {
      id,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      grabX: event.clientX - box.left,
      grabY: event.clientY - box.top,
      active: false,
      timer: 0,
      frame: 0,
    }
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('keydown', onKeyEscape, true)
    if (activation === 'press' && event.pointerType === 'touch') {
      drag.current.timer = setTimeout(() => { if (drag.current && !drag.current.active) activate() }, 280)
    }
  }

  function moveBy(id, step) {
    const list = idsRef.current
    const from = list.indexOf(id)
    const to = from + step
    if (from < 0 || to < 0 || to >= list.length) return
    takeSnapshot()
    reorderRef.current?.(moveItem(list, from, to))
  }

  function itemRef(id) {
    if (!refCache.current.has(id)) {
      refCache.current.set(id, (el) => {
        if (el) nodes.current.set(id, el)
        else nodes.current.delete(id)
      })
    }
    return refCache.current.get(id)
  }

  return {
    order,
    dragId,
    sorting: dragId != null,
    itemProps(id, extraClass = '') {
      return {
        ref: itemRef(id),
        'data-sort-id': id,
        className: `sort-item ${dragId === id ? 'is-dragging' : ''} ${extraClass}`.trim(),
      }
    },
    handleProps(id, label = 'item') {
      const index = idsRef.current.indexOf(id)
      return {
        type: 'button',
        className: 'drag-handle',
        'aria-label': `Reorder ${label}. Drag, or use the arrow keys`,
        title: 'Drag to reorder',
        'aria-roledescription': 'sortable',
        'aria-posinset': index + 1,
        'aria-setsize': idsRef.current.length,
        onPointerDown: (event) => onPointerDown(event, id),
        onKeyDown: (event) => {
          const back = event.key === 'ArrowUp' || (axis !== 'y' && event.key === 'ArrowLeft')
          const forward = event.key === 'ArrowDown' || (axis !== 'y' && event.key === 'ArrowRight')
          if (!back && !forward) return
          event.preventDefault()
          moveBy(id, back ? -1 : 1)
        },
        onClick: (event) => event.preventDefault(),
      }
    },
    // For items that are themselves the drag target (no separate handle).
    pressProps(id) {
      return { onPointerDown: (event) => onPointerDown(event, id) }
    },
    moveBy,
  }
}
