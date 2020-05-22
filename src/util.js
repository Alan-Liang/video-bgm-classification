module.exports = {
  delay: ms => new Promise(resolve => setTimeout(resolve, ms)),
  timeout: (promise, ms, reason = 'Timed out.') => Promise.race([ new Promise((_, reject) => setTimeout(reject, ms, reason)), promise ]),
  waitUntil: (predicate, interval = 100) => new Promise(resolve => {
    const check = () => predicate() ? resolve() : setTimeout(check, interval)
    check()
  }),
  errorCode: (e, code) => { e.code = code; return e },
  waitEvent: (ee, event) => new Promise(resolve => ee.once(event, resolve)),
}
