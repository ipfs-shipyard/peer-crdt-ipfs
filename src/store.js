'use strict'

const promisify = require('es6-promisify')
const parent = require('./parent')

module.exports = createStore

function createStore (id, ipfs) {
  return new IPFSStore(id, ipfs)
}

const defaultDagOptions = {
  format: 'dag-cbor'
  // hashAlg: 'sha2-256'
}

class IPFSStore {
  constructor (id, ipfs, dagOptions) {
    this._headKey = id + '/HEAD'
    this._ipfs = ipfs
    this._dagOptions = Object.assign({}, defaultDagOptions, dagOptions)
  }

  put (entry) {
    const [value, auth, parents] = entry
    const dagEntry = [value, auth, parents.map(parent.encode)]
    return this._ipfs.dag.put(dagEntry, this._dagOptions).then(cidToString)
  }

  get (id) {
    if (typeof id !== 'string') {
      throw new Error('need string as id' + id)
    }
    return this._ipfs.dag.get(id, this._dagOptions)
      .then(({value: [value, auth, parents]}) => [value, auth, parents.map(parent.decode)])
  }

  async setHead (head) {
    const store = await this._datastore()
    return store.put(this._headKey, encode(head))
  }

  async getHead () {
    const store = await this._datastore()
    return store.get(this._headKey).catch(notFound).then(decode)
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
