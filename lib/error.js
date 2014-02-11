'use strict';

/**
 * Export `RoomsError`.
 */

module.exports = RoomsError;

/**
 * There was an error while parsing incoming or outgoing data.
 *
 * @param {String} message The reason for the error.
 * @param {EventEmitter} spark The spark that caused the error.
 * @api public
 */

function RoomsError(message, spark) {

  Error.call(this);
  Error.captureStackTrace(this, this.constructor);

  if ('object' === typeof message) {
    message = message.message;
  }

  this.message = message;
  this.name = this.constructor.name;

  if (spark) {
    spark.emit('roomserror', this);
    spark.primus.emit('roomserror', this, spark);
  }
}

/**
 * Inheriths from `Error`.
 */

RoomsError.prototype.__proto__ = Error.prototype;