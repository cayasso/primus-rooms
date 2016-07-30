'use strict';

const Primus = require('primus');
const http = require('http');

const rooms = require('../../');

const server = http.createServer();
const primus = new Primus(server);

// Add room plugin
primus.plugin('rooms', rooms);

primus.on('connection', (spark) => {
  spark.on('data', (data) => {
    if (data !== 'me') {
      return spark.join(data, () => console.log('joined room %s', data));
    }

    spark.room('room1 room2 room3 room4').write('Welcome');
    spark.room('room4').write('Bienvenidos');
  });
});

const client = (room) => {
  const socket = new primus.Socket(`http://localhost:${server.address().port}`);

  if (room === 'me') {
    setInterval(() => socket.write(room), 3000);
  } else {
    socket.write(room);
  }

  socket.on('data', (data) => console.log(data));
};

server.listen(() => {
  console.log('listening on *:%d', server.address().port);

  client('room1');
  client('room2');
  client('room3');
  client('room4');

  setTimeout(() => client('me'), 10);
});
