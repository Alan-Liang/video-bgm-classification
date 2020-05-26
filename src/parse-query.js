const { errorCode } = require('./util')

const typeGroups = types => x => {
  if (!x || !x.groups) return null
  for (const type of types) if (x.groups[type] !== undefined) return { type, value: x.groups[type].trim() }
  return null
}
class Token {
  constructor (name, priority) {
    this.name = name, this.priority = priority
  }
}
const nullToken = new Token('', -1)
const and = new Token(',', 1)
const or = new Token('/', 2)
const leftParen = new Token('(', NaN)
const rightParen = new Token(')', NaN)
const connectionTokens = {}
const isOperatorToken = t => t === and || t === or
for (const token of [ and, or, leftParen, rightParen ]) connectionTokens[token.name] = token

const normalizeNameMap = {
  dur: 'duration',
  duration: 'duration',
  time: 'duration',
  bpm: 'tempo',
  tempo: 'tempo',
  stop: 'pauses',
  pause: 'pauses',
  'stop-dur': 'pauses-dur',
  'pause-dur': 'pauses-dur',
  'stop-duration': 'pauses-dur',
  'pause-duration': 'pauses-dur',
  'stop-time': 'pauses-dur',
  'pause-time': 'pauses-dur',
}
const normalize = (name, sel) => {
  name = normalizeNameMap[name]
  if (!name) return null
  if ('$and' in sel || '$or' in sel) return {
    ...sel,
    ...('$and' in sel ? { $and: sel.$and.map(x => ({ [name]: x })) } : {}),
    ...('$or' in sel ? { $or: sel.$or.map(x => ({ [name]: x })) } : {}),
  }
  if (name === 'pauses') return { pauseCount: sel }
  if (name === 'pauses-dur') return { pauses: { $elemMatch: sel } }
  return { [name]: sel }
}

const parseExpr = expr => {
  const notMatch = expr.match(/^not?\s+(?<inner>.+)$/)
  if (notMatch) return { $not: parseExpr(notMatch.groups.inner) }
  let sel
  const inMatch = expr.match(/^(?<name>[^\s]+)\s+in\s+(?<a>\d+\.?\d*)\s*-\s*(?<b>\d+\.?\d*)$/)
  if (inMatch) sel = { $gte: Number(inMatch.groups.a), $lte: Number(inMatch.groups.b) }
  const aroundMatch = expr.match(/^(?<name>[^\s]+)\s+(?:around|about)\s+(?<a>\d+\.?\d*)$/)
  if (aroundMatch) sel = { $gte: Number(aroundMatch.groups.a) - 16 , $lte: Number(aroundMatch.groups.a) + 16 }
  const cmpMatch = expr.match(/^(?<name>[^\s]+)\s*(?<cmp>[<>]=?)\s*(?<a>\d+\.?\d*)$/)
  if (cmpMatch) sel = { [{ '>': '$gt', '<': '$lt', '>=': '$gte', '<=': '$lte' }[cmpMatch.groups.cmp]]: Number(cmpMatch.groups.a) }
  if (sel) {
    sel = normalize((inMatch || aroundMatch || cmpMatch).groups.name, sel)
    if (sel) return sel
  }
  return { $or: [ { name: { $regex: new RegExp(expr, 'i') } }, { mood: expr }, { genre: expr }, { tags: { $elemMatch: expr } } ] }
}

const parseTokens = tokens => {
  const stack = [], parenStack = []
  let lastOp = nullToken
  for (const token of tokens) {
    if (token === leftParen) {
      stack.push(token)
      parenStack.push(lastOp)
      lastOp = nullToken
    } else if (token === rightParen) {
      const i = stack.lastIndexOf(leftParen)
      const slice = stack.splice(i)
      slice.shift()
      stack.push(parseTokens(slice))
      lastOp = parenStack.pop()
      if (!lastOp) throw errorCode(new Error('Syntax Error'), 'ESYNTAX')
    } else if (isOperatorToken(token)) {
      if (token.priority >= lastOp.priority) {
        stack.push(token)
        lastOp = token
      } else {
        const lastSOp = [...stack].reverse().find(op => isOperatorToken(op) && token.priority >= op.priority)
        let i = stack.lastIndexOf(lastSOp)
        const slice = stack.splice(i + 1)
        stack.push(parseTokens(slice))
        stack.push(token)
        lastOp = token
      }
    } else stack.push(token)
  }
  if (parenStack.length !== 0) throw errorCode(new Error('Syntax Error'), 'ESYNTAX')
  const minPriority = Math.min(...stack.filter(t => isOperatorToken(t)).map(t => t.priority))
  if (lastOp.priority > minPriority) {
    const i = stack.findIndex(op => isOperatorToken(op) && op.priority > minPriority)
    const slice = stack.splice(i - 1)
    stack.push(parseTokens(slice))
  }
  if (stack.length === 1) return parseExpr(stack[0].name)
  const parsedStack = stack.filter(x => !isOperatorToken(x)).map(x => x instanceof Token ? parseExpr(x.name) : x)
  if (stack[1] === and) return { $and: parsedStack }
  if (stack[1] === or) return { $or: parsedStack }
  throw errorCode(new Error('Syntax Error'), 'ESYNTAX')
}

/**
 * Parse a query, it's slow...
 * @param {string} str query to parse
 * @example parseQuery('piano, dur in 80-100 / (duration in 10-20, guitar), tempo around 120, no pause > 10, stop <= 5, not time in 90 - 120')
 */
const parseQuery = exports.parseQuery = str => parseTokens(
  Array.from(str.matchAll(/(?<expr>[^,/()]+)|(?<conn>[,/()]|$)/g))
    .map(typeGroups([ 'expr', 'conn' ]))
    .filter(x => !!x && !!x.value)
    .map(x => x.type === 'conn' ? connectionTokens[x.value] : new Token(x.value, NaN))
)
