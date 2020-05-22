if (process.argv.length < 3) {
  console.log('Usage: node examples/predict <music file path>')
  process.exit(1)
}

require('dotenv').config()
const { preprocess } = require('../src/librosa/interop')
const { predict } = require('../src/predict')

;(async () => console.log(await predict([ await preprocess(process.argv[2]) ])))().catch(e => {
  console.error(e)
  process.exit(1)
})
