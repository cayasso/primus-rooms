/**
 * Module dependencies.
 */

var Adapter = require('./adapter');

/**
 * Export function.
 */

module.exports = function (Primus) {

  // cache the initialise method for later user
  var inititialise = Primus.prototype.initialise;

  /**
   * Initialise the real-time transport that was chosen.
   *
   * @param {Mixed} Transformer The name of the transformer or a constructor;
   * @api private
   */

  Primus.prototype.initialise = function () {
    this.adapter(new Adapter(this));
    inititialise.apply(this, arguments);
  };

  /**
   * Sets the adapter for rooms.
   *
   * @param {Adapter} adapter
   * @return {Primus|Adapter} self when setting or value when getting
   * @api public
   */

  Primus.prototype.adapter = function(adapter){
    if (!arguments.length) return this._adapter;
    this._adapter = adapter;
    return this;
  };

  return Primus;
};