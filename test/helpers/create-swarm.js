'use strict'

const IPFS = require('ipfs')
const createRepo = require('./create-repo-node')
const PeerCrdtIpfs = require('../../')
const PeerCRDT = require('peer-crdt')
const each = require('async/each')

module.exports = createSwarm

async function createSwarm (count) {
  const nodes = []
  for (let i = 0; i < count; i++) {
    nodes.push(await createNode())
  }
  const ipfss = nodes.map((node) => node[2])
  await connectAll(ipfss)
  return nodes
}

function createNode () {
  return new Promise((resolve, reject) => {
    const repo = createRepo()

    const ipfs = new IPFS({
      repo: repo,
      EXPERIMENTAL: {
        pubsub: true
      },
      config: {
        Addresses: {
          Swarm: [
            '/ip4/127.0.0.1/tcp/0'
          ]
        }
      }
    })

    ipfs.on('error', reject)

    ipfs.once('ready', () => {
      ipfs.removeListener('error', reject)
      const peerCrdtIpfs = PeerCrdtIpfs(ipfs)
      resolve([PeerCRDT.defaults(peerCrdtIpfs), repo, ipfs])
    })
  })
}

function connectAll (nodes) {
  return new Promise(async (resolve, reject) => {
    const addresses = await Promise.all(nodes.map((node) => node.id().then((id) => id.addresses)))
    nodes.forEach((node, nodeIndex) => {
      let i = -1
      each(addresses, (address, cb) => {
        i++
        if (nodeIndex !== i) {
          node.swarm.connect(address[0], cb)
        } else {
          cb()
        }
      },
      (err) => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
  })
}
