'use strict'

const PubSubRoom = require('ipfs-pubsub-room')
const B58 = require('bs58')
const debounce = require('lodash.debounce')

const parent = require('./parent')

module.exports = createNetwork

function createNetwork (id, ipfs, onRemoteHead, options) {
  return new Network(id, ipfs, onRemoteHead, options)
}

const defaultOptions = {
  minBroadcastInterval: 1000,
  maxBroadcastInterval: 5000,
  totalNetworkBroadcastInterval: 1000,
  dag: {
    format: 'dag-cbor'
    // hashAlg: 'sha2-256'
  },
  maxAncestorsBroadcast: 10,
  debounceSetHeadMS: 500
}

let ref = 0

class Network {
  constructor (id, ipfs, onRemoteHead, options) {
    this._ref = ++ref
    this._id = id
    this._ipfs = ipfs
    this._onRemoteHead = onRemoteHead
    this._options = Object.assign({}, defaultOptions, options)
    this._options.dag = Object.assign(
      {}, defaultOptions.dag, options && options.dag)

    this._peerCount = 0
    this._peerHeads = new Map()
    this._stopped = false

    this.setHead = debounce(this.setHead.bind(this), this._options.debounceSetHeadMS)

    this._onMessage = this._onMessage.bind(this)
    this._onPeerJoined = this._onPeerJoined.bind(this)
    this._onPeerLeft = this._onPeerLeft.bind(this)
    this._broadcastHead = this._broadcastHead.bind(this)
  }

  async start () {
    return new Promise(async (resolve, reject) => {
      const getIpfsId = async () => {
        const peerInfo = await this._ipfs.id()
        this._peerId = peerInfo.id
      }

      if (this._stopped) {
        return
      }

      if (this._ipfs.isOnline()) {
        await getIpfsId()
        this._startPubSubRoom()
        return resolve()
      }
      this._ipfs.on('error', reject)
      this._ipfs.once('ready', async () => {
        this._ipfs.removeListener('error', reject)
        await getIpfsId()
        this._startPubSubRoom()
        resolve()
      })
    })
  }

  _startPubSubRoom () {
    this._room = PubSubRoom(this._ipfs, this._id)
    this._room.on('message', this._onMessage)
    this._room.on('peer joined', this._onPeerJoined)
    this._room.on('peer left', this._onPeerLeft)
  }

  setHead (head) {
    console.log('HEAD:', head)
    this._head = head
    this._broadcastHead()
  }

  async _broadcastHead () {
    if (this._timeout) {
      clearTimeout(this._timeout)
      this._timeout = null
    }

    if (!this._room) {
      return
    }

    if (!this._head) {
      return
    }

    const ancestors = []
    let resolving = false
    let broadcasted = false

    const broadcast = () => {
      if (!broadcasted && !resolving && !this._stopped) {
        this._timeout = setTimeout(this._broadcastHead, this._broadcastTimeoutValue())
        broadcasted = true
        this._broadcastHeadAndAncestors(this._head, ancestors)
      }
    }

    const resolveAncestryAndBroadcast = async (entryId) => {
      if (this._stopped) {
        return
      }
      resolving = true
      const entry = await this.get(entryId)
      resolving = false
      if (entry) {
        const parents = entry[2]
        if (parents && parents.length) {
          parents.forEach((parent) => ancestors.push(parent))
        } else {
          return broadcast()
        }
        if (ancestors.length < this._options.maxAncestorsBroadcast) {
          await Promise.all(parents.map((parent) => resolveAncestryAndBroadcast(parent)))
        } else {
          broadcast()
        }
      } else {
        broadcast()
      }
    }

    await resolveAncestryAndBroadcast(this._head)
  }

  _broadcastHeadAndAncestors (head, ancestors) {
    if (!this._room) {
      return
    }
    const msg = JSON.stringify([this._head, ancestors])
    try {
      this._room.broadcast(msg)
    } catch (err) {
      console.log('Error caught while broadcasting:', err)
    }
  }

  _broadcastTimeoutValue () {
    return Math.max(
      this._options.minBroadcastInterval,
      Math.min(
        this._peerCount * this._options.totalNetworkBroadcastInterval,
        this._options.maxBroadcastInterval))
  }

  get (id) {
    return this._ipfs.dag.get(id, this._options.dag)
      .then(({value: [value, auth, parents]}) => [value, auth, parents.map(parent.decode)])
  }

  async stop () {
    if (this._stopped) {
      return
    }

    this._stopped = true
    if (this._timeout) {
      clearTimeout(this._timeout)
      this._timeout = null
    }
    if (this._room) {
      this._room.leave()
      this._room.removeListener('message', this._onMessage)
      this._room.removeListener('peer joined', this._onPeerJoined)
      this._room.removeListener('peer left', this._onPeerLeft)
      this._room = null
    }
  }

  _onMessage (message) {
    try {
      const msg = JSON.parse(Buffer.from(message.data))
      const head = msg[0]
      const peer = message.from
      const currentHead = this._peerHeads.get(peer)
      if (currentHead !== head) {
        this._peerHeads.set(peer, head)
        this._onNewPeerHead(peer, msg)
      }
    } catch (err) {
      console.log('Error processing message:', err)
    }
  }

  async _onNewPeerHead (peer, msg) {
    if (this._stopped) {
      return
    }
    try {
      const head = msg[0]
      const parents = msg[1]
      const allHashes = [head, ...parents].map(B58.decode).map(Buffer.from.bind(Buffer))

      const start = Date.now()
      console.log('getting many', allHashes)
      await this._ipfs._bitswap.getMany(allHashes)
      console.log('getMany took', Date.now() - start)
      if (this._stopped) {
        return
      }
      await this._onRemoteHead(head)
    } catch (err) {
      console.log('Error processing message:', err)
    }
  }

  _onPeerJoined () {
    this._peerCount++
    this._broadcastHead()
  }

  _onPeerLeft (peer) {
    this._peerHeads.delete(peer)
    this._peerCount--
  }
}
