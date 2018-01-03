'use strict'

const Store = require('./store')
const Network = require('./network')

module.exports = create

function create (ipfs, options) {
  return {
    store: (id) => Store(id, ipfs, options && options.dag),
    network: (id, log, onRemoteHead) => Network(id, ipfs, onRemoteHead, options),
    authenticate: (entry, parents) => {
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
    }
  }
}

function serialize (o) {
  return Buffer.from(JSON.stringify(o))
}
