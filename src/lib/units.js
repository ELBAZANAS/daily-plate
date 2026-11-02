const LB_PER_KG = 0.45359237

export function cmToFtIn(cm) {
  const total = cm / 2.54
  let feet = Math.floor(total / 12)
  let inches = Math.round((total - feet * 12) * 10) / 10
  if (inches >= 12) {
    feet += 1
    inches = 0
  }
  return { feet, inches }
}

export function ftInToCm(feet, inches) {
  return (Number(feet) * 12 + Number(inches)) * 2.54
}

export function kgToLb(kg) {
  return kg / LB_PER_KG
}

export function lbToKg(lb) {
  return lb * LB_PER_KG
}

export function formatWeight(kg, units) {
  if (!Number.isFinite(kg)) return '—'
  if (units === 'imperial') return `${round1(kgToLb(kg))} lb`
  return `${round1(kg)} kg`
}

export function formatHeight(cm, units) {
  if (!Number.isFinite(cm)) return '—'
  if (units === 'imperial') {
    const { feet, inches } = cmToFtIn(cm)
    const inchText = Number.isInteger(inches) ? String(inches) : inches.toFixed(1)
    return `${feet} ft ${inchText} in`
  }
  return `${round1(cm)} cm`
}

export function round1(n) {
  return Math.round(n * 10) / 10
}

// Weights are kept to the gram, so a weight typed in pounds reads back exactly.
export function storeKg(kg) {
  return Math.round(kg * 1000) / 1000
}
