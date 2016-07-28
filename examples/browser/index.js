var rooms = require('../../')
  , Primus = require('primus')
  , http = require('http')
  , fs = require('fs');

var server = http.createServer(function server(req, res) {
  res.setHeader('Content-Type', 'text/html');
  fs.createReadStream(__dirname + '/index.html').pipe(res);
});


// Primus server.
var primus = new Primus(server);


// add rooms to Primus
primus.plugin('rooms', rooms);

var timer = null;

primus.on('connection', function (spark) {

  spark.on('data', function (room) {

    if ('me' === room) {

      // clear previous interval
      clearInterval(timer);

      timer = setInterval(function () {

        // send data to room1
        spark.room('room2').write('hi');

        // send data to room1 & room3
        spark.room('room1 room3').write('hello room 1 & 3');

        // get clients connected to room1
        spark.room('room3').clients(function(error, clients) {
          console.log('CLIENTS', clients); // output array of spark ids
        });

      }, 5000);

      return;
    }

    console.log('joining room', room);

    spark.join(room, function () {
      console.log('I am in: ', spark.rooms());
    });

    // leaving room room2
    spark.leave('room2');

  });

});


// Start server listening
server.listen(process.env.PORT || 8080, function(){
  var bound = server.address()
  console.log('\033[96mlistening on %s:%d \033[39m', bound.address, bound.port);
});
