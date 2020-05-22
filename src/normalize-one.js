exports.normalizeOne = (data, maxLength) => {
  for (let i = 0; i < data.length; i++) {
    const subdata = data[i]
    const subLength = subdata.length
    subdata.length = maxLength
    if (subLength >= maxLength) continue
    for (let i = subLength; i < maxLength; i++) subdata[i] = 0
  }
  return data
}
