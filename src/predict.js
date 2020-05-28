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
const genreNames = [
  'cinematic',
  'rock',
  'ambient',
  'jazz&blues',
  'dance&electronic',
  'pop&hip hop',
  'r&b&soul',
  'childrens&holiday',
  'country&folk',
]
const moodModelPath = 'file://' + path.resolve(__dirname, '../model/mood/model.json')
const instrumentsModelPath = 'file://' + path.resolve(__dirname, '../model/instruments/model.json')
const genreModelPath = 'file://' + path.resolve(__dirname, '../model/genre/model.json')
const maxLength = 1840
let moodModel, instrumentsModel, genreModel
loadLayersModel(moodModelPath).then(m => moodModel = m)
loadLayersModel(instrumentsModelPath).then(m => instrumentsModel = m)
loadLayersModel(genreModelPath).then(m => genreModel = m)

exports.predict = async datas => {
  await waitUntil(() => !!moodModel && !!instrumentsModel)
  const inputTensor = tensor(datas.map(data => normalizeOne(prepareOne(data), maxLength)))
  const moodRes = await moodModel.predict(
    inputTensor,
    { batchSize: 128 },
  ).mean(1)
   .reshape([ datas.length, 10 ])
   .argMax(1)
   .array()
  const instrumentsRes = await instrumentsModel.predict(
    inputTensor,
    { batchSize: 128 },
  ).mean(1)
   .reshape([ datas.length, 10 ])
   .array()
  const genreRes = await genreModel.predict(
    inputTensor,
    { batchSize: 128 },
  ).mean(1)
   .reshape([ datas.length, 15 ])
   .argMax(1)
   .array()
  return datas.map((_, i) => {
    const instruments = {}
    instrumentsRes[i].forEach((p, i) => p > instrumentThreshold ? instruments[instrumentNames[i]] = p : null)
    return {
      mood: moodNames[moodRes[i]],
      instruments,
      genre: genreNames[genreRes[i]],
    }
  })
}
