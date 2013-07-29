/**
 * Module dependencies.
 */

var debug = require('debug')('primus-rooms:spark')
  , isArray = require('util').isArray
  , Rooms = require('./rooms');

/**
 * Export this method.
 */

module.exports = function (Spark) {

 /**
  * `Spark#initialise` reference.
  */

  var init = Spark.prototype.initialise;

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