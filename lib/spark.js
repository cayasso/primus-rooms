/**
 * Module dependencies.
 */

var debug = require('debug')('primus-rooms:spark')
  , isArray = require('util').isArray;

/**
 * Export this method.
 */

module.exports = function (Spark) {

  /**
   * noopy function.
   */

  var noop = function () {};

  // cache the initialise method for later user

 /**
  * `Spark#initialise` reference.
  */

  var inititialise = Spark.prototype.initialise;

 /**
  * `Spark#write` reference.
  */

  var write = Spark.prototype.write;

  /**
   * Attach hooks and automatically announce a new connection.
   *
   * @api private
   */

  Spark.prototype.initialise = function () {
    var spark = this;
    this._rooms = [];
    this._rms = [];
    this.adapter = this.primus.adapter();
    this.on('close', function(){
      spark.leaveAll();
    });
    inititialise.apply(spark, arguments);
  };

  /**
   * Send a message.
   *
   * @param {Mixed} data The data that needs to be written.
   * @returns {Boolean} Always returns true.
   * @api public
   */

  Spark.prototype.write = function (data) {
    if (this._rms && this._rms.length) {
      var rooms = this._rms;
      this.adapter.broadcast(data, {
        except: [this.id],
        rooms: rooms
      });
      delete this._rms;
      return true;
    }
    return write.call(this, data);
  };

  /**
   * Get connected clients.
   *
   * @param {String} room
   * @param {Function} optional, callback
   * @return {Array} array of clients
   * @api public
   */

  Spark.prototype.clients = function (room, fn) {

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
   * @return {Array} array of clients
   * @api public
   */

  Spark.prototype._clients = function (room, fn) {
    this.adapter.clients(room, fn);
    return this;
  };

  /**
   * Joins a room.
   *
   * @param {String|Array} room
   * @param {Function} fn callback
   * @return {Socket} self
   * @api public
   */

  Spark.prototype.join = function(room, fn){
    return exec.call(this, '_join', room, fn);
  };

  /**
   * Joins a room.
   *
   * @param {String} room
   * @param {Function} optional, callback
   * @return {Spark} self
   * @api public
   */

  Spark.prototype._join = function(room, fn){
    var spark = this;
    debug('joining room %s', room);
    if (~spark._rooms.indexOf(room)) return this;
    spark.adapter.add(spark.id, room, function(err){
      if (err) return fn && fn(err);
      debug('joined room %s', room);
      spark._rooms.push(room);
      if ('function' === typeof fn) fn(null);
    });
    return this;
  };

  /**
   * Leaves a room.
   *
   * @param {String} room
   * @param {Function} fn callback
   * @return {Socket} self
   * @api public
   */

  Spark.prototype.leave = function (room, fn) {
    return exec.call(this, '_leave', room, fn);
  };

  /**
   * Leaves a room.
   *
   * @param {String} room
   * @param {Function} optional, callback
   * @return {Spark} self
   * @api public
   */

  Spark.prototype._leave = function(room, fn){
    var spark = this;
    debug('leave room %s', room);
    spark.adapter.del(spark.id, room, function(err){
      if (err) return fn && fn(err);
      debug('left room %s', room);
      var pos = spark._rooms.indexOf(room);
      if (~pos) spark._rooms.splice(pos, 1);
      if ('function' === typeof fn) fn(null);
    });
    return this;
  };

  /**
   * Targets a room when broadcasting.
   *
   * @param {String} name
   * @return {Object} name spaces
   * @api public
   */

  Spark.prototype.to =
  Spark.prototype.in =
  Spark.prototype.room = function(name){
    this._rms = this._rms || []
    var room, rooms = name;
    if ('string' === typeof name) {
      rooms = name.split(' ');
    }

    for (var i = 0; i < rooms.length; i ++) {
      room = rooms[i];
      if (!~this._rms.indexOf(room)) this._rms.push(room);
    }

    return this;
  };

  /**
   * Get all rooms for this client.
   *
   * @return {Array} array of rooms
   * @api public
   */

  Spark.prototype.rooms = function(){
    return this._rooms;
  };

  /**
   * Leave all rooms.
   *
   * @api public
   */

  Spark.prototype.leaveAll = function(){
    this._rooms = [];
    this.adapter.delAll(this.id);
    return this;
  };

  /**
   * Execute a specific method were a 
   * string or array is provided.
   *
   * @param {String} method method to execute
   * @param {String|Array} room
   * @param {Function} fn, callback
   * @return {Socket} self
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

  return Spark;
};