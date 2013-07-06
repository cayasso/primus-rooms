/**
 * Module dependencies.
 */

var debug = require('debug')('primus-rooms:spark');

/**
 * Export this method.
 */

module.exports = function (Spark) {

  /**
   * noopy function.
   */

  var noop = function () {};

  // cache the initialise method for later user
  var inititialise = Spark.prototype.initialise;

  /**
   * Attach hooks and automatically announce a new connection.
   *
   * @api private
   */

  Spark.prototype.initialise = function () {
    this._rooms = [];
    this.adapter = this.primus.adapter();
    this.on('close', this.leaveAll.bind(this));
    inititialise.apply(this, arguments);
  };

  /**
   * Send data.
   *
   * @param {Object} data
   * @return {Spark} self
   * @api public
   */

  Spark.prototype.broadcast = function (name, data) {
    if (this._rooms && this._rooms.length) {
      var rooms = [];
      if (isArray(name)) rooms = name;
      if ('string' === typeof name) rooms = name.split(' ');
      this.adapter.broadcast(data, {
        except: [this.id],
        rooms: name ? rooms : this._rooms
      });
    }
  };

  /**
   * Get connected clients.
   *
   * @param {String} name
   * @param {Function} optional, callback
   * @return {Array} array of clients
   * @api public
   */

  Spark.prototype.clients = function (name, fn) {
    return this.adapter.clients(name, fn);
  };

  /**
   * Joins a room.
   *
   * @param {String} room
   * @param {Function} optional, callback
   * @return {Spark} self
   * @api public
   */

  Spark.prototype.join = function(room, fn){
    debug('joining room %s', room);
    if (~this._rooms.indexOf(room)) return this;
    this.adapter.add(this.id, room, function(err){
      if (err) return fn && fn(err);
      debug('joined room %s', room);
      this._rooms.push(room);
      fn && fn(null);
    }.bind(this));
    return this;
  };

  /**
   * Leaves a room.
   *
   * @param {String} room
   * @param {Function} optional, callback
   * @return {Spark} self
   * @api public
   */

  Spark.prototype.leave = function(room, fn){
    debug('leave room %s', room);
    this.adapter.del(this.id, room, function(err){
      if (err) return fn && fn(err);
      debug('left room %s', room);
      var pos = this._rooms.indexOf(room);
      if (~pos) this._rooms.splice(pos, 1);
      fn && fn(null);
    }.bind(this));
    return this;
  };

  /**
   * Targets a room when broadcasting.
   *
   * @param {String} name
   * @return {Object} name spaces
   * @api public
   */

  Spark.prototype.room = function(name){
    this._rooms = this._rooms || [];
    if (!~this._rooms.indexOf(name)) this._rooms.push(name);
    return {
      broadcast: this.broadcast.bind(this, name),
      write: this.broadcast.bind(this, name),
      clients: this.clients.bind(this, name),
      rooms: this.rooms.bind(this)
    };
  };

  /**
   * Get all rooms for this client.
   *
   * @param {String} name
   * @return {Array} array of rooms
   * @api public
   */

  Spark.prototype.rooms = function(name){
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
   * isArray helper.
   *
   * @param {Mixed} obj
   * @return {Boolean} self
   * @api public
   */

  function isArray(obj) {
    var toString = Object.prototype.toString;
    return '[object Array]' === toString.call(obj);
  }

  return Spark;
};