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
 * This method initialize PrimusEmitter on primus instance.
 *
 * @param {Primus} primus Primus instance.
 * @param {Object} options The options.
 * @api public
 */

function PrimusRooms(primus, options) {

  options = options || {};

  var write = primus.write;

  primus._rooms = new Rooms(options.adapter);

  // Extending primus.Spark
  PrimusRooms.Spark(primus.Spark);

  // Adding adapter method to primus
  primus.adapter = function (adapter) {
    var rooms = primus._rooms;
    var result = rooms.adapter.apply(rooms, arguments);
    return arguments.length ? primus : result;
  };

  primus.join = function (spark, room, fn) {
    primus._rooms.join(spark, room, fn);
  };

  primus.leave = function (spark, room, fn) {
    primus._rooms.leave(spark, room, fn);
  };

  primus.in =
  primus.to =
  primus.room = function (name) {
    return primus._rooms.room(primus, name);
  };

  primus.write = function (data) {
    var sparks = primus.connections;
    return primus._rooms.broadcast(primus, data, sparks) ?
    true : write.call(primus, data);
  };

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

   ['to', 'in', 'room', 'rooms', 'join', 'leave', 'leaveAll', 'clients']
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
