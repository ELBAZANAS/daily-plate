const ACTIVITY = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.465,
  active: 1.55,
  very: 1.725,
  extra: 1.9,
}

const SEX_CONSTANT = {
  male: 5,
  female: -161,
  average: -78,
}

// calculator.net: 1 lb is about 3,500 kcal. 1 lb = 0.45359237 kg.
const KCAL_PER_KG = 3500 / 0.45359237
const MAX_DEFICIT = 1000

export function bmi(weightKg, heightCm) {
  const meters = heightCm / 100
  return weightKg / (meters * meters)
}

export function bmiCategory(value) {
  if (value < 16) return 'severe thinness'
  if (value < 17) return 'moderate thinness'
  if (value < 18.5) return 'mild thinness'
  if (value <= 25) return 'normal'
  if (value <= 30) return 'overweight'
  if (value <= 35) return 'obese class I'
  if (value <= 40) return 'obese class II'
  return 'obese class III'
}

export function isThin(category) {
  return typeof category === 'string' && category.endsWith('thinness')
}

export function bmiPrime(value) {
  return value / 25
}

export function ponderalIndex(weightKg, heightCm) {
  const meters = heightCm / 100
  return weightKg / (meters * meters * meters)
}

export function healthyWeightRange(heightCm) {
  const meters = heightCm / 100
  const sq = meters * meters
  return { minKg: 18.5 * sq, maxKg: 25 * sq }
}

export function bmr(profile) {
  const constant = SEX_CONSTANT[profile.sex] ?? SEX_CONSTANT.average
  return 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age + constant
}

export function activityFactor(activity) {
  return ACTIVITY[activity] ?? ACTIVITY.moderate
}

function proteinPerKg(goal) {
  if (goal === 'recomp') return 2.2
  if (goal === 'lose') return 2
  if (goal === 'gain') return 1.8
  return 1.6
}

function fatShare(goal) {
  return goal === 'maintain' ? 0.3 : 0.25
}

function defaultWeekly(goal) {
  if (goal === 'lose') return -0.5
  if (goal === 'gain') return 0.25
  return 0
}

export function planTargets(profile) {
  if (!profile) return null
  const { weightKg, heightCm, age, sex, activity, goal } = profile
  if (![weightKg, heightCm, age].every(Number.isFinite) || !sex || !activity || !goal) return null

  const bmiValue = bmi(weightKg, heightCm)
  const category = bmiCategory(bmiValue)
  const base = bmr(profile)
  const factor = activityFactor(activity)
  const tdee = base * factor
  const floor = sex === 'female' ? 1200 : 1500

  let weeklyKg = Number.isFinite(profile.weeklyKg) ? profile.weeklyKg : defaultWeekly(goal)
  let note = null

  if (isThin(category) && (goal === 'lose' || goal === 'recomp')) {
    weeklyKg = 0
    note = 'A deficit was not applied because your BMI is in a thinness range. The target below is maintenance.'
  } else if (goal === 'recomp') {
    if (bmiValue > 25) {
      weeklyKg = -0.25
      note = 'Lose fat and gain muscle uses a mild 0.25 kg a week deficit while BMI is above 25, with protein kept high. The scale can drop while lifts still go up.'
    } else {
      weeklyKg = 0
      note = 'Lose fat and gain muscle stays at maintenance while BMI is in the normal range. Protein stays high so the change shows up in measurements and lifts more than on the scale.'
    }
  }

  if (age < 18 && weeklyKg < 0) {
    weeklyKg = Math.max(weeklyKg, -0.25)
  }

  const dailyChange = (weeklyKg * KCAL_PER_KG) / 7
  if (dailyChange < -MAX_DEFICIT) {
    weeklyKg = (-MAX_DEFICIT * 7) / KCAL_PER_KG
    note = 'The cut was capped at 1,000 kcal a day, about 0.9 kg a week. A deeper cut is where muscle loss gets likely.'
  }

  let calories = Math.round(tdee + (weeklyKg * KCAL_PER_KG) / 7)
  let floored = false
  if (calories < floor) {
    calories = floor
    floored = true
  }

  if (age < 18 && goal === 'lose') {
    const teenCap = Math.round(tdee - 250)
    if (calories < teenCap) {
      calories = Math.max(teenCap, floor)
      floored = calories === floor
      note = 'Because you are under 18, the deficit is kept small. Check with a doctor or dietitian before trying to lose weight.'
    }
  }

  // When the floor or the under-18 limit changed the calories, the pace (and the
  // "target in N weeks" estimate) follows the calories that are actually used.
  const plannedChange = (weeklyKg * KCAL_PER_KG) / 7
  if (weeklyKg !== 0 && Math.abs(calories - (tdee + plannedChange)) > 1) {
    const actual = ((calories - tdee) * 7) / KCAL_PER_KG
    weeklyKg = Math.sign(actual) === Math.sign(weeklyKg) ? Math.round(actual * 1000) / 1000 : 0
  }

  // Protein and the fat minimum use body weight, adjusted when BMI is over 25
  // (the weight at BMI 25 plus 40% of the rest), so they stay inside the calorie target.
  const range = healthyWeightRange(heightCm)
  const leanKg = bmiValue > 25 ? range.maxKg + 0.4 * (weightKg - range.maxKg) : weightKg
  let proteinG = Math.round(leanKg * proteinPerKg(goal))
  let fatG = Math.round((calories * fatShare(goal)) / 9)
  const minFat = Math.round(leanKg * 0.6)
  const minFatFromShare = Math.round((calories * 0.2) / 9)
  const maxFat = Math.round((calories * 0.35) / 9)
  fatG = Math.max(fatG, minFat, minFatFromShare)
  fatG = Math.min(fatG, Math.max(maxFat, minFat))
  let carbsG = Math.round((calories - proteinG * 4 - fatG * 9) / 4)
  if (carbsG < 0) {
    fatG = Math.max(Math.min(minFat, maxFat), fatG + Math.floor((carbsG * 4) / 9))
    carbsG = Math.round((calories - proteinG * 4 - fatG * 9) / 4)
  }
  if (carbsG < 0) {
    proteinG = Math.max(Math.round(leanKg * 1.2), Math.floor((calories - fatG * 9) / 4))
    carbsG = Math.max(0, Math.round((calories - proteinG * 4 - fatG * 9) / 4))
  }

  const target = Number.isFinite(profile.targetWeightKg) ? profile.targetWeightKg : null
  let weeks = null
  let directionMismatch = false
  if (target != null && weeklyKg !== 0) {
    const diff = target - weightKg
    if (diff === 0) weeks = 0
    else if (Math.sign(diff) !== Math.sign(weeklyKg)) directionMismatch = true
    else weeks = Math.round((diff / weeklyKg) * 10) / 10
  }

  return {
    bmi: bmiValue,
    bmiCategory: category,
    bmiPrime: bmiPrime(bmiValue),
    ponderal: ponderalIndex(weightKg, heightCm),
    bmr: Math.round(base),
    tdee: Math.round(tdee),
    calories,
    proteinG,
    fatG,
    carbsG,
    fiberG: Math.round((calories / 1000) * 14),
    weeklyKg,
    floor,
    floored,
    note,
    healthyMinKg: range.minKg,
    healthyMaxKg: range.maxKg,
    weeks,
    directionMismatch,
    waterMl: Number.isFinite(profile.waterGoalMl) && profile.waterGoalMl > 0
      ? Math.round(profile.waterGoalMl)
      : Math.round(weightKg * 35),
  }
}

export function adviceLines(profile, targets) {
  if (!profile || !targets) return []
  const lines = []
  lines.push(`Your BMI is ${targets.bmi.toFixed(1)}, ${targets.bmiCategory} on the adult table. BMI prime is ${targets.bmiPrime.toFixed(2)}, which is your BMI divided by 25.`)
  if (profile.age < 20) {
    lines.push('That adult table is for age 20 and older. Under 20, BMI is read against a growth chart, so treat this category as a rough screen.')
  }
  lines.push(`Estimated maintenance is ${targets.tdee.toLocaleString()} kcal a day. For the goal you chose, aim for about ${targets.calories.toLocaleString()} kcal.`)
  if (targets.floored) {
    lines.push(`That calorie target is sitting on the safety floor of ${targets.floor} kcal. A deeper cut would be hard to recover from and easier to lose muscle on.`)
  }
  if (targets.note) lines.push(targets.note)
  lines.push(`Protein is ${targets.proteinG} g, fat is ${targets.fatG} g, and carbohydrate fills the rest at about ${targets.carbsG} g. Fat is kept inside 20–35% of calories. Fiber near ${targets.fiberG} g follows 14 g per 1,000 kcal.`)
  if (targets.directionMismatch) {
    lines.push('Your target weight and weekly pace point in different directions. Change the pace or the target so they agree.')
  } else if (targets.weeks != null && targets.weeks > 0) {
    lines.push(`At this pace, the target weight is about ${targets.weeks} weeks away. Treat that date as a sketch. The weekly average of your scale weight matters more than any single morning.`)
  }
  if (profile.goal === 'gain' && targets.bmi > 30) {
    lines.push('Your BMI is in an obese class. A surplus is still what you asked for, and it is shown here. Many people in this range do better with a slow loss, or with lose fat and gain muscle, while they learn to lift.')
  }
  if (profile.age < 18) {
    lines.push('You are under 18. Use these numbers as a rough guide and talk with a doctor or registered dietitian before cutting calories.')
  }
  if (profile.age > 80) {
    lines.push('This calorie equation is less studied over age 80. Treat the result as a starting point and adjust from how your weight actually changes.')
  }
  lines.push('Weigh yourself a few mornings a week, after the bathroom and before eating. Look at the weekly average. A jump from one day to the next is usually water.')
  return lines
}
