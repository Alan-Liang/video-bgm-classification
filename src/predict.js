const { loadLayersModel, tensor } = require('@tensorflow/tfjs-node')
const { prepareOne } = require('./prepare-one')
const { normalizeOne } = require('./normalize-one')
const { waitUntil } = require('./util')
const { instrumentThreshold } = require('./consts')
const path = require('path')

const moodNames = [
  'dramatic',
  'inspirational',
  'funky',
  'calm',
  'dark',
  'happy',
  'angry',
  'bright',
  'romantic',
  'sad',
]
const instrumentNames = [
  'drum',        'piano',
  'string',      'guitar',
  'woodwind',    'brass',
  'chorus',      'bass',
  'synthesizer', 'accordion',
]
const moodModelPath = 'file://' + path.resolve(__dirname, '../model/mood/model.json')
const instrumentsModelPath = 'file://' + path.resolve(__dirname, '../model/instruments/model.json')
const maxLength = 1840
let moodModel, instrumentsModel
loadLayersModel(moodModelPath).then(m => moodModel = m)
loadLayersModel(instrumentsModelPath).then(m => instrumentsModel = m)

exports.predict = async datas => {
  await waitUntil(() => !!moodModel && !!instrumentsModel)
  const moodRes = await moodModel.predict(
    tensor(datas.map(filePath => normalizeOne(prepareOne(filePath), maxLength))),
    { batchSize: 128 },
  ).mean(1)
   .reshape([ datas.length, 10 ])
   .argMax(1)
   .array()
  const instrumentsRes = await instrumentsModel.predict(
    tensor(datas.map(data => normalizeOne(prepareOne(data), maxLength))),
    { batchSize: 128 },
  ).mean(1)
   .reshape([ datas.length, 10 ])
   .array()
  return datas.map((_, i) => {
    const instruments = {}
    instrumentsRes[i].forEach((p, i) => p > instrumentThreshold ? instruments[instrumentNames[i]] = p : null)
    return {
      mood: moodNames[moodRes[i]],
      instruments,
    }
  })
}
