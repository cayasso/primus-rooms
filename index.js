/**
 * Module dependencies.
 */

var PrimusRooms = require('./lib');

/**
 * Exports modules.
 */

exports.server = function server (primus, options) {
  primus.$ = primus.$ || {};
  primus.$.PrimusRooms = PrimusRooms;
  PrimusRooms(primus, options);
};

exports.Adapter = PrimusRooms.Adapter;
exports.Rooms = PrimusRooms.Rooms;
exports.PrimusRooms = PrimusRooms;