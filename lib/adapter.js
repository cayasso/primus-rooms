/**
 * Code taken mainly from socket.io 1.0 adapter
 */

/**
 * Module exports.
 */

module.exports = Adapter;

/**
 * Memory adapter constructor.
 *
 * @param {Server} srv
 * @api public
 */

function Adapter(){
  this.rooms = {};
  this.sids = {};
}

/**
 * Adds a socket from a room.
 *
 * @param {String} socket id
 * @param {String} room name
 * @param {Function} callback
 * @api public
 */

Adapter.prototype.add = function(id, room, fn){
  this.sids[id] = this.sids[id] || {};
  this.sids[id][room] = true;
  this.rooms[room] = this.rooms[room] || {};
  this.rooms[room][id] = true;
  if (fn) process.nextTick(fn.bind(null, null));
};

/**
 * Get rooms socket is subscribed to.
 *
 * @param {String} socket id
 * @param {Function} fn callback
 * @api public
 */

Adapter.prototype.get = function (id, fn) {
  var adapter = this;
  if (fn) process.nextTick(function () {
    fn(null, adapter.sids[id] || null);
  });
};

/**
 * Removes a socket from a room.
 *
 * @param {String} socket id
 * @param {String} room name
 * @param {Function} callback
 * @api public
 */

Adapter.prototype.del = function(id, room, fn){
  this.sids[id] = this.sids[id] || {};
  this.rooms[room] = this.rooms[room] || {};
  delete this.sids[id][room];
  if (this.rooms[room]) {
    delete this.rooms[room][id];
    if (!Object.keys(this.rooms[room]).length) {
      delete this.rooms[room];
    }
  }
  if (fn) process.nextTick(fn.bind(null, null));
};

/**
 * Removes a socket from all rooms it's joined.
 *
 * @param {String} socket id
 * @api public
 */

Adapter.prototype.delAll = function(id){
  var room, rooms = this.sids[id];
  if (rooms) {
    for (room in rooms) {
      this.del(id, room);
    }
  }
  delete this.sids[id];
};

/**
 * Broadcasts a packet.
 *
 * Options:
 *  - `except` {Array} sids that should be excluded
 *  - `rooms` {Array} list of rooms to broadcast to
 *
 * @param {Object} data
 * @param {Object} opts
 * @param {Object} clients Connected clients
 * @api public
 */

Adapter.prototype.broadcast = function(data, opts, clients){
  var rooms = opts.rooms || [];
  var except = opts.except || [];
  var length = rooms.length;
  var ids = {};
  var socket;
  if (length) {
    for (var i = 0; i < length; i++) {
      var room = this.rooms[rooms[i]];
      if (!room) continue;
      for (var id in room) {
        if (ids[id] || ~except.indexOf(id)) continue;
        socket = clients[id];
        if (socket) {
          socket.write(data);
          ids[id] = true;
        }
      }
    }
  } else {
    for (var id in this.sids) {
      if (~except.indexOf(id)) continue;
      socket = clients[id];
      if (socket) socket.write(data);
    }
  }
};

/**
 * Get client ids connected to this room.
 *
 * @param {String} room
 * @param {Function} callback
 * @param {Array} clients
 * @api public
 */

Adapter.prototype.clients = function(room, fn){
  var clients = Object.keys(this.rooms[room] || {});
  if (fn) process.nextTick(function () {
    fn(null, clients);
  });
  return clients;
};
