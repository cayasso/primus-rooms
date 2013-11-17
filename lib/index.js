/**
 * Module dependencies.
 */

var debug = require('debug')('primus-rooms:spark')
  , Adapter = require('./adapter')
  , Rooms = require('./rooms');

/**
 * Export the `PrimusRooms` method.
 */

module.exports = PrimusRooms;

/**
 * This method initialize PrimusEmitter on primus instance.
 *
 * @param {Primus} primus Primus instance.
 * @param {Object} options The options.
 * @api public
 */

function PrimusRooms(primus, options) {

  options = options || {};

  // caching primus send method as defined by `primus-emitter`
  var send = primus.send || function() {
    var args = arguments;
    primus.forEach(function (spark) {
      spark.send.apply(spark, args);
    });
    return primus;
  };

  // shortcut to slice
  var slice = [].slice;

  // caching primus write method
  var write = primus.write;

  // getting rooms instance
  primus._rooms = new Rooms(options.adapter);

  // Extending primus.Spark
  PrimusRooms.Spark(primus.Spark);

  /**
   * Sets the adapter for rooms.
   *
   * @param {Adapter} adapter
   * @return {Primus|Adapter} self when setting or value when getting
   * @api public
   */

  primus.adapter = function (adapter) {
    var rooms = primus._rooms;
    var result = rooms.adapter.apply(rooms, arguments);
    return arguments.length ? primus : result;
  };

  /**
   * Join a client to a room.
   *
   * @param {Spark} spark
   * @param {String|Array} room
   * @param {Function} fn callback
   * @return {Primus} self
   * @api public
   */

  primus.join = function (spark, room, fn) {
    primus._rooms.join(spark, room, fn);
    return primus;
  };

  /**
   * Remove client from a room.
   *
   * @param {Spark} spark
   * @param {String|Array} room
   * @param {Function} fn callback
   * @return {Primus} self
   * @api public
   */

  primus.leave = function (spark, room, fn) {
    primus._rooms.leave(spark, room, fn);
    return primus;
  };

  /**
   * Targets a room when broadcasting.
   *
   * @param {String} name
   * @return {primus}
   * @api public
   */

  primus.in =
  primus.room = function (name) {
    return primus._rooms.room(primus, name);
  };

  /**
   * Get connected clients.
   *
   * @param {Function} fn callback
   * @return {primus} self
   * @api public
   */

  primus.clients = function clients(fn) {
    return primus._rooms.clients(primus, fn);
  };

  /**
   * Broadcast message to all connections or clients in a room.
   *
   * @param {Mixed} data The data you want to send.
   * @api public
   */

  primus.write = function write(data) {
    return broadcast(data, 'write');
  };

  /**
   * Emit a message to all connections or clients in a room.
   *
   * @param {Mixed} data The data you want to send.
   * @api public
   */

  primus.send = function send(data) {
    return broadcast(arguments, 'send');
  };

  /**
   * Broadcast message to all connections or clients in a room.
   *
   * @param {Mixed} data The data you want to send.
   * @param {String} method The method of broadcasting to perform, 
   * could be `send` or `write`, the first one is only supported 
   * if `primus-emitter` is present.
   *
   * @api public
   */

  function broadcast(data, method) {
    var sparks = primus.connections;
    return primus._rooms.broadcast(primus, data, sparks, null, method)
      ? true
      : method === 'write'
        ? write.call(primus, data)
        : send.apply(primus, data);
  }

  return primus;
}

/**
 * Extend a Spark to add Rooms capabilities.
 * 
 * @return {Spark} It returns a primus.Spark
 * @api public
 */

PrimusRooms.Spark = function (Spark) {

  /**
   * `Spark#initialise` reference.
   */

  var init = Spark.prototype.initialise;

  /**
   * `Spark#write` reference.
   */

  var write = Spark.prototype.write;

  /**
   * Adding reference to Rooms.
   */

  Spark.prototype.Rooms = Rooms;

  /**
   * Attach hooks and automatically announce a new connection.
   *
   * @api private
   */

  Spark.prototype.initialise = function () {
    this._rooms = [];
    this.once('end', this.leaveAll);
    init.apply(this, arguments);
  };

  /**
   * Send a message.
   *
   * @param {Mixed} data The data that needs to be written.
   * @returns {Boolean} Always returns true.
   * @api public
   */

  Spark.prototype.write = function (data) {
    var sparks = this.primus.connections;
    return this.primus._rooms.broadcast(this, data, sparks, [this.id]) ?
    true : write.call(this, data);
  };

  /**
   * Copy room methods to Spark prototype.
   */

  ['in', 'room', 'rooms', 'join', 'leave', 'leaveAll', 'clients']
  .forEach(function (fn) {
    Spark.prototype[fn] = function () {
      var args = [].slice.call(arguments);
      var rooms = this.primus._rooms;
      return rooms[fn].apply(rooms, [this].concat(args));
    };
  });

  return Spark;
};

// Expose `Rooms` and `Adapter` 
PrimusRooms.Rooms = Rooms;
PrimusRooms.Adapter = Adapter;
