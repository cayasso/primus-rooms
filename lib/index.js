'use strict';

/**
 * Module dependencies.
 */

var debug = require('debug')('primus-rooms')
  , Adapter = require('primus-rooms-adapter')
  , Rooms = require('./rooms');

/**
 * Expose the `PrimusRooms` function.
 */

module.exports = PrimusRooms;

/**
 * Add required properties to the `Primus` instance.
 *
 * @param {Primus} primus - The `Primus` instance
 * @param {Object} options - The options
 * @return {Primus} The `Primus` instance
 * @api public
 */

function PrimusRooms(primus, options) {

  options = options.rooms || {};

  Object.defineProperty(primus, 'adapter', {

    /**
     * Get the adpter.
     *
     * @return {Adapter}
     */

    get: function get() {
      return this._adapter;
    },

    /**
     * Set the adapter.
     *
     * @param {Adapter}
     */

    set: function set(adapter) {
      if ('object' !== typeof adapter) {
        throw new Error('Adapter should be an object');
      }
      this._adapter = adapter;
    }
  });

  // Set our adapter
  primus.adapter = options.adapter || new Adapter(options);

  // Add `Rooms` instance
  Rooms(primus, primus.adapter);

  /**
   * Join a client to a room.
   *
   * @param {Spark|String|Array<Spark|String>} spark
   * @param {Number|String|Array<Number|String>} room
   * @param {Function} [fn]
   * @return {Primus} this
   * @api public
   */

  primus.join = function join(spark, room, fn) {
    this._rooms.batch('join', spark, room, fn);
    return this;
  };

  /**
   * Remove a client from a room.
   *
   * @param {Spark|String|Array<Spark|String>} spark
   * @param {Number|String|Array<Number|String>} room
   * @param {Function} [fn]
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
   * @param {String|Spark} [spark]
   * @param {Function} [fn]
   * @return {String[]}
   * @api public
   */

  primus.rooms = function rooms(spark, fn) {
    if ('function' === typeof spark) {
      fn = spark;
      spark = null;
    } else if ('string' === typeof spark) {
      spark = this.connections[spark];
    }
    return (spark || this._rooms).rooms(fn);
  };

  // Copy `Rooms` methods to the `Primus` instance
  [
    'clients',
    'empty',
    'except',
    'in',
    'isRoomEmpty',
    'room'
  ].forEach(function each(fn) {
    if (primus[fn]) return;
    primus[fn] = function () {
      return this._rooms[fn].apply(this._rooms, arguments);
    };
  });

  // Extend the `Spark`
  spark(primus.Spark);

  // Extend the list of the reserved events with `primus-rooms` events
  if (primus.reserved) {
    Rooms.events.forEach(function each(ev) {
      primus.reserved.events[ev] = 1;
    });
  }

  return primus;
}

/**
 * Add required properties to the `Spark` prototype.
 *
 * @param {Function} Spark - The `Spark` constructor
 * @return {Function} The `Spark` constructor
 * @api public
 */

function spark(Spark) {

  // Add `Rooms` instance
  Spark.prototype.initialise = function initialise() {
    if (this._rooms) return this;
    Rooms(this, this.primus.adapter);
  };

  // Copy `Rooms` methods to the `Spark` prototype
  [
    'clients',
    'except',
    'in',
    'isRoomEmpty',
    'join',
    'leave',
    'leaveAll',
    'room',
    'rooms',
    'transform'
  ].forEach(function each(fn) {
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

  return Spark;
}

/**
 * Expose the `Rooms` constructor.
 */

PrimusRooms.Rooms = Rooms;

/**
 * Expose the `Adapter` constructor.
 */

PrimusRooms.Adapter = Adapter;

/**
 * Expose the reserved events.
 */

PrimusRooms.events = Rooms.events;
