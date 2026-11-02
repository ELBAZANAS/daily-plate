import { popularFoodIds } from '../data/foods.js'
import { seedPlans } from '../data/plans.js'

const popular = new Set(popularFoodIds)

function norm(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function searchFoods(query, list) {
  const q = norm(query)
  if (!q) return []
  const tokens = q.split(' ').filter(Boolean)
  const ranked = []
  for (const food of list) {
    const name = norm(food.name)
    const aliasText = (food.aliases || []).map(norm)
    const hay = [name, norm(food.brand), norm(food.category), ...aliasText].join(' ')
    if (!tokens.every((token) => hay.includes(token))) continue
    let score = 0
    if (name === q) score += 120
    else if (name.startsWith(q)) score += 80
    else if (aliasText.some((alias) => alias === q)) score += 100
    else if (aliasText.some((alias) => alias.startsWith(q))) score += 70
    if (tokens.every((token) => name.includes(token))) score += 25
    if (popular.has(food.id)) score += 18
    if (food.approximate) score -= 6
    score -= name.length * 0.02
    ranked.push({ food, score })
  }
  ranked.sort((a, b) => b.score - a.score || a.food.name.localeCompare(b.food.name))
  return ranked.slice(0, 40).map((row) => row.food)
}

const equipmentBonus = { barbell: 8, dumbbell: 7, 'body weight': 6, cable: 5, 'leverage machine': 4, 'ez barbell': 2, kettlebell: 1 }

const featuredExercises = new Set(seedPlans().flatMap((plan) => plan.days.flatMap((day) => day.exercises.map((slot) => slot.exerciseId))))

const zhTerms = [
  ['引体向上', 'pull-up'], ['俯卧撑', 'push-up'], ['平板支撑', 'plank'], ['臂屈伸', 'dip'], ['卧推', 'bench press'],
  ['深蹲', 'squat'], ['硬拉', 'deadlift'], ['划船', 'row'], ['推举', 'press'], ['弯举', 'curl'], ['飞鸟', 'fly'],
  ['弓步', 'lunge'], ['腿举', 'leg press'], ['卷腹', 'crunch'], ['仰卧起坐', 'sit-up'], ['提踵', 'calf raise'],
  ['侧平举', 'lateral raise'], ['下拉', 'pulldown'], ['耸肩', 'shrug'], ['臀桥', 'glute bridge'], ['跑步', 'run'],
  ['杠铃', 'barbell'], ['哑铃', 'dumbbell'], ['绳索', 'cable'], ['史密斯', 'smith'], ['壶铃', 'kettlebell'],
  ['弹力带', 'band'], ['自重', 'body weight'], ['器械', 'machine'], ['胸', 'chest'], ['背', 'back'], ['肩', 'shoulders'],
  ['二头', 'biceps'], ['三头', 'triceps'], ['腹', 'abs'], ['臀', 'glutes'], ['腿', 'legs'],
  ['坐姿', 'seated'], ['站姿', 'standing'], ['上斜', 'incline'], ['下斜', 'decline'], ['罗马尼亚', 'romanian'],
  ['分腿蹲', 'split squat'], ['保加利亚', ''], ['腿弯举', 'leg curl'], ['腿屈伸', 'leg extension'], ['窄距', 'close grip'],
  ['宽距', 'wide grip'], ['单臂', 'one arm'], ['单腿', 'single leg'], ['俯身', 'bent over'], ['前平举', 'front raise'],
  ['面拉', 'face pull'], ['臀推', 'hip thrust'], ['箭步', 'lunge'], ['登山', 'mountain climber'], ['跳绳', 'jump rope'],
  ['波比', 'burpee'], ['悬垂举腿', 'hanging leg raise'], ['举腿', 'leg raise'], ['倒立', 'handstand'], ['高位下拉', 'pulldown'],
]

// Longer phrases first, so 腿弯举 is read before 弯举 and 腿.
const zhSorted = [...zhTerms].sort((a, b) => b[0].length - a[0].length)
const hasCjk = (value) => /[\u4e00-\u9fff]/.test(value)

function translateQuery(q) {
  let out = q
  for (const [zh, en] of zhSorted) out = out.split(zh).join(` ${en} `)
  return norm(out)
}

// Gym shorthand people type: "rdl", "ohp", "db row", "pullups".
const shorthand = {
  rdl: 'romanian deadlift', ohp: 'overhead press', db: 'dumbbell', bb: 'barbell', kb: 'kettlebell',
  pullup: 'pull up', pullups: 'pull up', pushup: 'push up', pushups: 'push up', chinup: 'chin up', chinups: 'chin up',
  situp: 'sit up', situps: 'sit up', dips: 'dip', ez: 'ez barbell',
}

function expandShorthand(q) {
  return q.split(' ').map((word) => shorthand[word] || word).join(' ')
}

export function searchExercises(query, list) {
  const raw = norm(query)
  const q = expandShorthand(hasCjk(raw) && zhTerms.some(([zh]) => raw.includes(zh)) ? translateQuery(raw) : raw)
  if (!q) return list
  const words = q.split(' ').filter(Boolean)
  // Chinese words with no translation only help ranking (they can match the Chinese steps);
  // they are required only when nothing else is left to search for.
  let tokens = words.filter((word) => !hasCjk(word))
  const optional = words.filter(hasCjk)
  if (!tokens.length) tokens = optional
  const ranked = []
  for (const exercise of list) {
    const name = norm(exercise.name)
    const hay = norm([exercise.name, exercise.equipment, exercise.primary, exercise.target, ...(exercise.muscles || []), ...(exercise.stepsZh || [])].join(' '))
    if (!tokens.every((token) => hay.includes(token))) continue
    let score = 0
    if (name === q) score += 100
    else if (name.startsWith(q)) score += 8
    if (tokens.every((token) => name.includes(token))) score += 30
    const equipmentWords = new Set(norm(exercise.equipment).split(' '))
    const extra = name.split(/[\s()]+/).filter((word) => word && !tokens.some((token) => word.includes(token)) && !equipmentWords.has(word))
    score -= extra.length * 4
    score += equipmentBonus[exercise.equipment] || 0
    if (featuredExercises.has(exercise.id)) score += 12
    if (tokens !== optional) score += optional.filter((word) => hay.includes(word)).length * 6
    ranked.push({ exercise, score })
  }
  ranked.sort((a, b) => b.score - a.score || a.exercise.name.localeCompare(b.exercise.name))
  return ranked.map((row) => row.exercise)
}
