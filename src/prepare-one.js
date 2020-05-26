exports.prepareOne = musicData => {
  const { onsetFrames, beats, chroma, mfcc, harmonic, percussive, viterbi } = musicData
  const { mfcc: hmfcc, chroma: hchroma } = harmonic
  const { mfcc: pmfcc, chroma: pchroma } = percussive
  const length = chroma[0].length
  musicData.duration = length * 512 / (musicData.sr || 22050) // hop length 512 with sampling rate at 22050
  const viterbiEdges = [ [], [] ]
  for (let i = 0; i < viterbi.length - 1; i++) if (viterbi[i] !== viterbi[i + 1]) viterbiEdges[viterbi[i]].push(i)
  musicData.pauses = viterbiEdges[1]
    .map((_, i) => viterbiEdges[0][i] - viterbiEdges[1][i - 1] || 0)
    .filter((x, i) => i && x > 21)
    .map(x => x * 512 / musicData.sr)

  const normalizeFrames = arr => {
    const arrLength = arr.length
    const newArray = Array(arrLength)
    for (let i = 0; i < arrLength; i++) newArray[i] = arr[i] / length
    return newArray
  }
  const normalizeChroma = arr => {
    const interval = 32
    const arrLength = Math.floor(arr.length / interval)
    const newArray = Array(arrLength)
    for (let i = 0; i < arrLength; i++) newArray[i] = arr[i * interval]
    return newArray
  }
  const data = Array(98)
  data[0] = normalizeFrames(onsetFrames)
  data[1] = normalizeFrames(beats)
  for (let i = 0; i < 12; i++) data[i + 2] = normalizeChroma(chroma[i])
  for (let i = 0; i < 12; i++) data[i + 14] = normalizeChroma(hchroma[i])
  for (let i = 0; i < 12; i++) data[i + 26] = normalizeChroma(pchroma[i])
  for (let i = 0; i < 20; i++) data[i + 38] = normalizeChroma(mfcc[i])
  for (let i = 0; i < 20; i++) data[i + 58] = normalizeChroma(hmfcc[i])
  for (let i = 0; i < 20; i++) data[i + 78] = normalizeChroma(pmfcc[i])
  return data
}
