/* eslint-env mocha */
'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const each = require('async/each')
const cuid = require('cuid')

const createSwarm = require('./helpers/create-swarm')

describe('swarm', () => {
  let networkId
  let nodes
  let repos
  let ipfss

  before(() => {
    networkId = cuid()
  })

  before(async function () {
    this.timeout(20000)
    const swarm = await createSwarm(3)
    nodes = swarm.map((s) => s[0].create('rga', networkId))
    repos = swarm.map((s) => s[1])
    ipfss = swarm.map((s) => s[2])
  })

  before(function () {
    return Promise.all(nodes.map((node) => node.network.start()))
  })

  after(() => {
    return Promise.all(nodes.map((node) => node.network.stop()))
  })

  after((done) => {
    each(ipfss, (ipfs, cb) => ipfs.stop(cb), done)
  })

  after((done) => {
    each(repos, (repo, cb) => repo.teardown(cb), done)
  })

  it('CRDT converges', function (done) {
    this.timeout(3000)
    nodes.forEach((node, index) => node.push(index))

    setTimeout(() => {
      let result
      nodes.forEach((node) => {
        const r = node.value()
        if (!result) {
          result = r
        } else {
          expect(r).to.deep.equal(r)
        }
      })
      expect(result.sort()).to.deep.equal([0, 1, 2])
      done()
    }, 2000)
  })
})

process.on('unhandledRejection', (rej) => {
  console.log(rej)
})
