/**
 * Module dependencies.
 */

var debug = require('debug')('primus-rooms:rooms')
  , isArray = require('util').isArray;

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

function Rooms(spark, adapter) {
  if (!(this instanceof Rooms)) return new Rooms(spark, adapter);
  this.spark = spark;
  this.adapter = adapter;
  this._rooms = [];
  this._rms = [];
  this.bind();
}

/**
 * Bind `rooms` events.
 *
 * @return {Rooms} self
 * @api public
 */

Rooms.prototype.bind = function () {
  var rooms = this;
  this.spark.on('close', function(){
    rooms.leaveAll();
  });
  return this;
};

/**
 * broadcast a message.
 *
 * @param {Mixed} data The data that needs to be written.
 * @param {Object} sparks Connected sparks.
 * @returns {Boolean}.
 * @api public
 */

Rooms.prototype.broadcast = function (data, sparks) {

  if (!(this._rms && this._rms.length)) return false;

  var rooms = this._rms;
  this.adapter.broadcast(data, {
    except: [this.spark.id],
    rooms: rooms
  }, sparks);

  delete this._rms;
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

Rooms.prototype.clients = function (room, fn) {

  if ('function' === typeof room) {
    fn = room;
    room = null;
  }

  if (room) {
    this._clients(room, fn);
  } else {
    if (this._rms) {
      if (1 === this._rms.length) {
        this._clients(this._rms[0], fn);
      } else {
        exec.call(this, '_clients', this._rms, fn);
      }
      delete this._rms;
    } else {
      fn(null, []);
    }
  }

  return this;
};

/**
 * Get connected clients.
 *
 * @param {String} room
 * @param {Function} optional, callback
 * @return {Rooms} self
 * @api public
 */

Rooms.prototype._clients = function (room, fn) {
  this.adapter.clients(room, fn);
  return this;
};

/**
 * Joins a room.
 *
 * @param {String|Array} room
 * @param {Function} fn callback
 * @return {Rooms} self
 * @api public
 */

Rooms.prototype.join = function(room, fn){
  return exec.call(this, '_join', room, fn);
};

/**
 * Joins a room.
 *
 * @param {String} room
 * @param {Function} optional, callback
 * @return {Rooms} self
 * @api public
 */

Rooms.prototype._join = function(room, fn){
  var rooms = this;
  debug('joining room %s', room);    
  if (~rooms._rooms.indexOf(room)) return this;
  rooms.adapter.add(rooms.spark.id, room, function(err){
    if (err) return fn && fn(err);
    debug('joined room %s', room);
    rooms._rooms.push(room);
    if ('function' === typeof fn) fn(null);
  });
  return this;
};

/**
 * Leaves a room.
 *
 * @param {String} room
 * @param {Function} fn callback
 * @return {Rooms} self
 * @api public
 */

Rooms.prototype.leave = function (room, fn) {
  return exec.call(this, '_leave', room, fn);
};

/**
 * Leaves a room.
 *
 * @param {String} room
 * @param {Function} optional, callback
 * @return {Rooms} self
 * @api public
 */

Rooms.prototype._leave = function(room, fn){
  var rooms = this;
  debug('leave room %s', room);
  rooms.adapter.del(rooms.spark.id, room, function(err){
    if (err) return fn && fn(err);
    debug('left room %s', room);
    var pos = rooms._rooms.indexOf(room);
    if (~pos) rooms._rooms.splice(pos, 1);
    if ('function' === typeof fn) fn(null);
  });
  return this;
};

/**
 * Targets a room when broadcasting.
 *
 * @param {String} name
 * @return {primus.Spark}
 * @api public
 */

Rooms.prototype.to =
Rooms.prototype.in =
Rooms.prototype.room = function(name){
  this._rms = this._rms || [];
  var room, rooms = name;
  if ('string' === typeof name) {
    rooms = name.split(' ');
  }

  for (var i = 0; i < rooms.length; i ++) {
    room = rooms[i];
    if (!~this._rms.indexOf(room)) this._rms.push(room);
  }

  return this.spark;
};

/**
 * Get all rooms for this client.
 *
 * @return {Array} array of rooms
 * @api public
 */

Rooms.prototype.rooms = function(){
  return this._rooms;
};

/**
 * Leave all rooms.
 * @return {Rooms} self
 * @api public
 */

Rooms.prototype.leaveAll = function(){
  this._rooms = [];
  this.adapter.delAll(this.spark.id);
  return this;
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

function exec(method, room, fn){

  var rooms = room, l, err = null, count = 0, result = [];
  if ('string' === typeof room) {
    rooms = room.split(' ');
    if (1 === rooms.length) {
      return this[method](rooms[0], fn);
    }
  }

  l = rooms.length;

  for (var i = 0; i < l; ++i) {
    this[method](rooms[i], cb);
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

  return this;
}