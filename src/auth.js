'use strict'

module.exports = (ipfs) => ({
  sign: (entry, parents) => {
    return new Promise((resolve, reject) => {
      ipfs._peerInfo.id._privKey.sign(serialize([entry, parents]), (err, signature) => {
        if (err) {
          return reject(err)
        }
        resolve([
          ipfs._peerInfo.id.id,
          signature
        ])
      })
    })
  },
  authenticate: (entry, parents, signature) => {
    // console.log('authenticate:', entry, parents, signature)
    return true
    // return new Promise((resolve, reject) => {
    //   const payload = serialize([entry, parents])
    //   ipfs._peerInfo.id._pubKey.verify(payload, signature, (err, authentic) => {
    //     if (err) {
    //       return reject(err)
    //     }
    //     resolve(authentic)
    //   })
    // })
  }
})

function serialize (o) {
  return Buffer.from(JSON.stringify(o))
}
