import test from 'node:test'
import assert from 'node:assert/strict'
import { bmr, bmi, planTargets, healthyWeightRange } from '../src/lib/calc.js'
import { cmToFtIn, ftInToCm, kgToLb, lbToKg } from '../src/lib/units.js'
import { addDays, weekStart, monthMatrix } from '../src/lib/dates.js'
import { parseNutritionLabel } from '../src/lib/labelParse.js'
import { foods, popularFoodIds } from '../src/data/foods.js'
import { exercises } from '../src/data/exercises.js'
import { seedPlans } from '../src/data/plans.js'
import { gramsFrom } from '../src/lib/measure.js'
import { searchFoods } from '../src/lib/search.js'
import { nextLoad } from '../src/lib/training.js'

test('mifflin and maintenance calories for a known profile', () => {
  const profile = {
    sex: 'male', age: 30, heightCm: 180, weightKg: 80, activity: 'moderate', goal: 'maintain', weeklyKg: 0,
  }
  assert.equal(bmr(profile), 1780)
  const targets = planTargets(profile)
  assert.equal(targets.tdee, 2608)
  assert.equal(targets.calories, 2608)
  assert.equal(targets.proteinG, 128)
  assert.equal(targets.fatG, 87)
  assert.equal(targets.carbsG, 328)
  assert.equal(targets.bmiCategory, 'normal')
  assert.equal(bmi(80, 180).toFixed(1), '24.7')
})

test('female deficit is held at the calorie floor', () => {
  const targets = planTargets({
    sex: 'female', age: 25, heightCm: 165, weightKg: 60, activity: 'sedentary', goal: 'lose', weeklyKg: -0.5,
  })
  assert.equal(targets.bmr, 1345)
  assert.equal(targets.tdee, 1614)
  assert.equal(targets.calories, 1200)
  assert.equal(targets.floored, true)
})

test('underweight loss request stays at maintenance', () => {
  const targets = planTargets({
    sex: 'female', age: 22, heightCm: 170, weightKg: 48, activity: 'light', goal: 'lose', weeklyKg: -0.5,
  })
  assert.equal(targets.bmiCategory, 'moderate thinness')
  assert.equal(targets.weeklyKg, 0)
  assert.equal(targets.calories, targets.tdee)
  assert.ok(targets.note)
})

test('average sex constant sits between male and female', () => {
  const base = { age: 30, heightCm: 170, weightKg: 70, activity: 'sedentary', goal: 'maintain', weeklyKg: 0 }
  const male = bmr({ ...base, sex: 'male' })
  const female = bmr({ ...base, sex: 'female' })
  const average = bmr({ ...base, sex: 'average' })
  assert.ok(average < male && average > female)
  assert.equal(average, (male + female) / 2)
})

test('healthy weight range and unit conversions', () => {
  const range = healthyWeightRange(180)
  assert.ok(Math.abs(range.minKg - 59.94) < 0.05)
  assert.ok(Math.abs(range.maxKg - 81) < 0.05)
  const back = ftInToCm(cmToFtIn(180).feet, cmToFtIn(180).inches)
  assert.ok(Math.abs(back - 180) < 0.2)
  assert.ok(Math.abs(lbToKg(kgToLb(80)) - 80) < 0.001)
})

test('dates survive month edges and weeks start Monday', () => {
  assert.equal(addDays('2026-10-31', 1), '2026-11-01')
  assert.equal(addDays('2026-01-01', -1), '2025-12-31')
  assert.equal(weekStart('2026-10-20'), '2026-10-19')
  const matrix = monthMatrix(2026, 9)
  assert.equal(matrix[0][0], '2026-09-28')
  assert.ok(matrix.some((week) => week.includes('2026-10-20')))
})

test('chinese nutrition label converts kilojoules and ignores saturated fat', () => {
  const parsed = parseNutritionLabel(`
    营养成分表
    每100克
    能量 1580千焦
    蛋白质 12.5克
    脂肪 8.2克
    饱和脂肪 2.1克
    碳水化合物 45.0克
    膳食纤维 3.0克
    钠 320毫克
  `)
  assert.equal(parsed.kcal, 378)
  assert.equal(parsed.protein, 12.5)
  assert.equal(parsed.fat, 8.2)
  assert.equal(parsed.carbs, 45)
  assert.equal(parsed.fiber, 3)
  assert.equal(parsed.sodium, 320)
  assert.equal(parsed.per100, true)
  assert.equal(parsed.servingGrams, 100)
})

test('english label prefers calories and the serving in parentheses', () => {
  const parsed = parseNutritionLabel(`
    Nutrition Facts
    Serving size 1 cup (240g)
    Calories 250
    Total Fat 8g
    Saturated Fat 3g
    Total Carbohydrate 30g
    Dietary Fiber 4g
    Total Sugars 10g
    Protein 12g
    Sodium 480mg
  `)
  assert.equal(parsed.kcal, 250)
  assert.equal(parsed.fat, 8)
  assert.equal(parsed.carbs, 30)
  assert.equal(parsed.fiber, 4)
  assert.equal(parsed.sugar, 10)
  assert.equal(parsed.protein, 12)
  assert.equal(parsed.sodium, 480)
  assert.equal(parsed.servingGrams, 240)
})

test('chinese cereal table keeps grams and converts kilojoules, not the NRV percent', () => {
  const parsed = parseNutritionLabel(`
    家乐氏
    营养成分表 Nutrition Information
    项目 每100克 NRV%
    能量 1590千焦(kJ) 19%
    蛋白质 5.1克 9%
    脂肪 1.1克 2%
    反式脂肪 0克
    碳水化合物 85.2克 28%
    膳食纤维 2.2克 9%
    钠 370毫克 19%
  `)
  assert.equal(parsed.kcal, 380)
  assert.equal(parsed.protein, 5.1)
  assert.equal(parsed.fat, 1.1)
  assert.equal(parsed.carbs, 85.2)
  assert.equal(parsed.fiber, 2.2)
  assert.equal(parsed.sodium, 370)
  assert.equal(parsed.per100, true)
  assert.equal(parsed.name, '')
  assert.equal(parsed.facts.some((fact) => /[\u4e00-\u9fff]/.test(`${fact.label} ${fact.detail}`)), false)
  assert.equal(parsed.facts.find((fact) => fact.label === 'Energy').detail, '1590 kJ, saved as 380 kcal')
  assert.equal(parsed.notes.some((note) => /decimal/i.test(note)), false)
})

test('a dropped decimal on a per-100 g label is restored when the grams cannot fit', () => {
  const parsed = parseNutritionLabel(`
    logg
    营养成分表
    每100克
    净含量：175克
    能量 1593千焦
    蛋白质 51克
    碳水化合物 852克
    纤维 22克
    钠 372毫克
  `)
  assert.equal(parsed.kcal, 381)
  assert.equal(parsed.protein, 5.1)
  assert.equal(parsed.fat, null)
  assert.equal(parsed.carbs, 85.2)
  assert.equal(parsed.fiber, 2.2)
  assert.equal(parsed.sodium, 372)
  assert.equal(parsed.per100, true)
  assert.equal(parsed.name, '')
  assert.equal(parsed.facts.find((fact) => fact.label === 'Fat').detail, 'Not on the label')
  assert.equal(parsed.facts.find((fact) => fact.label === 'Net contents').detail, '175 g')
  assert.match(parsed.notes.find((note) => /decimal/i.test(note)), /85\.2/)
})

test('protein stays high when the calories agree', () => {
  const parsed = parseNutritionLabel(`
    营养成分表
    每100克
    能量 1570千焦
    蛋白质 51克
    碳水化合物 20克
    脂肪 5克
  `)
  assert.equal(parsed.protein, 51)
  assert.equal(parsed.carbs, 20)
  assert.equal(parsed.fat, 5)
})

test('skimmed milk per 100 ml converts a small kilojoule number', () => {
  const parsed = parseNutritionLabel(`
    脱脂纯牛奶
    Skimmed Milk
    营养成分表
    项目 每100mL NRV%
    能量 134kJ 2%
    蛋白质 3.2g 5%
    脂肪 0g 0%
    饱和脂肪 0g 0%
    碳水化合物 4.7g 2%
    糖 4.7g 2%
    钠 40mg 2%
    钙 100mg
  `)
  assert.equal(parsed.kcal, 32)
  assert.equal(parsed.protein, 3.2)
  assert.equal(parsed.fat, 0)
  assert.equal(parsed.carbs, 4.7)
  assert.equal(parsed.sugar, 4.7)
  assert.equal(parsed.sodium, 40)
  assert.equal(parsed.per100ml, true)
  assert.equal(parsed.name, 'Skimmed Milk')
  assert.equal(parsed.facts.find((fact) => fact.label === 'Calcium').detail, '100 mg')
  assert.equal(parsed.notes.some((note) => /decimal/i.test(note)), false)
})

test('mixed energy line keeps kilocalories', () => {
  const parsed = parseNutritionLabel('能量 1582kJ / 378千卡\n蛋白质 10克')
  assert.equal(parsed.kcal, 378)
  assert.equal(parsed.protein, 10)
})

test('food records are unique and macro calories are in range', () => {
  const ids = new Set()
  for (const food of foods) {
    assert.equal(ids.has(food.id), false, food.id)
    ids.add(food.id)
    assert.ok(food.servings[0].grams === 100)
    assert.ok(food.servings.every((serving) => serving.grams > 0 && serving.label))
    const macros = food.per100.protein * 4 + food.per100.carbs * 4 + food.per100.fat * 9
    if (food.per100.kcal > 40 && !food.approximate) {
      const diff = Math.abs(macros - food.per100.kcal) / food.per100.kcal
      assert.ok(diff < 0.2, `${food.id} macros ${macros.toFixed(0)} vs ${food.per100.kcal}`)
    }
  }
  for (const id of popularFoodIds) assert.ok(ids.has(id), id)
})

test('plans point at real exercises with photos', () => {
  const exerciseIds = new Set(exercises.map((item) => item.id))
  assert.ok(exercises.length > 1000)
  assert.equal(exerciseIds.size, exercises.length)
  for (const exercise of exercises) {
    assert.ok(exercise.image.includes('exercises/images/'), exercise.id)
    assert.ok(exercise.gif.includes('exercises/videos/'), exercise.id)
    assert.ok(exercise.cues.length >= 1, exercise.id)
  }
  for (const item of seedPlans()) {
    const weekdays = item.days.map((d) => d.weekday)
    assert.equal(new Set(weekdays).size, weekdays.length, item.id)
    for (const d of item.days) {
      assert.ok(d.weekday >= 0 && d.weekday <= 6)
      for (const slot of d.exercises) assert.ok(exerciseIds.has(slot.exerciseId), slot.exerciseId)
    }
  }
})

test('amount slider converts servings, grams, and millilitres', () => {
  const oil = { density: 0.91 }
  assert.equal(gramsFrom(oil, 1, 'serving', 14), 14)
  assert.equal(gramsFrom(null, 100, 'g'), 100)
  assert.equal(Math.round(gramsFrom(oil, 15, 'ml')), 14)
  assert.equal(gramsFrom({ density: null }, 240, 'ml'), 240)
})

test('load suggestion adds a small jump after the top of the rep range', () => {
  const sets = [{ reps: 8, weightKg: 60 }, { reps: 8, weightKg: 60 }]
  assert.equal(nextLoad(sets, '6-8', 'metric'), 62.5)
  assert.equal(nextLoad([{ reps: 5, weightKg: 60 }], '6-8', 'metric'), null)
})

test('food search finds chinese and english names', () => {
  assert.equal(searchFoods('鸡胸', foods)[0].id, 'chicken-breast')
  assert.equal(searchFoods('rice', foods)[0].id, 'white-rice')
  assert.equal(searchFoods('蛋炒饭', foods)[0].id, 'fried-rice')
  assert.equal(searchFoods('zzzz-nope', foods).length, 0)
})
