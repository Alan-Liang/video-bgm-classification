require('dotenv').config()
const path = require('path')
const { copyFile, readFile } = require('fs').promises
const Koa = require('koa')
const Router = require('@koa/router')
const bodyparser = require('koa-body')
const static = require('koa-static')
const render = require('koa-ejs')
const consola = require('consola')
const winston = require('winston')
const koaWinston = require('koa2-winston')
const Datastore = require('nedb-promise')
const KasClient = require('@keeer/kas-client')
const { preprocess } = require('./librosa/interop')
const { predict } = require('./predict')
const { parseQuery } = require('./parse-query')
const uuid = require('uuid').v4
const { port, host, databaseFilename, tokenCookieName, kasBase, kasServiceToken, audioPath, isDev } = require('./consts')
const { delay } = require('./util')

const db = new Datastore({
  filename: databaseFilename,
  autoload: true,
})
const app = new Koa()
const kas = new KasClient({ base: kasBase, token: kasServiceToken })

{
  const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.json(),
    ),
    transports: [
      new winston.transports.File({ filename: 'error.log', level: 'error' }),
      new winston.transports.File({ filename: 'verbose.log', level: 'verbose' }),
    ],
  })
  consola._reporters.push(new consola.WinstonReporter(logger))
}

const router = new Router()
app.use(koaWinston.logger({
  transports: new winston.transports.File({ filename: 'access.log' }),
  reqUnselect: [ 'headers.cookie', 'headers.authorization' ],
}))
app.use(async (ctx, next) => {
  ctx.state.user = null
  const token = ctx.cookies.get(tokenCookieName)
  if (!token) return await next()
  const tokenEntry = await db.findOne({ is: 'token', token })
  if (tokenEntry) {
    ctx.state.user = tokenEntry.kiuid
    return await next()
  } else {
    try {
      const kiuid = await kas.getKiuid(token)
      await db.insert({ is: 'token', token, kiuid, time: Date.now() })
      ctx.state.user = kiuid
      return await next()
    } catch (e) {
      if (e.code === 'ENOT_LOGGED_IN') return await next()
      throw e
    }
  }
})
const requireLogin = (ctx, next) => ctx.state.user ? next() : ctx.redirect('/welcome')
app.use(bodyparser({ multipart: true, formidable: { maxFileSize: 1024 ** 3 } }))
app.use(router.routes()).use(router.allowedMethods())
render(app, {
  root: path.resolve(__dirname, 'view'),
  async: true,
  viewExt: 'ejs',
  outputFunctionName: 'print',
  cache: !isDev,
})

Object.defineProperty(app.context, 'ejsOpts', {
  get () { return { require, db, consola, app, ctx: this, kiuid: this.state.user } },
  enumerable: true,
})

router.get('/', requireLogin, ctx => ctx.render('index', { ...ctx.ejsOpts, title: '首页' }))
router.get('/search', requireLogin, ctx => ctx.render('search', { ...ctx.ejsOpts, title: '搜索结果', parseQuery }))
router.get('/welcome', ctx => ctx.render('welcome', { ...ctx.ejsOpts, title: 'vbgmc' }))
router.get('/add', requireLogin, ctx => ctx.render('add', { ...ctx.ejsOpts, title: '添加到曲库' }))
router.get('/_audio/:id', requireLogin, async (ctx, next) => {
  ctx.path = ctx.path.replace('/_audio', '')
  if (await db.find({ is: 'music', kiuid: ctx.state.user, id: ctx.params.id, done: true }, { id: 1 })) await next()
  ctx.path = '/_audio' + ctx.path
}, static(path.resolve(audioPath)))
router.get('/audio/:id', requireLogin, async ctx => {
  const { id } = ctx.params
  const audio = await db.findOne({ is: 'music', kiuid: ctx.state.user, id, done: true })
  if (!audio) return
  const audioData = JSON.parse((await readFile(path.resolve(audioPath, id + '.json'))).toString())
  await ctx.render('audio', { ...ctx.ejsOpts, title: audio.name, audio, audioData })
})
router.post('/api/add', requireLogin, async ctx => {
  let files = ctx.request.files.files
  if (!Array.isArray(files)) files = [ files ]
  if (files.some(x => x.size > 50 * 1024 * 1024)) return ctx.body = 'Too large'
  for (const file of files) {
    const { path: pathname, type, name: filename } = file
    if (!type.startsWith('audio/')) return ctx.body = 'Not a audio file'
    const ext = filename.split('.').pop()
    if (ext === 'flac') return ctx.body = '暂不支持 flac 文件'
    if (ext.length > 128) return ctx.body = 'Stop attacking!'
    const id = `${uuid()}.${ext}`
    await copyFile(pathname, path.resolve(audioPath, id))
    await db.insert({ is: 'music', name: filename, id, done: false, busy: false, kiuid: ctx.state.user })
  }
  return ctx.redirect('/')
})

;(async () => {
  if (isDev) await db.update({ is: 'music', busy: true }, { $set: { busy: false } }, { multi: true })
  while (true) {
    await delay(2000)
    const unresolvedMusic = await db.find({ is: 'music', done: false, busy: false })
    if (unresolvedMusic.length === 0) continue
    const musicToDo = unresolvedMusic.slice(0, 8)
    for (const { id } of musicToDo) await db.update({ is: 'music', id }, { $set: { busy: true } })
    const data = []
    for (const { id } of musicToDo) data.push(await preprocess(path.resolve(audioPath, id)))
    const res = await predict(data)
    musicToDo.forEach(({ id }, i) => db.update({ is: 'music', id }, {
      $unset: { busy: true },
      $set: {
        done: true,
        duration: data[i].duration,
        tempo: data[i].tempo,
        pauses: data[i].pauses,
        pauseCount: data[i].pauses.length,
        mood: res[i].mood,
        instruments: Object.keys(res[i].instruments)
      }
    }))
  }
})().catch(e => {
  consola.fatal('Unable to resolve music, exiting:')
  consola.fatal(e)
  process.exit(1)
})

app.listen(port, host)
consola.ready({
  message: `Server listening on http://${host}:${port}`,
  badge: true,
})
