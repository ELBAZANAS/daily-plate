import test from 'node:test'
import assert from 'node:assert/strict'
import { groupRows } from '../src/lib/ocrRows.js'
import { bestReading, parseNutritionLabel, readerTexts } from '../src/lib/labelParse.js'
import { personalRecords, recordsSetBy, epley, setsByGroup, formatClock } from '../src/lib/training.js'
import { searchExercises } from '../src/lib/search.js'
import { exercises, exerciseById } from '../src/data/exercises.js'

const box = (x, y, w, h, tilt = 0) => [[x, y], [x + w, y + w * tilt], [x + w, y + h + w * tilt], [x, y + h]]

test('tilted table cells are joined into rows', () => {
  const tilt = -0.03
  const items = [
    { text: '能量', box: box(100, 500, 120, 50, tilt) },
    { text: '1580千焦', box: box(700, 500 + 600 * tilt, 220, 50, tilt) },
    { text: '19%', box: box(1300, 500 + 1200 * tilt, 90, 50, tilt) },
    { text: '蛋白质', box: box(100, 600, 150, 50, tilt) },
    { text: '6.5克', box: box(700, 600 + 600 * tilt, 160, 50, tilt) },
  ]
  assert.deepEqual(groupRows(items), ['能量 1580千焦 19%', '蛋白质 6.5克'])
})

test('the most complete reading wins', () => {
  const good = '营养成分表\n每100克\n能量 1580千焦\n蛋白质 6.5克\n脂肪 12.3克\n碳水化合物 58.2克'
  const poor = '营养成分表\n能量 1580千焦'
  const best = bestReading(readerTexts(JSON.stringify({ candidates: [poor, good] })))
  assert.equal(best.text, good)
  assert.equal(best.parsed.carbs, 58.2)
  assert.deepEqual(readerTexts('plain text'), ['plain text'])
})

test('english label name skips nutrient lines', () => {
  const best = bestReading(['Dietary Fiber 3g\nNutrition Facts\nCalories 190\nProtein 10g'])
  assert.equal(best.parsed.name, '')
})

test('personal records and new bests', () => {
  const s1 = { id: 'a', date: '2026-10-01', exercises: [{ exerciseId: '0043', sets: [{ reps: 8, weightKg: 100 }] }] }
  const s2 = { id: 'b', date: '2026-10-03', exercises: [{ exerciseId: '0043', sets: [{ reps: 5, weightKg: 110 }] }] }
  const records = personalRecords([s1, s2])
  assert.equal(records.get('0043').weight.weightKg, 110)
  assert.deepEqual(recordsSetBy(s2, [s1, s2]).map((r) => r.kind), ['weight'])
  assert.equal(recordsSetBy(s1, [s1, s2]).length, 0)
  assert.equal(epley(100, 1), 100)
  assert.equal(epley(100, 13), null)
  assert.equal(setsByGroup([s1, s2], exerciseById)[0].sets, 2)
  assert.equal(formatClock(3725000), '1:02:05')
})

test('exercise search ranks common lifts and understands Chinese', () => {
  assert.equal(searchExercises('bench press', exercises)[0].name, 'barbell bench press')
  assert.equal(searchExercises('卧推', exercises)[0].name, 'barbell bench press')
  assert.ok(searchExercises('deadlift', exercises)[0].name.includes('deadlift'))
  assert.ok(!exercises.some((e) => e.name.includes('в°')))
})

test('OCR text without spaces still parses', () => {
  const best = bestReading(['Nutrition Facts\nServing size1bar(40g)\nCalories 190\nTotalFat7g 9%\nSaturatedFat3g 15%\nSodium120mg 59\nTotal Carbohydrate24g 9%\nDietaryFiber3g 11%\nTotal Sugars9g\nProtein 10g'])
  const p = best.parsed
  assert.deepEqual([p.kcal, p.fat, p.carbs, p.fiber, p.sugar, p.protein, p.sodium, p.servingGrams], [190, 7, 24, 3, 9, 10, 120, 40])
})

test('a product name above the table is not read as a nutrient row', () => {
  const bar = parseNutritionLabel('Peanut Butter Protein Bar 40g\nNutrition Facts\nServing size 1 bar (60g)\nCalories 230\nTotal Fat 9g\nTotal Carbohydrate 22g\nProtein 20g\nSodium 190mg')
  assert.equal(bar.protein, 20)
  assert.equal(bar.kcal, 230)
  const yogurt = parseNutritionLabel('无糖酸奶\n营养成分表\n项目 每100克 NRV%\n能量 300千焦 4%\n蛋白质 3.0克 5%\n脂肪 3.1克 5%\n碳水化合物 5.0克 2%\n糖 0克\n钠 50毫克 3%')
  assert.equal(yogurt.sugar, 0)
})

test('calories from fat does not become the fat row', () => {
  const parsed = parseNutritionLabel('Nutrition Facts\nServing Size 1 cup (240mL)\nCalories 90 Calories from Fat 0\nTotal Fat 0.5g\nTotal Carbohydrate 20g\nProtein 2g')
  assert.equal(parsed.fat, 0.5)
  assert.equal(parsed.kcal, 90)
})

test('two-column labels keep the per 100 g column', () => {
  const parsed = parseNutritionLabel('NUTRITION INFORMATION\nServing size: 30g\nAvg Quantity per Serving per 100g\nEnergy 480kJ 1600kJ\nProtein 3.0g 10.0g\nFat, total 1.5g 5.0g\nCarbohydrate 18.0g 60.0g\nSodium 60mg 200mg')
  assert.equal(parsed.per100, true)
  assert.equal(parsed.kcal, 382)
  assert.equal(parsed.protein, 10)
  assert.equal(parsed.sodium, 200)
})

test('kcal wins over kJ on one line, fibre and salt are understood', () => {
  assert.equal(parseNutritionLabel('营养成分表\n能量 1700kJ / 400千卡\n蛋白质 10克').kcal, 400)
  const uk = parseNutritionLabel('Nutrition per 100g\nEnergy 1556kJ / 372kcal\nFat 7g\nCarbohydrate 62g\nFibre 9g\nProtein 11g\nSalt 1.5g')
  assert.equal(uk.fiber, 9)
  assert.equal(uk.sodium, 600)
  assert.equal(parseNutritionLabel('Nutrition Facts\nCalories\n230\nProtein 3g').kcal, 230)
  assert.equal(parseNutritionLabel('营养成分表\n每100克\n钠(mg) 370\n蛋白质(g) 6.5').sodium, 370)
})

test('macro targets never add up to more than the calorie target', async () => {
  const { planTargets } = await import('../src/lib/calc.js')
  for (const profile of [
    { sex: 'female', age: 40, heightCm: 160, weightKg: 100, activity: 'sedentary', goal: 'lose', weeklyKg: -0.9 },
    { sex: 'male', age: 30, heightCm: 175, weightKg: 140, activity: 'sedentary', goal: 'lose', weeklyKg: -0.9 },
  ]) {
    const t = planTargets(profile)
    assert.ok(t.proteinG * 4 + t.carbsG * 4 + t.fatG * 9 <= t.calories + 5, JSON.stringify(t))
  }
  const floored = planTargets({ sex: 'female', age: 25, heightCm: 165, weightKg: 60, activity: 'sedentary', goal: 'lose', weeklyKg: -0.5, targetWeightKg: 55 })
  assert.equal(floored.calories, 1200)
  assert.ok(floored.weeks > 12, String(floored.weeks))
})

test('chinese exercise names with untranslated words still find results', () => {
  for (const q of ['坐姿划船', '罗马尼亚硬拉', '保加利亚分腿蹲', '上斜卧推', 'rdl', 'ohp', 'pullups']) {
    assert.ok(searchExercises(q, exercises).length > 0, q)
  }
})
