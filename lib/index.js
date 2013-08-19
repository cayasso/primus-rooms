/**
 * Module dependencies.
 */

var debug = require('debug')('primus-rooms:spark')
  , Rooms = require('./rooms')
  , Adapter = require('./adapter');

/**
 * Export the `PrimusRooms` method.
 */

module.exports = PrimusRooms;

/**
 * This method initialize PrimusRooms on primus instance.
 * 
 * @return {Spark} It returns a primus.Spark
 * @api public
 */

function PrimusRooms(primus, opts) {

  opts = opts || {};

  // Extending primus.Spark
  PrimusRooms.Spark(primus.Spark);

  // Adding adapter method to primus
  primus.adapter = function adapter(adapter) {
    if (!arguments.length) return primus._adapter;
    if ('object' !== typeof adapter) throw new Error('Adapter should be an object');
    primus._adapter = adapter;
    return primus;
  };

  // We need to execute the adapter method to set
  // our default adapter
  primus.adapter(opts.adapter || new Adapter());

  return this;
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
    this._rooms = new Rooms(this, this.primus.adapter());
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
    return this._rooms.broadcast(data, sparks) ?
    true : write.call(this, data);
  };

  /**
   * Copy room methods to Spark prototype.
   */

  ['to', 'in', 'room', 'rooms', 'join', 'leave', 'leaveAll','clients']
  .forEach(function (fn) {
    Spark.prototype[fn] = function () {
      return this._rooms[fn].apply(this._rooms, arguments);
    };
  });

  return Spark;
};

// Expose `Rooms` and `Adapter` 
PrimusRooms.Rooms = Rooms;
PrimusRooms.Adapter = Adapter;
