'use strict'

const promisify = require('es6-promisify')

module.exports = createStore

function createStore (id, ipfs) {
  return new IPFSStore(id, ipfs)
}

class IPFSStore {
  constructor (id, ipfs) {
    this._headKey = id + '/HEAD'
    this._ipfs = ipfs
  }

  put (entry) {
    const [value, auth, parents] = entry
    const dagEntry = [value, auth, parents.map((parentId) => ({ '/': parentId }))]
    return this._ipfs.dag.put(dagEntry).then(cidToString)
  }

  get (id) {
    return this._ipfs.dag.get(id)
      .then(({value: [value, auth, parents]}) => [value, auth, parents.map((parent) => parent['/'])])
  }

  async setHead (head) {
    const store = await this._datastore()
    return store.put(this._headKey, encode(head))
  }

  async getHead () {
    const ds = await this._datastore()
    return ds.get(this._headKey).catch(notFound).then(decode)
  }

  _datastore () {
    return new Promise((resolve, reject) => {
      if (!this._store) {
        const ds = this._ipfs._repo.datastore
        if (!ds) {
          return this._ipfs.once('start', () => {
            resolve(this._datastore())
          })
        }
        this._store = {
          put: promisify(ds.put.bind(ds)),
          get: promisify(ds.get.bind(ds))
        }
      }
      resolve(this._store)
    })
  }
}

function cidToString (cid) {
  return cid.toBaseEncodedString()
}

function encode (str) {
  return Buffer.from(str)
}

function decode (buf) {
  if (buf) {
    return Buffer.from(buf).toString()
  }
}

function notFound (err) {
  if (!err.message.match(/not found/i)) {
    throw err
  }
}
