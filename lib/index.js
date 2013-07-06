/**
 * Module dependencies.
 */

var ExtendPrimus = require('./primus');
var ExtendSpark = require('./spark');

/**
 * Module exports.
 */

module.exports = function (Primus) {

  ExtendPrimus(Primus);
  ExtendSpark(Primus.Spark);

  return Primus;
};