/**
 * Module dependencies.
 */

var debug = require('debug')('primus-rooms:rooms')
  , Adapter = require('./adapter')
  , isArray = require('util').isArray
  , noop = function () {};

/**
 * Export this method.
 */

module.exports = Rooms;

/**
 * Rooms constructor.
 *
 * @param {primus.Spark} spark
 * @param {Object} adapter
 * @api public
 */

function Rooms(adapter) {
  if (!(this instanceof Rooms)) return new Rooms(adapter);
  this.adapter(adapter || new Adapter());
}

/**
 * Sets the adapter for rooms.
 *
 * @param {Adapter} adapter
 * @return {Rooms|Adapter} self when setting or value when getting
 * @api public
 */

Rooms.prototype.adapter = function (adapter) {
  if (!arguments.length) return this._adapter;
  if ('object' !== typeof adapter) throw new Error('Adapter should be an object');
  this._adapter = adapter;
  return this;
};

/**
 * Broadcast a message.
 *
 * @param {Mixed} data The data that needs to be written.
 * @param {Object} sparks Connected sparks.
 * @returns {Boolean}.
 * @api public
 */

Rooms.prototype.broadcast = function (spark, data, clients, except) {
  var rooms = spark._rms;
  if (!(rooms && rooms.length)) return false;
  var options = { rooms: rooms, except: except };
  this._adapter.broadcast(data, options, clients);
  delete spark._rms;
  return true;
};

/**
 * Get connected clients.
 *
 * @param {String} room
 * @param {Function} optional, callback
 * @return {Rooms} self
 * @api public
 */

Rooms.prototype.clients = function (spark, room, fn) {
  
  fn = fn || noop;

  if ('function' === typeof room) {
    fn = room;
    room = null;
  }

  if (room) {
    this._clients(null, room, fn);
  } else {
    if (spark._rms) {
      if (1 === spark._rms.length) {
        this._clients(null, spark._rms[0], fn);
      } else {
        exec.call(this, '_clients', null, spark._rms, fn);
      }
      delete spark._rms;
    } else {
      fn(null, []);
    }
  }

  return spark;
};

/**
 * Get connected clients.
 *
 * @param {String} room
 * @param {Function} optional, callback
 * @return {Rooms} self
 * @api public
 */

Rooms.prototype._clients = function (spark, room, fn) {
  this._adapter.clients(room, fn);
  return spark;
};

/**
 * Joins a room.
 *
 * @param {String|Array} room
 * @param {Function} fn callback
 * @return {Rooms} self
 * @api public
 */

Rooms.prototype.join = function(spark, room, fn){
  return exec.call(this, '_join', spark, room, fn);
};

/**
 * Joins a room.
 *
 * @param {String} room
 * @param {Function} optional, callback
 * @return {Rooms} self
 * @api public
 */

Rooms.prototype._join = function(spark, room, fn){
  fn = fn || noop;
  debug('joining room %s', room);
  this._adapter.add(spark.id, room, function (err) {
    if (!err) spark._rooms.push(room);
    fn(err);
  });
  return spark;
};

/**
 * Leaves a room.
 *
 * @param {Spark} spark
 * @param {String} room
 * @param {Function} fn callback
 * @return {Rooms} self
 * @api public
 */

Rooms.prototype.leave = function (spark, room, fn) {
  return exec.call(this, '_leave', spark, room, fn);
};

/**
 * Leaves a room.
 *
 * @param {Spark} spark
 * @param {String} room
 * @param {Function} optional, callback
 * @return {Rooms} self
 * @api public
 */

Rooms.prototype._leave = function(spark, room, fn){
  fn = fn || noop;
  debug('leave room %s', room);
  this._adapter.del(spark.id, room, function (err) {
    if (!err) {
      var pos = spark._rooms.indexOf(room);
      if (~pos) spark._rooms.splice(pos, 1);
    }
    fn(err);
  });
  return spark;
};

/**
 * Targets a room when broadcasting.
 *
 * @param {String} name
 * @return {primus.Spark}
 * @api public
 */

Rooms.prototype.in =
Rooms.prototype.room = function(spark, name){
  var room, rooms = name;
  spark._rms = spark._rms || [];
  if ('string' === typeof name) {
    rooms = name.split(' ');
  }
  for (var i = 0; i < rooms.length; i ++) {
    room = rooms[i];
    if (!~spark._rms.indexOf(room)) spark._rms.push(room);
  }
  return spark;
};

/**
 * Get all rooms for this client.
 *
 * @return {Array} array of rooms
 * @api public
 */

Rooms.prototype.rooms = function (spark, fn) {
  this._adapter.get(spark.id, fn);
  return spark._rooms;
};

/**
 * Leave all rooms that socket is joined to.
 * @return {Rooms} self
 * @api public
 */

Rooms.prototype.leaveAll = function(spark){
  spark._rooms = [];
  this._adapter.delAll(spark.id);
  return spark;
};

/**
 * Execute a specific method were a 
 * string or array is provided.
 *
 * @param {String} method method to execute
 * @param {String|Array} room
 * @param {Function} fn, callback
 * @return {Rooms} self
 * @api private
 */

function exec(method, spark, room, fn){

  var rooms = room, l, err = null, count = 0, result = [];
  if ('string' === typeof room) {
    rooms = room.split(' ');
    if (1 === rooms.length) {
      return this[method](spark, rooms[0], fn);
    }
  }

  l = rooms.length;

  for (var i = 0; i < l; ++i) {
    this[method](spark, rooms[i], cb);
  }

  function cb(err, res) {
    if (err) return fn(err, null);
    var r = {};
    r[room] = res;
    result.push(r); count++;
    if (count === l && 'function' === typeof fn) {
      fn.apply(null, [err].concat(result));
    }
  }

  return spark;
}