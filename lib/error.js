'use strict';

/**
 * Expose the `RoomsError` constructor.
 */

module.exports = RoomsError;

/**
 * There was an error when joining or leaving a room.
 *
 * @param {Error|String} message - The error or the error message
 * @param {Spark} spark - The spark that caused the error
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

RoomsError.prototype = Object.create(Error.prototype, {
  constructor: { value: RoomsError }
});
