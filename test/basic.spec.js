/* eslint-env mocha */
'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const cuid = require('cuid')
const IPFS = require('ipfs')
const PeerCRDT = require('peer-crdt')
const PeerCrdtIpfs = require('../')

const createRepo = require('./helpers/create-repo-node')

describe('basic', () => {
  let id = cuid()
  let repo
  let ipfs
  let peerCRDT
  let peerCrdtIpfs
  let crdt

  before(() => {
    repo = createRepo()
  })

  before(() => {
    ipfs = new IPFS({
      EXPERIMENTAL: {
        pubsub: true
      },
      repo,
      config: {
        Addresses: {
          Swarm: [
            '/ip4/127.0.0.1/tcp/0'
          ]
        }
      }
    })
  })

  after((done) => ipfs.stop(done))

  after((done) => setTimeout(done, 1900))

  after((done) => {
    repo.teardown(done)
  })

  it('can be created', () => {
    peerCrdtIpfs = PeerCrdtIpfs(ipfs)
  })

  it('can be applied to peer-crdt', () => {
    peerCRDT = PeerCRDT.defaults(peerCrdtIpfs)
    crdt = peerCRDT.create('rga', id)
  })

  it('CRDT network can be started', function () {
    this.timeout(10000)
    return crdt.network.start()
  })

  it('converges', (done) => {
    crdt.once('change', () => {
      expect(crdt.value()).to.deep.equal(['a'])
      done()
    })
    crdt.push('a')
  })

  it('mirrors embeds', function (done) {
    this.timeout(10000)
    crdt.once('change', (event) => {
      expect(event.type).to.equal('insert')
      const embedded = event.value
      embedded.on('change', () => {
        if (embedded.value().length === 2) {
          expect(embedded.value().sort()).to.deep.equal(['a', 'b'])
          done()
        }
      })
    })
    const embed = crdt.createForEmbed('rga')
    crdt.push(embed)
    embed.push('a')
    embed.push('b')
  })

  it('CRDT network can be stopped', () => crdt.network.stop())
})

process.on('unhandledRejection', (rej) => {
  console.log(rej)
})
