/**
 * Module dependencies.
 */

var debug = require('debug')('primus-rooms')
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
  
  options = options.rooms || {};

  // Adapter setter and getter.
  Object.defineProperty(primus, 'adapter', {
    get: function get() {
      return this._adapter;
    },
    set: function set(adapter) {
      if ('object' !== typeof adapter) throw new Error('Adapter should be an object');
      this._adapter = adapter;
    }
  });

  // Lets set our adapter.
  primus.adapter = options.adapter || new Adapter(options);

  /**
   * Sets the adapter for rooms.
   *
   * @param {Adapter} adapter
   * @return {Primus|Adapter} self when setting or value when getting
   * @api public
   */

  primus._rooms = new Rooms(primus, primus.adapter);

  /**
   * Join a client to a room.
   *
   * @param {Spark} spark
   * @param {String|Array} room
   * @param {Function} fn callback
   * @return {Primus} this
   * @api public
   */

  primus.join = function join(spark, room, fn) { 
    this._rooms.batch('join', spark, room, fn);
    return this;
  };
  
  /**
   * Remove client from a room.
   *
   * @param {Spark} spark
   * @param {String|Array} room
   * @param {Function} fn callback
   * @return {Primus} this
   * @api public
   */

  primus.leave = function leave(spark, room, fn) {
    this._rooms.batch('leave', spark, room, fn);
    return this;
  };

  /**
   * Get all rooms for a client or if no argument is passed
   * get all current rooms on the server.
   *
   * @param {Spark} spark
   * @param {Function} [fn]
   * @return {Array} array of rooms
   * @api public
   */

  primus.rooms = function rooms(spark, fn) {
    if ('function' === typeof spark) {
      fn = spark;
      spark = null;
    }
    return (spark || this._rooms).rooms(fn);
  };

  /**
   * Copy room methods to primus.
   */

  ['in', 'room', 'clients', 'except', 'empty', 'isRoomEmpty']
  .forEach(function each(fn) {
    if (primus[fn]) return;
    primus[fn] = function () {
      return this._rooms[fn].apply(this._rooms, arguments);
    };
  });

  // extend spark
  spark(primus.Spark);

  return primus;
}

/**
 * This method initialize PrimusEmitter on primus instance.
 *
 * @param {Spark} spark instance.
 * @api public
 */

function spark(Spark) {

  /**
   * Add rooms initialization.
   *
   * @api private
   */

  Spark.prototype.initialise = function initialise() {
    if (this._rooms) return this;
    this._rooms = new Rooms(this, this.primus.adapter);
  };

  /**
   * Copy room methods to Spark prototype.
   */

  ['in', 'room', 'rooms', 'join', 'leave', 'leaveAll', 'clients', 'except', 'isRoomEmpty']
  .forEach(function each(fn) {
    if (Spark.prototype[fn]) return;
    Spark.writable(fn, function () {
      return this._rooms[fn].apply(this._rooms, arguments);
    });
  });

  // Extend the list of the reserved events with `primus-rooms` events
  if (Spark.prototype.reserved) {
    Rooms.events.forEach(function each(ev) {
      Spark.prototype.reserved.events[ev] = 1;
    });
  }

}

// Expose `Rooms` and `Adapter` and custom events. 
PrimusRooms.Rooms = Rooms;
PrimusRooms.Adapter = Adapter;
PrimusRooms.events = Rooms.events;