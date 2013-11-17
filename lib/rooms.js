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
 * @param {Spark} spark
 * @param {Mixed} data The data that needs to be written.
 * @param {Object} sparks Connected sparks.
 * @returns {Boolean}.
 * @api public
 */

Rooms.prototype.broadcast = function (spark, data, sparks, except, method) {

  var rooms = spark._rms;
  method = method || 'write';
  if (!(rooms && rooms.length)) return false;   
  var options = { rooms: rooms, except: except, method: method };
  this._adapter.broadcast(('write' === method) ? [data] : data, options, sparks);
  delete spark._rms;
  return true;
};

/**
 * Get connected clients.
 *
 * @param {Spark} spark
 * @param {String} room
 * @param {Function} optional, callback
 * @return {Rooms} self
 * @api public
 */

Rooms.prototype.clients = function (spark, room, fn) {
  
  var res = [];

  if ('function' === typeof room) {
    fn = room;
    room = null;
  }

  if (room) {
    res = this._clients(null, room, fn);
  } else {
    if (spark._rms) {
      if (1 === spark._rms.length) {
        res = this._clients(null, spark._rms[0], fn);
      } else {
        res = exec.call(this, '_clients', null, spark._rms, fn);
      }
      delete spark._rms;
    } else {
      fn(null, []);
    }
  }
  return fn ? spark : res;
};

/**
 * Get connected clients.
 *
 * @param {Spark} spark
 * @param {String} room
 * @param {Function} optional, callback
 * @return {Rooms} self
 * @api public
 */

Rooms.prototype._clients = function (spark, room, fn) {
  return this._adapter.clients(room, fn);
};

/**
 * Joins a room.
 *
 * @param {Spark} spark
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
 * @param {Spark} spark
 * @param {String} room
 * @param {Function} optional, callback
 * @return {Rooms} self
 * @api public
 */

Rooms.prototype._join = function(spark, room, fn){
  fn = fn || noop;
  debug('joining room %s', room);
  this._adapter.add(spark.id, room, function (err) {
    if (err) {
      spark.emit('roomserror', err);
      spark.primus.emit('roomserror', err, spark);
      return fn(err);
    }
    spark._rooms.push(room);
    spark.emit('joinroom', room);
    spark.primus.emit('joinroom', room, spark);
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
    if (err) {
      spark.emit('roomserror', err);
      spark.primus.emit('roomserror', err, spark);
      return fn(err);
    }
    var pos = spark._rooms.indexOf(room);
    if (~pos) spark._rooms.splice(pos, 1);
    spark.emit('leaveroom', room);
    spark.primus.emit('leaveroom', room, spark);
    fn(err);
  });
  return spark;
};

/**
 * Targets a room when broadcasting.
 *
 * @param {Spark} spark
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
 * @param {Spark} spark
 * @return {Array} array of rooms
 * @api public
 */

Rooms.prototype.rooms = function (spark, fn) {
  this._adapter.get(spark.id, fn);
  return spark._rooms;
};

/**
 * Leave all rooms that socket is joined to.
 *
 * @param {Spark} spark
 * @return {Rooms} self
 * @api public
 */

Rooms.prototype.leaveAll = function(spark){
  this._adapter.delAll(spark.id);
  var rooms = spark.rooms();
  spark.emit('leaveallrooms', rooms, spark);
  spark.primus.emit('leaveallrooms', rooms, spark);
  spark._rooms = [];
  return spark;
};

/**
 * Execute a specific method were a 
 * string or array is provided.
 *
 * @param {String} method method to execute
 * @param {Spark} spark
 * @param {String|Array} room
 * @param {Function} fn, callback
 * @return {Rooms} self
 * @api private
 */

function exec(method, spark, room, fn){

  var r, rooms = room || [], l, err = null, count = 0, result = [], re = [];

  if ('string' === typeof room) {
    rooms = room.split(' ');
    if (1 === rooms.length) {
      return this[method](spark, rooms[0], fn);
    }
  }

  l = rooms.length;

  for (var i = 0; i < l; ++i) {
    r = {};
    r[rooms[i]] = this[method](spark, rooms[i], cb);
    re.push(r);
  }

  function cb(err, res) {
    if (err) return fn(err, null);
    r = {};
    r[room] = res;
    result.push(r); count++;
    if (count === l && 'function' === typeof fn) {
      fn.apply(null, [err].concat(result));
    }
  }

  return re; //spark;
}