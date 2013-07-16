/**
 * Module dependencies.
 */

var Adapter = require('./adapter');
var Spark = require('./spark');

/**
 * Exports module.
 */

module.exports = {

  server: function server (primus, options) {

    /**
     * Sets the adapter for rooms.
     *
     * @param {Adapter} adapter
     * @return {Primus|Adapter} self when setting or value when getting
     * @api public
     */

    primus.adapter = function (adapter) {
      if (!arguments.length) return primus._adapter;
      if ('object' !== typeof adapter) throw new Error('Adapter should be an object');
      primus._adapter = adapter;
      return primus;
    };

    // Lets extend Spark to add rooms.
    Spark(this.Spark);

    // lets set the adapter at run time if none use default
    primus.adapter(options.adapter || new Adapter(primus));

  }
};
