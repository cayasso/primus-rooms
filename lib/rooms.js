'use strict';

/**
 * Module dependencies.
 */

var debug = require('debug')('primus-rooms:rooms')
  , RoomsError = require('./error')
  , Batch = require('batch')
  , isArray = Array.isArray
  , noop = function () {};

/**
 * Reserved events.
 */

var events = [
  'joinroom',
  'leaveallrooms',
  'leaveroom',
  'roomserror'
];

/**
 * Export this method.
 */

module.exports = Rooms;

/**
 * Rooms constructor.
 *
 * @param {Spark|Primus} ctx
 * @param {Adapter} adapter
 * @api public
 */

function Rooms(context, adapter) {
  this.ctx = context;
  this.id = this.ctx.id;

  // save a reference to the Primus instance as it may have
  // already been removed from the spark when we try to access it
  this.primus = this.ctx.primus || this.ctx;
  this.adapter = adapter;
  this.reset().bind();
}

/**
 * Bind room events.
 *
 * @return {Rooms} this
 * @api private
 */

Rooms.prototype.bind = function bind() {
  if (this.id) {
    this.onend = this.onend.bind(this);
    this.ctx.on('end', this.onend);
  }
  return this;
};

/**
 * Targets a room when broadcasting.
 *
 * @param {Number|String|Array} room
 * @return {Spark}
 * @api public
 */

Rooms.prototype.room =
Rooms.prototype['in'] = function room(room) {
  this.__rooms = room;
  return this;
};

/**
 * Set exception ids when brodcasting.
 *
 * @param {String|Array} ids
 * @return {Rooms} this;
 * @api public
 */

Rooms.prototype.except = function except(ids) {
  this.__except = ids;
  return this;
};

/**
 * Joins a room.
 *
 * @param {Number|String|Array} room
 * @param {Function} fn callback
 * @return {Rooms} this
 * @api public
 */

Rooms.prototype.join = function join(room, fn) {
  return this.exec('_join', room, fn);
};

/**
 * Joins a room.
 *
 * @param {String} room
 * @param {Function} fn
 * @return {Rooms} this
 * @api private
 */

Rooms.prototype._join = function _join(room, fn) {
  var rm = this;
  debug('joining room %s', room);
  this.adapter.add(this.id, room, function set(err, res) {
    if (err) return fn(new RoomsError(err, rm.ctx));
    rm.emits('joinroom', room);
    fn(null, res);
  });
  return this;
};

/**
 * Leaves a room.
 *
 * @param {Number|String|Array} room
 * @param {Function} fn
 * @return {Rooms} this
 * @api public
 */

Rooms.prototype.leave = function leave(room, fn) {
  return this.exec('_leave', room, fn);
};

/**
 * Leaves a room.
 *
 * @param {String} room
 * @param {Function} fn
 * @return {Rooms} this
 * @api private
 */

Rooms.prototype._leave = function _leave(room, fn) {
  var rm = this;
  debug('leaving room %s', room);
  this.adapter.del(this.id, room, function del(err, res) {
    if (err) return fn(new RoomsError(err, rm.ctx));
    rm.emits('leaveroom', room);
    fn(null, res);
  });
  return this;
};

/**
 * Leave all rooms that socket is joined to.
 *
 * @param {Function} fn
 * @return {Rooms} this
 * @api public
 */

Rooms.prototype.leaveAll = function leaveAll(fn) {
  var rm = this;
  fn = fn || noop;
  this.rooms(function getRooms(err, rooms) {
    if (err) return fn(new RoomsError(err, rm.ctx));
    rm.adapter.del(rm.id, null, function del(err, res) {
      if (err) return fn(new RoomsError(err, rm.ctx));
      rm.emits('leaveallrooms', rooms);
      fn(null, res);
    });
  });
  return this;
};

/**
 * Get all rooms for this client or if no argument
 * passed then all active rooms on server.
 *
 * @param {Function} fn
 * @return {Array} array of rooms
 * @api public
 */

Rooms.prototype.rooms = function rooms(fn) {
  fn = fn || noop;
  return this.adapter.get(this.id || null, fn);
};

/**
 * Get connected clients.
 *
 * @param {Number|String} room
 * @param {Function} optional, callback
 * @return {Rooms} this
 * @api public
 */

Rooms.prototype.clients = function clients(room, fn) {
  return this.exec('_clients', room, fn);
};

/**
 * Get connected clients.
 *
 * @param {String} room
 * @param {Function} fn
 * @return {Rooms} this
 * @api public
 */

Rooms.prototype._clients = function _clients(room, fn) {
  return this.adapter.clients(room, fn);
};

/**
 * Empty a room.
 *
 * @param {Spark} spark
 * @param {Number|String|Array} room
 * @param {Array} sparks
 * @param {Function} fn, callback
 * @return {Primus}
 * @api public
 */

Rooms.prototype.empty = function empty(room, fn) {

  var rooms;

  if ('function' === typeof room) {
    fn = room;
    room = null;
  }

  fn = fn || noop;
  
  // set room if its not empty
  if (room) this.__rooms = room;

  // get room
  rooms = this.__rooms;

  // reset rooms and expect values.
  this.reset();

  // if no rooms we just clear all.
  if (!rooms.length) this.adapter.clear(fn);

  // if rooms we empty just that room.
  else this.adapter.empty(rooms, fn);
  return this;
};

/**
 * Check if a specific rooms is empty.
 *
 * @param {Number|String} room
 * @param {Function} fn
 * @return {Rooms} this
 * @api public
 */

Rooms.prototype.isRoomEmpty = function isRoomEmpty(room, fn) {
  room += '';
  return this.adapter.isEmpty(room, fn);
};

/**
 * Send message with primus-emitter send.
 *
 * @param {String} ev
 * @param {Mixed} data
 * @param {Function} fn
 * @returns {Spark|Primus}
 * @api public
 */

Rooms.prototype.send = function send(ev, data, fn) {
  this.broadcast(arguments, 'send');
  return this.ctx;
};

/**
 * Broadcast a message to all clients in a room or rooms.
 *
 * @param {Mixed} data The data that needs to be written.
 * @return {Spark|Primus}
 * @api public
 */

Rooms.prototype.write = function write(data) {
  this.broadcast([data], 'write');
  return this.ctx;
};

/**
 * Broadcast a message.
 *
 * @param {Spark} ctx
 * @param {Mixed} data The data that needs to be written.
 * @return {Boolean}.
 * @api public
 */

Rooms.prototype.broadcast = function broadcast(data, method) {

  if ('function' === typeof data[data.length - 1]) {
    throw new RoomsError('Callbacks are not supported when broadcasting');
  }

  if (this.id) {

    // we need to make sure this is a valid spark
    // and not a destroyed one, destroyed spark are
    // no longer part of the connection list.
    var conn = this.connections[this.id];

    // if this is not a valid ctx we just ignore the 
    // write request
    if (!conn) return this.reset();

  }

  var options = { rooms: this.__rooms, except: this.__except, method: method };
  this.adapter.broadcast(data, options, this.connections);

  return this.reset();
};

/**
 * Emit custom events on ctx and primus.
 *
 * @param {String} ev
 * @param {Mixed} data
 * @return {Rooms} this
 * @api private
 */

Rooms.prototype.emits = function (ev, data) {
  if (this.id) {
    this.ctx.emit(ev, data);
    this.primus.emit(ev, data, this.ctx);
  }
  return this;
};

/**
 * Reset rooms and except properties.
 *
 * @return {Rooms} this
 * @api private
 */

Rooms.prototype.reset = function reset() {
  this.__rooms__ = [];
  this.__except__ = [];
  return this;
};

/**
 * Called upon ctx end event.
 *
 * @return {Rooms} this
 * @api private
 */

Rooms.prototype.onend = function onend() {
  return this.reset().leaveAll();
};

/**
 * Execute a specific method were a 
 * string or array is provided.
 *
 * @param {String} method method to execute
 * @param {Number|String|Array} room
 * @param {Function} fn, callback
 * @return {Rooms} this
 * @api private
 */

Rooms.prototype.exec = function exec(method, room, fn) {

  if ('function' === typeof room) {
    fn = room;
    room = null;
  }

  if (room) this.__rooms = room;

  var r
    , re
    , i = 0
    , res = []
    , result = []
    , rooms = this.__rooms
    , len = rooms.length;
  
  fn = fn || noop;

  this.reset();
  
  for (; i < len; ++i) {
    if (1 === len) return this[method](rooms[i], fn);
    r = rooms[i];
    re = {};
    re[r] = this[method](r, cb(r, i));
    res.push(re);
  }

  /**
   * Handle response.
   *
   * @param {Object} room
   * @param {Object} limit
   * @api private
   */

  function cb(room, limit) {
    return function callback(err, res) {
      if (err) return fn(err, null);
      re = {};
      re[room] = res;
      result.push(re);
      if (len-1 === limit) {
        fn(null, result);
      }
    };
  }

  return res;
};

/**
 * Lazy load connections.
 */

Object.defineProperty(Rooms.prototype, 'connections', {
  get: function get() {
    return this.primus.connections;
  }
});

/**
 * Setter getter for __expect and __rooms properties, this reduce
 * the redundant code of getting these values.
 */

['__except', '__rooms'].forEach(function each(fn) {
  var ns = fn + '__';
  Object.defineProperty(Rooms.prototype, fn, {
  
    get: function get() {
      return this[ns];
    },

    set: function set(value) {
      var values = 'string' === typeof value
        ? value.split(' ')
        : 'number' === typeof value
          ? [value]
          : value;
      if (isArray(values)) {
        values.forEach(function current(val) {
          val += '';
          if (!~this[ns].indexOf(val)) {
            this[ns].push(val);
          }
        }, this);
      }
    }
  });
});

/**
 * Execute spark room batch.
 *
 * @param {String} method
 * @param {Spark} spark
 * @param {Number|String|Array} room
 * @param {Function} fn
 * @return {Rooms} this
 * @api public
 */

Rooms.prototype.batch = function batch(method, spark, room, fn) {
  var rm = this
    , batch = new Batch()
    , sparks = isArray(spark) ? spark : [spark];
  sparks.forEach(function each(spark){
    var id = 'string' === typeof spark ? spark : spark.id;
    if (spark = rm.connections[id]) {
      batch.push(function push(done) {
        spark[method](room, done);
      });
    }
  });
  batch.end(fn);
  return this;
};

/**
 * Expose events.
 */

Rooms.events = events;
