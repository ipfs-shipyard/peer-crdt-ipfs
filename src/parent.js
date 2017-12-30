'use strict'

const B58 = require('bs58')

exports.decode = function decode (parent) {
  if (typeof parent !== 'object') {
    throw new Error('parent should be an object')
  }
  const id = parent['/']
  if (!id) {
    throw new Error('parent should have / key with id')
  }

  return B58.encode(id)
}

exports.encode = function encode (parent) {
  if (typeof parent !== 'string') {
    throw new Error('parent should be a string')
  }

  return { '/': B58.decode(parent) }
}
