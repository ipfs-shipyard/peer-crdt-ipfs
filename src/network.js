'use strict'

const PubSubRoom = require('ipfs-pubsub-room')
const B58 = require('bs58')
const PLimit = require('p-limit')

const parent = require('./parent')

module.exports = createNetwork

function createNetwork (id, ipfs, onRemoteHead, options) {
  return new Network(id, ipfs, onRemoteHead, options)
}

const defaultOptions = {
  minBroadcastInterval: 1000,
  maxBroadcastInterval: 5000,
  totalNetworkBroadcastInterval: 500,
  dagOptions: {
    format: 'dag-cbor'
    // hashAlg: 'sha2-256'
  },
  maxAncestorsBroadcast: 10
}

class Network {
  constructor (id, ipfs, onRemoteHead, options) {
    this._id = id
    this._ipfs = ipfs
    this._onRemoteHead = onRemoteHead
    this._options = Object.assign({}, defaultOptions, options)
    this._options.dagOptions = Object.assign(
      {}, defaultOptions.dagOptions, options && options.dagOptions)
    this._peerCount = 0
    this._stopped = false

    this._onMessage = this._onMessage.bind(this)
    this._onPeerJoined = this._onPeerJoined.bind(this)
    this._onPeerLeft = this._onPeerLeft.bind(this)
    this._broadcastHead = this._broadcastHead.bind(this)

    this._serialize = PLimit(1)
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
    return this._ipfs.dag.get(id, this._options.dagOptions)
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
      if (this._processingRemoteHead === head) {
        return
      }
    } catch (err) {
      console.log('Error processing message:', err)
    }
    this._serialize(() => this._serializedOnMessage(message))
  }

  async _serializedOnMessage (message) {
    try {
      const msg = JSON.parse(Buffer.from(message.data))
      const head = msg[0]
      this._processingRemoteHead = head
      const parents = msg[1]
      let all = [head, ...parents]
      all = all.map(B58.decode)
      await this._ipfs._bitswap.getMany(all)
      this._processingRemoteHead = false
      this._onRemoteHead(head)
    } catch (err) {
      this._processingRemoteHead = false
      console.log('Error processing message:', err)
    }
  }

  _onPeerJoined () {
    this._peerCount++
    this._broadcastHead()
  }

  _onPeerLeft () {
    this._peerCount--
  }
}
