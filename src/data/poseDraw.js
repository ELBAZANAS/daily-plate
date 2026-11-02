const JOINTS = ['head', 'neck', 'lShoulder', 'rShoulder', 'lElbow', 'rElbow', 'lHand', 'rHand', 'hip', 'lKnee', 'rKnee', 'lAnkle', 'rAnkle']

const stand = {
  head: [100, 36],
  neck: [100, 52],
  lShoulder: [82, 60],
  rShoulder: [118, 60],
  lElbow: [74, 92],
  rElbow: [126, 92],
  lHand: [70, 122],
  rHand: [130, 122],
  hip: [100, 116],
  lKnee: [88, 156],
  rKnee: [112, 156],
  lAnkle: [84, 200],
  rAnkle: [116, 200],
}

function pose(overrides, options = {}) {
  const equipment = options.equipment || []
  const hide = options.hide || []
  for (const key of Object.keys(overrides)) {
    if (!(key in stand)) throw new Error(`Unknown joint ${key}`)
  }
  for (const key of hide) {
    if (!(key in stand)) throw new Error(`Unknown hide ${key}`)
  }
  return { joints: { ...stand, ...overrides }, equipment, hide }
}

export const poseDraw = {
  squat: pose({
    head: [100, 52],
    neck: [100, 66],
    lShoulder: [84, 74],
    rShoulder: [116, 74],
    lElbow: [62, 96],
    rElbow: [138, 96],
    lHand: [78, 78],
    rHand: [122, 78],
    hip: [100, 128],
    lKnee: [62, 162],
    rKnee: [138, 162],
    lAnkle: [74, 202],
    rAnkle: [126, 202],
  }, { equipment: [{ type: 'line', points: [48, 70, 152, 70] }] }),

  bench: pose({
    head: [42, 86],
    neck: [58, 90],
    lShoulder: [72, 86],
    lElbow: [96, 64],
    lHand: [118, 48],
    hip: [118, 98],
    lKnee: [150, 112],
    lAnkle: [178, 124],
  }, {
    hide: ['rShoulder', 'rElbow', 'rHand', 'rKnee', 'rAnkle'],
    equipment: [
      { type: 'line', points: [30, 108, 150, 108], kind: 'bench' },
      { type: 'line', points: [88, 44, 146, 44] },
    ],
  }),

  fly: pose({
    head: [46, 82],
    neck: [62, 88],
    lShoulder: [76, 84],
    lElbow: [96, 70],
    lHand: [118, 86],
    hip: [124, 96],
    lKnee: [156, 108],
    lAnkle: [184, 118],
  }, {
    hide: ['rShoulder', 'rElbow', 'rHand', 'rKnee', 'rAnkle'],
    equipment: [
      { type: 'line', points: [34, 108, 156, 108], kind: 'bench' },
      { type: 'line', points: [112, 78, 132, 92], kind: 'bell' },
    ],
  }),

  pushup: pose({
    head: [36, 108],
    neck: [52, 112],
    lShoulder: [66, 104],
    lElbow: [84, 128],
    lHand: [102, 146],
    hip: [124, 116],
    lKnee: [160, 116],
    lAnkle: [190, 116],
  }, {
    hide: ['rShoulder', 'rElbow', 'rHand', 'rKnee', 'rAnkle'],
    equipment: [{ type: 'line', points: [24, 150, 196, 150], kind: 'bench' }],
  }),

  dip: pose({
    head: [100, 48],
    neck: [100, 64],
    lShoulder: [78, 78],
    rShoulder: [122, 78],
    lElbow: [58, 108],
    rElbow: [142, 108],
    lHand: [48, 132],
    rHand: [152, 132],
    hip: [100, 132],
    lKnee: [86, 168],
    rKnee: [114, 168],
    lAnkle: [78, 200],
    rAnkle: [122, 200],
  }, { equipment: [{ type: 'line', points: [36, 136, 64, 136] }, { type: 'line', points: [136, 136, 164, 136] }] }),

  pullup: pose({
    head: [100, 58],
    neck: [100, 72],
    lShoulder: [82, 80],
    rShoulder: [118, 80],
    lElbow: [74, 52],
    rElbow: [126, 52],
    lHand: [66, 28],
    rHand: [134, 28],
    hip: [100, 124],
    lKnee: [84, 168],
    rKnee: [116, 168],
    lAnkle: [96, 196],
    rAnkle: [128, 188],
  }, { equipment: [{ type: 'line', points: [40, 24, 160, 24] }] }),

  pulldown: pose({
    head: [100, 70],
    neck: [100, 84],
    lShoulder: [80, 92],
    rShoulder: [120, 92],
    lElbow: [62, 78],
    rElbow: [138, 78],
    lHand: [78, 58],
    rHand: [122, 58],
    hip: [100, 140],
    lKnee: [90, 176],
    rKnee: [114, 176],
    lAnkle: [88, 206],
    rAnkle: [118, 206],
  }, { equipment: [{ type: 'line', points: [70, 54, 130, 54] }, { type: 'line', points: [100, 18, 100, 54] }] }),

  row: pose({
    head: [58, 78],
    neck: [74, 88],
    lShoulder: [86, 96],
    lElbow: [108, 112],
    lHand: [126, 128],
    hip: [118, 118],
    lKnee: [146, 156],
    lAnkle: [150, 202],
  }, {
    hide: ['rShoulder', 'rElbow', 'rHand', 'rKnee', 'rAnkle'],
    equipment: [{ type: 'line', points: [108, 132, 168, 132] }],
  }),

  ohp: pose({
    head: [100, 78],
    neck: [100, 92],
    lShoulder: [82, 100],
    rShoulder: [118, 100],
    lElbow: [74, 72],
    rElbow: [126, 72],
    lHand: [70, 42],
    rHand: [130, 42],
    hip: [100, 140],
    lKnee: [88, 172],
    rKnee: [112, 172],
  }, { equipment: [{ type: 'line', points: [52, 38, 148, 38] }] }),

  lateral: pose({
    head: [100, 48],
    neck: [100, 62],
    lShoulder: [82, 70],
    rShoulder: [118, 70],
    lElbow: [52, 78],
    rElbow: [148, 78],
    lHand: [28, 70],
    rHand: [172, 70],
    hip: [100, 118],
  }, {
    equipment: [
      { type: 'line', points: [16, 66, 36, 76], kind: 'bell' },
      { type: 'line', points: [164, 76, 184, 66], kind: 'bell' },
    ],
  }),

  curl: pose({
    head: [100, 40],
    neck: [100, 54],
    lShoulder: [82, 64],
    rShoulder: [118, 64],
    lElbow: [70, 96],
    rElbow: [130, 96],
    lHand: [86, 78],
    rHand: [114, 78],
  }, { equipment: [{ type: 'line', points: [78, 74, 122, 74] }] }),

  tricep: pose({
    head: [100, 46],
    lElbow: [124, 70],
    lHand: [146, 96],
    rElbow: [76, 92],
    rHand: [70, 122],
  }, { equipment: [{ type: 'line', points: [138, 88, 164, 104], kind: 'bell' }] }),

  deadlift: pose({
    head: [64, 70],
    neck: [80, 82],
    lShoulder: [92, 92],
    lElbow: [110, 116],
    lHand: [126, 142],
    hip: [118, 124],
    lKnee: [142, 160],
    lAnkle: [146, 204],
  }, {
    hide: ['rShoulder', 'rElbow', 'rHand', 'rKnee', 'rAnkle'],
    equipment: [{ type: 'line', points: [104, 146, 176, 146] }],
  }),

  lunge: pose({
    head: [108, 36],
    neck: [104, 50],
    hip: [96, 112],
    lKnee: [62, 156],
    lAnkle: [52, 202],
    rKnee: [132, 170],
    rAnkle: [168, 202],
    lHand: [78, 96],
    rHand: [132, 100],
  }),

  legpress: pose({
    head: [46, 70],
    neck: [62, 78],
    lShoulder: [74, 86],
    hip: [108, 96],
    lKnee: [150, 70],
    lAnkle: [176, 48],
    lElbow: [70, 108],
    lHand: [58, 124],
  }, {
    hide: ['rShoulder', 'rElbow', 'rHand', 'rKnee', 'rAnkle'],
    equipment: [
      { type: 'line', points: [36, 130, 130, 130], kind: 'bench' },
      { type: 'line', points: [160, 36, 190, 58] },
    ],
  }),

  hipthrust: pose({
    head: [42, 104],
    neck: [58, 100],
    lShoulder: [70, 104],
    hip: [112, 78],
    lKnee: [150, 92],
    lAnkle: [168, 130],
    lElbow: [62, 120],
    lHand: [48, 128],
  }, {
    hide: ['rShoulder', 'rElbow', 'rHand', 'rKnee', 'rAnkle'],
    equipment: [
      { type: 'line', points: [28, 124, 86, 124], kind: 'bench' },
      { type: 'line', points: [96, 70, 132, 70] },
    ],
  }),

  plank: pose({
    head: [34, 112],
    neck: [50, 116],
    lShoulder: [66, 112],
    lElbow: [78, 136],
    lHand: [96, 146],
    hip: [124, 116],
    lKnee: [162, 116],
    lAnkle: [192, 116],
  }, {
    hide: ['rShoulder', 'rElbow', 'rHand', 'rKnee', 'rAnkle'],
    equipment: [{ type: 'line', points: [24, 150, 198, 150], kind: 'bench' }],
  }),

  crunch: pose({
    head: [78, 108],
    neck: [92, 116],
    lShoulder: [104, 124],
    hip: [132, 140],
    lKnee: [156, 112],
    lAnkle: [176, 96],
    lElbow: [96, 104],
    lHand: [84, 92],
  }, {
    hide: ['rShoulder', 'rElbow', 'rHand', 'rKnee', 'rAnkle'],
    equipment: [{ type: 'line', points: [40, 156, 168, 156], kind: 'bench' }],
  }),

  run: pose({
    head: [78, 40],
    neck: [90, 54],
    lShoulder: [100, 64],
    lElbow: [118, 84],
    lHand: [132, 100],
    rElbow: [74, 80],
    rHand: [60, 98],
    hip: [108, 112],
    lKnee: [140, 140],
    lAnkle: [162, 176],
    rKnee: [90, 150],
    rAnkle: [70, 188],
  }),

  cycle: pose({
    head: [70, 48],
    neck: [84, 62],
    lShoulder: [96, 70],
    lElbow: [112, 88],
    lHand: [126, 78],
    hip: [100, 108],
    lKnee: [132, 132],
    lAnkle: [150, 156],
    rKnee: [118, 150],
    rAnkle: [146, 168],
  }, {
    hide: ['rShoulder', 'rElbow', 'rHand'],
    equipment: [{ type: 'circle', cx: 150, cy: 168, r: 28 }, { type: 'line', points: [110, 78, 150, 70] }],
  }),

  swing: pose({
    head: [112, 48],
    neck: [104, 62],
    hip: [92, 112],
    lHand: [70, 150],
    rHand: [78, 156],
    lElbow: [82, 112],
    rElbow: [90, 120],
    lKnee: [70, 156],
    lAnkle: [64, 202],
    rKnee: [112, 160],
    rAnkle: [120, 202],
  }, { equipment: [{ type: 'line', points: [52, 156, 96, 164], kind: 'bell' }] }),

  carry: pose({
    lHand: [58, 132],
    rHand: [142, 132],
    lElbow: [68, 100],
    rElbow: [132, 100],
  }, {
    equipment: [
      { type: 'line', points: [40, 124, 66, 140], kind: 'bell' },
      { type: 'line', points: [134, 140, 160, 124], kind: 'bell' },
    ],
  }),
}

export const poseIds = Object.keys(poseDraw)
export const jointNames = JOINTS

export const BONES = [
  ['head', 'neck'],
  ['neck', 'hip'],
  ['neck', 'lShoulder'],
  ['neck', 'rShoulder'],
  ['lShoulder', 'lElbow'],
  ['lElbow', 'lHand'],
  ['rShoulder', 'rElbow'],
  ['rElbow', 'rHand'],
  ['hip', 'lKnee'],
  ['lKnee', 'lAnkle'],
  ['hip', 'rKnee'],
  ['rKnee', 'rAnkle'],
]
