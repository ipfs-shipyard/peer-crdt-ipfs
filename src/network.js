'use strict'

const PubSubRoom = require('ipfs-pubsub-room')

module.exports = createNetwork

function createNetwork (id, ipfs, onRemoteHead, options) {
  return new Network(id, ipfs, onRemoteHead, options)
}

const defaultOptions = {
  minBroadcastInterval: 200,
  maxBroadcastInterval: 5000,
  totalNetworkBroadcastInterval: 500
}

class Network {
  constructor (id, ipfs, onRemoteHead, options) {
    this._id = id
    this._ipfs = ipfs
    this._onRemoteHead = onRemoteHead
    this._options = Object.assign({}, defaultOptions, options)
    this._peerCount = 0

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

      if (this._ipfs.isOnline()) {
        await getIpfsId()
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

  _broadcastHead () {
    if (this._timeout) {
      clearTimeout(this._timeout)
      this._timeout = null
    }
    this._timeout = setTimeout(this._broadcastHead, this._broadcastTimeoutValue())

    if (this._head) {
      this._room.broadcast(this._head)
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
    return this._ipfs.dag.get(id)
      .then(({value: [value, auth, parents]}) => [value, auth, parents.map((parent) => parent['/'])])
  }

  async stop () {
    if (this._timeout) {
      clearTimeout(this._timeout)
      this._timeout = null
    }
    this._room.removeListener('message', this._onMessage)
    this._room.removeListener('peer joined', this._onPeerJoined)
    this._room.removeListener('peer left', this._onPeerLeft)
  }

  _onMessage (message) {
    if (message.from !== this._peerId) {
      this._onRemoteHead(Buffer.from(message.data).toString())
    }
  }

  _onPeerJoined () {
    this._peerCount++
  }

  _onPeerLeft () {
    this._peerCount--
  }
}
