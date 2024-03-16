'use strict';

/**
 * Module dependencies.
 */

var debug = require('debug')('primus-rooms:rooms')
  , parallel = require('async/parallel')
  , RoomsError = require('./error');

/**
 * Reserved events.
 */

var events = [
  'joinroom',
  'leaveallrooms',
  'leaveroom',
  'roomserror'
];

function noop() {}

/**
 * Expose the `Rooms` constructor.
 */

module.exports = Rooms;

/**
 * `Rooms` constructor.
 *
 * @param {Primus|Spark} ctx
 * @param {Adapter} adapter
 * @return {Rooms} `Rooms` instance
 * @api public
 */

function Rooms(context, adapter) {
  if (!(this instanceof Rooms)) return new Rooms(context, adapter);

  this.ctx = context;
  this.id = this.ctx.id;
  this.ctx._rooms = this;

  // Save a reference to the Primus instance as it may have
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
  if (this.id) this.ctx.once('end', this.onend.bind(this));
  return this;
};

/**
 * Set rooms when broadcasting.
 *
 * @param {Number|String|Array<Number|String>} room
 * @return {Rooms} this
 * @api public
 */

Rooms.prototype.room =
Rooms.prototype.in = function target(room) {
  this.__rooms = room;
  return this;
};

/**
 * Add a message transformer for altering data before broadcasting.
 *
 * @param {Function} fn
 * @returns {Rooms}
 * @api public
 */

Rooms.prototype.transform = function transform(fn) {
  this.__transformer = fn;
  return this;
};

/**
 * Set exception ids when brodcasting.
 *
 * @param {String|String[]} ids
 * @return {Rooms} this
 * @api public
 */

Rooms.prototype.except = function except(ids) {
  this.__except = ids;
  return this;
};

/**
 * Join a room.
 *
 * @param {Number|String|Array<Number|String>} room
 * @param {Function} [fn]
 * @return {Rooms} this
 * @api public
 */

Rooms.prototype.join = function join(room, fn) {
  if (this.primus.spark(this.id)) return this.exec('_join', room, fn);
  var err = new RoomsError('Spark is closed', this.ctx);
  if (fn) return setImmediate(fn, err), this;
  throw err;
};

/**
 * Join a room.
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
 * Leave a room.
 *
 * @param {Number|String|Array<Number|String>} room
 * @param {Function} [fn]
 * @return {Rooms} this
 * @api public
 */

Rooms.prototype.leave = function leave(room, fn) {
  return this.exec('_leave', room, fn);
};

/**
 * Leave a room.
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
 * Leave all rooms that client is joined to.
 *
 * @param {Function} [fn]
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
 * Get all rooms that client is joined to or all active rooms on the server.
 *
 * @param {Function} [fn]
 * @return {String[]}
 * @api public
 */

Rooms.prototype.rooms = function rooms(fn) {
  fn = fn || noop;
  return this.adapter.get(this.id || null, fn);
};

/**
 * Get connected clients.
 *
 * @param {Number|String|Array<Number|String>} room
 * @param {Function} [fn]
 * @return {Rooms|String[]}
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
 * @return {String[]}
 * @api private
 */

Rooms.prototype._clients = function _clients(room, fn) {
  return this.adapter.clients(room, fn);
};

/**
 * Empty a room.
 *
 * @param {Number|String|Array<Number|String>} [room]
 * @param {Function} [fn]
 * @return {Rooms} this
 * @api public
 */

Rooms.prototype.empty = function empty(room, fn) {
  if ('function' === typeof room) {
    fn = room;
    room = null;
  }

  fn = fn || noop;

  // Set room if its not empty
  if (room) this.__rooms = room;

  // Get room
  var rooms = this.__rooms;

  // Reset rooms and except values
  this.reset();

  // Empty the room or clear everything if no room is specified
  if (!rooms.length) this.adapter.clear(fn);
  else this.adapter.empty(rooms, fn);
  return this;
};

/**
 * Check if a specific room is empty.
 *
 * @param {Number|String} room
 * @param {Function} [fn]
 * @return {Boolean}
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
 * @param {*} data
 * @param {Function} [fn]
 * @returns {Primus|Spark}
 * @api public
 */

Rooms.prototype.send = function send(ev, data, fn) {
  var args = Array.prototype.slice.call(arguments);
  this.broadcast(args, 'send');
  return this.ctx;
};

/**
 * Broadcast a message to all clients in a room or rooms.
 *
 * @param {*} data
 * @return {Primus|Spark}
 * @api public
 */

Rooms.prototype.write = function write(data) {
  this.broadcast([data], 'write');
  return this.ctx;
};

/**
 * Broadcast a message.
 *
 * @param {Array} data
 * @return {Rooms} this
 * @api private
 */

Rooms.prototype.broadcast = function broadcast(data, method) {
  if ('function' === typeof data[data.length - 1]) {
    throw new RoomsError('Callbacks are not supported when broadcasting');
  }

  if (this.id) {
    // Ignore the broadcast request if the spark is closed
    if (!this.primus.spark(this.id)) return this.reset();
  }

  var options = {
    except: this.__except,
    method: method,
    rooms: this.__rooms,
    transformer: this.__transformer
  };

  this.adapter.broadcast(data, options, this.connections);
  return this.reset();
};

/**
 * Emit custom events on the spark and primus.
 *
 * @param {String} ev
 * @param {*} data
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
  this.__transformer = null;
  return this;
};

/**
 * Clean everything when the `end` event is fired on the spark.
 *
 * @return {Rooms} this
 * @api private
 */

Rooms.prototype.onend = function onend() {
  return this.reset().leaveAll();
};

/**
 * Execute a specific method the required number of times.
 *
 * @param {String} method
 * @param {Number|String|Array<Number|String>} [room]
 * @param {Function} [fn]
 * @return {Rooms|String[]}
 * @api private
 */

Rooms.prototype.exec = function exec(method, room, fn) {
  if ('function' === typeof room) {
    fn = room;
    room = null;
  }

  fn = fn || noop;
  if (room) this.__rooms = room;

  var rooms = this.__rooms
    , tasks = {}
    , rm = this;

  this.reset();

  if (1 === rooms.length) return this[method](rooms[0], fn);

  rooms.forEach(function each(room) {
    tasks[room] = function task(done) {
      rm[method](room, done);
    };
  });

  parallel(tasks, fn);
  return this;
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
 * Setter and getter for __expect and __rooms properties, this reduce
 * the redundant code needed to handle these values.
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
      if (Array.isArray(values)) {
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
 * Execute a batch of jobs.
 *
 * @param {String} method
 * @param {Spark|String|Array<Spark|String>} spark
 * @param {Number|String|Array<Number|String>} room
 * @param {Function} [fn]
 * @return {Rooms} this
 * @api private
 */

Rooms.prototype.batch = function batch(method, spark, room, fn) {
  var sparks = Array.isArray(spark) ? spark : [spark]
    , tasks = [];

  fn = fn || noop;

  sparks.forEach(function each(spark) {
    if ('string' === typeof spark) spark = this.primus.spark(spark);
    tasks.push(function task(done) {
      spark[method](room, done);
    });
  }, this);

  parallel(tasks, fn);
  return this;
};

/**
 * Expose the reserved events.
 */

Rooms.events = events;
