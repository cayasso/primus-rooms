# Primus Rooms

[![Build Status](https://travis-ci.org/cayasso/primus-rooms.png?branch=master)](https://travis-ci.org/cayasso/primus-rooms)
[![NPM version](https://badge.fury.io/js/primus-rooms.png)](http://badge.fury.io/js/primus-rooms)

Node.JS module that adds room capabilities to a [Primus](https://github.com/3rd-Eden/primus) server.

## Instalation

```
npm install primus-rooms
```

## Usage

### On the Server

```javascript
var Primus = require('primus');
var Rooms = require('primus-rooms');
var server = require('http').createServer();

// primus instance
var primus = new Primus(server, { transformer: 'websockets', parser: 'JSON' });

// add rooms to Primus
primus.use('rooms', Rooms);

primus.on('connection', function (spark) {

  // joining room1 & room2
  spark.join('room1', fn);
  spark.join('room2', fn);
  spark.join('room3', fn);

  // leaving room room2
  spark.leave('room2', fn);

  // get rooms I am connected to
  var myRooms = spark.rooms();
  console.log(myRooms); // ['room1', 'room3']

  // send data to room1
  spark.room('room1').write('hi');

  // send data to room1 & room3
  spark.room('room1 room3').write('hi');

  // get clients connected to room1
  spark.room('room1').clients(function(clients) {
    console.log(clients); // output array of spark ids
  });

  // leaving all rooms
  spark.leaveAll();

  // join rooms on request
  spark.on('data', function(room) {
    spark.join(room);
  });

});

server.listen(8080);
```

### On the Client

```javascript
var primus = Primus.connect('ws://localhost:8080');

primus.on('open', function () {

  // Send request to join the news room
  primus.write('news');

});

```

## API

### primus#adapter(Adapter)

Set your own `adapter` for rooms, by default `primus-rooms` comes 
with its own `memory` adapter but its easy to provide a custom one.

```javascript
// as argument
var primus = new Primus(url, { transformer: 'sockjs', adapter: myAdapter });
primus.use('rooms', Rooms);

// by calling the method
primus.adapter(new MyAdapter());
```

### spark#join(name, [fn])

Join client to a `room`, `fn` is optional callback.

```javascript
spark.join('room');
```

Join multiple rooms at once.

```javascript
spark.join('room1 room2 room3', fn);
```

### spark#room(name, [fn])

Target a specific `room`.

```javascript
spark.room('room').write('hi');
spark.room('room').clients(fn);
```

### spark#room#write(message)

Send a message to a specific `room`.

```javascript
spark.room('room').write('hi');
```

### spark#room#clients(fn)

Get all client `ids` connected to specific `room`.

```javascript
spark.room('room').clients(fn);
```

### sparkt#leave(name, [fn])

Leave a specific `room`, `fn` is optional callback.

```javascript
spark.leave('room', fn);
```

Leave multiple rooms at once.

```javascript
spark.leave('room1 room2 room3', fn);
```

### spark#leaveAll()

Leave all rooms the client has joined.

```javascript
spark.leaveAll();
```

### spark#rooms()

Get all rooms client is connected to.

```javascript
spark.rooms();
```

## Run tests

```
make test
```

## License

(The MIT License)

Copyright (c) 2013 Jonathan Brumley &lt;cayasso@gmail.com&gt;

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
