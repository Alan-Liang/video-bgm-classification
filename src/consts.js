const { env } = process
module.exports = Object.freeze({
  host: env.HOST,
  port: Number(env.PORT),
  databaseFilename: env.DATABASE_FILENAME,
  tokenCookieName: env.TOKEN_COOKIE_NAME,
  kasBase: env.KAS_BASE,
  kasServiceToken: env.KAS_SERVICE_TOKEN,
  librosaServerPort: Number(env.LIBROSA_SERVER_PORT),
  librosaServerMaxTries: Number(env.LIBROSA_SERVER_MAX_TRIES),
  instrumentThreshold: Number(env.INSTRUMENT_THRESHOLD),
  audioPath: env.AUDIO_PATH,
  isDev: env.NODE_ENV === 'development',
})
