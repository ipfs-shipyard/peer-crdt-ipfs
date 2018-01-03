# peer-crdt-ipfs

IPFS network and storage adapter for [peer-crdt](https://github.com/ipfs-shipyard/peer-crdt#readme).

# Install

```bash
$ npm install ipfs peer-crdt peer-crdt-ipfs
```

# Setup

```js
const IPFS = require('ipfs')
const PeerCRDT = require('peer-crdt')
const PeerCrdtIpfs = require('peer-crdt-ipfs')

// Create an IPFS node
ipfs = new IPFS({
  EXPERIMENTAL: {
    pubsub: true
  }
})

// Create a peer-crdt-ifps config object:
const peerCrdtIpfs = PeerCrdtIpfs(ipfs, options)

// Use it to configure peer-crdt
const CRDT = PeerCRDT.defaults(peerCrdtIpfs)

// Create and use a CRDT at will
const crdt = CRDT.create(type, id)
// ...
```

[peer-crdt API docs are here](https://github.com/ipfs-shipyard/peer-crdt#readme)

## Options

The constructor exposed in `peer-crdt-ipfs` accepts, as the second argument, an object with the following options (defaults in parenthesis):

* `minBroadcastInterval` (1000)
* `maxBroadcastInterval` (5000)
* `totalNetworkBroadcastInterval` (1000)
* `dag` - object with:
  * `format` ('dag-cbor')
  * `hashAlg` ('sha2-256')
  }
* `maxAncestorsBroadcast` (10)
* `debounceSetHeadMS` (500)


# License

MIT
