'use strict';

/**
 * Module dependencies.
 */

var rooms = require('./lib');

/**
 * Initialize the plugin.
 *
 * @param {Primus} primus - The `Primus` instance
 * @param {Object} options - The options
 * @api public
 */

function PrimusRooms(primus, options) {
  primus.$ = primus.$ || {};
  primus.$.rooms = {};
  primus.$.rooms.rooms = rooms;
  primus.$.rooms.Adapter = rooms.Adapter;
  primus.$.rooms.Rooms = rooms.Rooms;
  rooms(primus, options);
}

/**
 * Expose the server function.
 */

exports.server = PrimusRooms;

/**
 * Expose the `Adapter` constructor.
 */

exports.Adapter = rooms.Adapter;

/**
 * Expose the `Rooms` constructor.
 */

exports.Rooms = rooms.Rooms;
