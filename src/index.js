'use strict'

const Store = require('./store')
const Network = require('./network')

module.exports = create

function create (ipfs) {
  return {
    store: (id) => Store(id, ipfs),
    network: (id, log, onRemoteHead) => Network(id, ipfs, onRemoteHead),
    authenticate: (entry, parents) => {
      return new Promise((resolve, reject) => {
        ipfs._peerInfo.id._privKey.sign(serialize([entry, parents]), (err, signature) => {
          if (err) {
            return reject(err)
          }
          resolve([
            ipfs._peerInfo.id.toB58String(),
            signature.toString('hex')
          ])
        })
      })
    }
  }
}

function serialize (o) {
  return Buffer.from(JSON.stringify(o))
}
