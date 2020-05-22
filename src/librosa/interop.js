const { spawn } = require('child_process')
const { librosaServerPort: port, librosaServerMaxTries: maxTries } = require('../consts')
const { delay, waitUntil, waitEvent, timeout, errorCode } = require('../util')
const { connect } = require('net')
const path = require('path')
const { readFile } = require('fs').promises
const consola = require('consola')

const pythonExecutable = process.platform === 'win32' ? 'python' : 'python3'

let spawnTries = 0, processIsUp = false, child = null
const startServer = async () => {
  consola.info('Trying to start librosa server...')
  child = spawn(pythonExecutable, [ path.resolve(__dirname, 'serve.py'), port ], { stdio: 'inherit' })
  const oldTries = spawnTries
  child.on('exit', async e => {
    processIsUp = false
    child = null
    if (e === null) return
    consola.error(`Librosa server failed with exit code ${e}!`)
    if (spawnTries === maxTries) {
      consola.fatal('Librosa failed to work! Exiting.')
      process.exit(2)
    }
    spawnTries++
    await delay(5000)
    consola.info(`Retrying librosa server ${spawnTries}:`)
    startServer()
  })
  await delay(3000)
  if (oldTries === spawnTries) processIsUp = true
  await delay(60000)
  if (oldTries === spawnTries) {
    spawnTries = 0
    consola.ready('Librosa server started.')
  }
}
startServer()

process.on('exit', () => child ? child.kill() : null)
const cleanup = () => {
  if (child) child.kill()
  process.exit(0)
}
process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)

exports.preprocess = async path => {
  // return JSON.parse(await readFile(path + '.json'))
  const start = Date.now()
  consola.debug(`Begin librosa ${path}`)
  await waitUntil(() => processIsUp)
  const socket = connect(port)
  await timeout(waitEvent(socket, 'connect'), 2000)
  socket.write(path + '\n')
  let response = ''
  while (true) {
    const data = await Promise.race([ timeout(waitEvent(socket, 'data'), 600000), waitEvent(socket, 'end') ])
    if (data === undefined) break
    response += data
  }
  if (response === '') throw errorCode(new Error('Invalid response from librosa: empty response'), 'EEMPTY')
  const [ status, data, time ] = response.split('|')
  if (status === '404') throw errorCode(new Error('File Not Found'), 'ENOTFOUND')
  if (status === '500') throw errorCode(new Error(`Internal Error: ${data}`), 'EINTERNAL_ERROR')
  if (status !== '200') throw errorCode(new Error(`Unknown status ${status}, response ${response}`), 'EUNKNOWN')
  const musicInfo = JSON.parse(await readFile(data))
  consola.info(`Librosa success in ${time}, total ${((Date.now() - start) / 1000).toFixed(2)}.`)
  return musicInfo
}
