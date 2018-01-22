'use strict'

const Store = require('./store')
const Network = require('./network')
const Auth = require('./auth')

module.exports = (ipfs, options) => {
  const auth = Auth(ipfs)
  return Object.assign(
    {
      store: (id) => Store(id, ipfs, options && options.dag),
      network: (id, log, onRemoteHead) => Network(id, ipfs, onRemoteHead, options)
    },
    auth)
}
