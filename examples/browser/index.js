'use strict';

const Primus = require('primus');
const http = require('http');
const fs = require('fs');

const rooms = require('../../');

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html');
  fs.createReadStream(__dirname + '/index.html').pipe(res);
});

const primus = new Primus(server);

// Add room plugin
primus.plugin('rooms', rooms);

primus.on('connection', (spark) => {
  spark.on('data', (room) => {
    if (room !== 'me') {
      return spark.join(room, () => console.log('joined room %s', room));
    }

    spark.room('room1 room3').write('hello room 1 & 3');
    spark.room('room2').write('hi');

    // Get clients connected to room3
    spark.room('room3').clients((err, clients) => console.log(clients));
  });
});

server.listen(() => console.log('listening on *:%d', server.address().port));
