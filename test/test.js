var Primus = require('primus');
var Rooms = require('../');
var http = require('http').Server;
var expect = require('expect.js');
var opts = { transformer: 'websockets' };
var srv;

// creates the client
function client(srv, primus, port){
  var addr = srv.address();
  var url = 'http://' + addr.address + ':' + (port || addr.port);
  return new primus.Socket(url);
}

// creates the server
function server(srv, opts) {
  // use rooms plugin
  return Primus(srv, opts).use('rooms', Rooms);
}

describe('primus-rooms', function () {

  it('should have required methods', function(done){
    var srv = http();
    var primus = server(srv, opts);
    srv.listen(function(){
      primus.on('connection', function (spark) {
        expect(spark.join).to.be.a('function');
        expect(spark.leave).to.be.a('function');
        expect(spark.leaveAll).to.be.a('function');
        expect(spark.room).to.be.a('function');
        expect(spark.rooms).to.be.a('function');
        expect(spark.clients).to.be.a('function');
        srv.close();
        done();
      });
      client(srv, primus);
    });
  });

  it('should join room', function(done){
    var srv = http();
    var primus = server(srv, opts);
    srv.listen(function(){ 
      primus.on('connection', function(spark){
        spark.join('room1');
        spark.room('room1').clients(function (err, clients) {
          expect(!!~clients.indexOf(spark.id)).to.eql(true);
          srv.close();
          done();
        });
      });
      client(srv, primus);
    });
  });
  
  it('should join multiple rooms at once', function(done){
    var srv = http();
    var primus = server(srv, opts);
    srv.listen(function(){      
      primus.on('connection', function(spark){
        spark.join('room1 room2 room3', function(){
          spark.room('room1').clients(function (err, clients) {
            expect(!!~clients.indexOf(spark.id)).to.be.ok();
            spark.room('room2').clients(function (err, clients) {
              expect(!!~clients.indexOf(spark.id)).to.be.ok();
              spark.room('room3').clients(function (err, clients) {
                expect(!!~clients.indexOf(spark.id)).to.be.ok();
                srv.close();
                done();
              });
            });
          });
        });
      });
      client(srv, primus);
    });
  });

  it('should join multiple rooms at once passing an array as argument', function(done){
    var srv = http();
    var primus = server(srv, opts);
    srv.listen(function(){
      primus.on('connection', function(spark){
        spark.join(['room1', 'room2', 'room3'], function(){
          spark.room('room1').clients(function (err, clients) {
            expect(!!~clients.indexOf(spark.id)).to.be.ok();
            spark.room('room2').clients(function (err, clients) {
              expect(!!~clients.indexOf(spark.id)).to.be.ok();
              spark.room('room3').clients(function (err, clients) {
                expect(!!~clients.indexOf(spark.id)).to.be.ok();
                srv.close();
                done();
              });
            });
          });
        });
      });
      client(srv, primus);
    });
  });

  it('should leave room', function(done){
    var srv = http();
    var primus = server(srv, opts);
    srv.listen(function(){  
      primus.on('connection', function(spark){
        spark.join('room1');
        spark.leave('room1');
        spark.room('room1').clients(function (err, clients) {
          expect(!!~clients.indexOf(spark.id)).to.eql(false);
          srv.close();
          done();
        });
      });
      client(srv, primus);
    });
  });
  
  it('should leave multiple rooms at once', function(done){
    var srv = http();
    var primus = server(srv, opts);
    srv.listen(function(){      
      primus.on('connection', function(spark){
        spark.join('room1 room2 room3 room4', function () {
          spark.leave('room1 room2 room3', function(){
            expect(spark.rooms()).to.eql(['room4']);
            srv.close();
            done();
          });
        });
      });
      client(srv, primus);
    });
  });

  it('should leave multiple rooms at once passing an array', function(done){
    var srv = http();
    var primus = server(srv, opts);
    srv.listen(function(){
      primus.on('connection', function(spark){
        spark.join('room1 room2 room3 room4', function () {
          spark.leave(['room1', 'room2', 'room3'], function(){
            expect(spark.rooms()).to.be.eql(['room4']);
            srv.close();
            done();
          });
        });
      });
      client(srv, primus);
    });
  });

  it('should leave all rooms', function(done){
    var srv = http();
    var primus = server(srv, opts);
    srv.listen(function(){
      primus.on('connection', function(spark){
        spark.join('room1');
        spark.join('room2');
        spark.join('room3');
        spark.leaveAll();
        expect(spark.rooms()).to.be.eql([]);
        srv.close();
        done();
      });
      client(srv, primus);
    });
  });

  it('should cleanup room on leave', function(done){
    var srv = http();
    var primus = server(srv, opts);
    srv.listen(function(){
      primus.on('connection', function(spark){
        spark.join('room1');
        spark.leave('room1');
        expect(spark.primus.adapter().rooms).to.be.empty();
        srv.close();
        done();
      });
      client(srv, primus);
    });
  });

  it('should cleanup rooms on leave all', function(done){
    var srv = http();
    var primus = server(srv, opts);
    srv.listen(function(){
      primus.on('connection', function(spark){
        spark.join('room1');
        spark.join('room2');
        spark.join('room3');
        spark.leaveAll();
        expect(spark.primus.adapter().rooms).to.be.empty();
        srv.close();
        done();
      });
      client(srv, primus);
    });
  });

  it('should allow method channing', function(done){
    var srv = http();
    var primus = server(srv, opts);
    srv.listen(function(){
      primus.on('connection', function(spark){
        spark
        .join('room1')
        .join('room2')
        .join('room3')
        .leave('room1')
        .leave('room2')
        .leave('room3');
        process.nextTick(function () {
          expect(spark.rooms()).to.eql([]);
          srv.close();
          done();
        });
      });
      client(srv, primus);
    });
  });

  it('should allow simple connection', function(done){
    this.timeout(0);
    var srv = http();
    var primus = server(srv, opts);

    srv.listen(function(){
      var c1 = client(srv, primus);
      primus.on('connection', function(spark){
        spark.on('data', function (data) {
          spark.write(data);
        });
      });

      c1.on('open', function () {
        c1.on('data', function (data) {
          if ('send' === data) {
            srv.close();
            done();
          }
        });
      });
      c1.write('send');
    });
  });

  it('should allow sending to multiple rooms', function(done){
    this.timeout(0);
    var srv = http();
    var primus = server(srv, opts);
    var total = 2;
    var count = 0;

    srv.listen(function(){

      var c1 = client(srv, primus);
      var c2 = client(srv, primus);
      var c3 = client(srv, primus);
      var c4 = client(srv, primus);

      primus.on('connection', function(spark){
        spark.on('data', function (data) {
          spark.join(data, function () {
            if (3 === count++) {
              spark.room('room1 room2 room3').write('a');
            }
          });
        });
      });

      c1.on('data', function (data) {
        --total || finish();
      });

      c2.on('data', function (data) {
        --total || finish();
      });

      c3.on('data', function (data) {
        --total || finish();
      });

      c4.on('data', function (data) {
        finish(new Error('not'));
      });

      function finish (data) {
        srv.close();
        done(data);
      }

      c1.write('room1');
      c2.write('room2');
      c3.write('room3');
      c4.write('room4');

    });
  });

  it('should avoid sending dupes', function(done){

    var srv = http();
    var primus = server(srv, opts);
    var total = 2;

    srv.listen(function(){
      primus.on('connection', function(spark){
        spark.join('room1');
        spark.join('room2');
        spark.join('room3');
        spark.join('room4');
        spark.on('data', function (data) {
          if (data === 'send') {
            spark.room('room1 room2 room3').write('a');
          }
        });
      });
      var c1 = client(srv, primus);
      var c2 = client(srv, primus);
      var c3 = client(srv, primus);

      c2.on('data', function (data) {
        expect('a' === data);
        --total || finish();
      });

      c3.on('data', function (data) {
        expect('a' === data);
        --total || finish();
      });

      function finish () {
        srv.close();
        done();
      }

      setTimeout(function() {
        c1.write('send');
      }, 50);
    });
  });

  it('should get all clients connected to a room', function(done){
    var srv = http();
    var primus = server(srv, opts);
    var ids = [];
    srv.listen(function(){
      primus.on('connection', function(spark){
        ids.push(spark.id);
        spark.join('room1');
        spark.on('data', function (){
          spark.room('room1').clients(function (err, clients) {
            expect(clients).to.be.eql(ids);
            srv.close();
            done();
          });
        });
      });
      client(srv, primus);
      client(srv, primus);
      client(srv, primus);
      client(srv, primus)
      .write('send');
    });
  });

  it('should get all clients synchronously if no callback is provided', function(done){
    var srv = http();
    var primus = server(srv, opts);
    var ids = [];
    srv.listen(function(){
      primus.on('connection', function(spark){
        ids.push(spark.id);
        spark.join('room1');
        spark.on('data', function (){
          var clients = spark.room('room1').clients();
          expect(clients).to.be.eql(ids);
          srv.close();
          done();
        });
      });
      client(srv, primus);
      client(srv, primus);
      client(srv, primus);
      client(srv, primus)
      .write('send');
    });
  });

  it('should keeps track of rooms', function(done){
    var srv = http();
    var primus = server(srv, opts);
    srv.listen(function(){
      var conn = client(srv, primus);
      primus.on('connection', function(s){
        s.join('a', function(){
          expect(s.rooms()).to.eql(['a']);
          s.join('b', function(){
            expect(s.rooms()).to.eql(['a', 'b']);
            s.leave('b', function(){
              expect(s.rooms()).to.eql(['a']);
              srv.close();
              done();
            });
          });
        });
      });
    });
  });

  it('should allow passing adapter as argument', function(done){
    var srv = http();
    opts.adapter = {
      add: function (){},
      del: function (){},
      delAll: function (){},
      broadcast: function (){},
      clients: function (){}
    };

    var primus = Primus(srv, opts).use('rooms', Rooms);
    srv.listen(function(){
      expect(primus.adapter()).to.be.eql(opts.adapter);
      delete opts.adapter;
      srv.close();
      done();
    });
  });

  it('should allow setting and getting adapter', function(done){
    var srv = http();
    var adapter = {
      add: function (){},
      del: function (){},
      delAll: function (){},
      broadcast: function (){},
      clients: function (){}
    };

    var primus = Primus(srv, opts).use('rooms', Rooms);
    srv.listen(function(){
      primus.adapter(adapter);
      expect(primus.adapter()).to.be.eql(adapter);
      srv.close();
      done();
    });
  });

  it('should only allow objects as adapter', function(){
    var srv = http();
    var primus = server(srv, opts);
    var msg = 'Adapter should be an object';
    srv.listen(function(){
      try {
        primus.adapter('not valid');
      } catch (e) {
        expect(e.message).to.be(msg);
      }

      try {
        primus.adapter(function(){});
      } catch (e) {
        expect(e.message).to.be(msg);
      }

      try {
        primus.adapter(123456);
      } catch (e) {
        return expect(e.message).to.be(msg);
      }

      throw new Error('I should have throwed above');
    });
  });

  it('should remove client from room on client disconnect', function(done){
    this.timeout(0);
    var srv = http();
    var primus = server(srv, opts);
    srv.listen(function(){
      var c1 = client(srv, primus);
      primus.on('connection', function(spark){
        spark.join('a');
        spark.on('end', function () {        
          expect(spark.rooms()).to.be.empty();
          srv.close();
          done();
        });
        spark.write('end');
      });
      c1.on('open', function () {
        c1.on('data', function (data) {
          if ('end' === data) c1.end();
        });
      });
    });
  });

  it('should get all clients connected to a room using primus method', function(done){
    var ids = [];
    var srv = http();
    var primus = server(srv, opts);
    srv.listen(function(){
      primus.on('connection', function(spark){
        ids.push(spark.id);
        primus.join(spark, 'room1');
        spark.on('data', function (){
          primus.room('room1').clients(function (err, clients) {
            expect(clients).to.be.eql(ids);
            srv.close();
            done();
          });
        });
      });
      client(srv, primus);
      client(srv, primus);
      client(srv, primus);
      client(srv, primus)
      .write('send');
    });
  });

  it('should get all clients synchronously if no callback is provided using primus method', function(done){
    var ids = [];
    var srv = http();
    var primus = server(srv, opts);
    srv.listen(function(){
      primus.on('connection', function(spark){
        ids.push(spark.id);
        primus.join(spark, 'room1');
        spark.on('data', function (){
          var clients = primus.in('room1').clients();
          expect(clients).to.be.eql(ids);
          srv.close();
          done();
        });
      });
      client(srv, primus);
      client(srv, primus);
      client(srv, primus);
      client(srv, primus)
      .write('send');
    });
  });

  it('should join spark to a room using primus method', function(done){
    var srv = http();
    var primus = server(srv, opts);
    srv.listen(function(){
      primus.on('connection', function(spark){
        primus.join(spark, 'room1', function () {
          spark.room('room1').clients(function (err, clients) {
            expect(!!~clients.indexOf(spark.id)).to.eql(true);
            srv.close();
            done();
          });
        });
      });
      client(srv, primus);
    });
  });

  it('should remove spark form room using primus method', function(done){
    var srv = http();
    var primus = server(srv, opts);
    srv.listen(function(){
      primus.on('connection', function(spark){
        primus.join(spark, 'room1', function () {
          primus.leave(spark, 'room1', function () {
            spark.room('room1').clients(function (err, clients) {
              expect(!!~clients.indexOf(spark.id)).to.eql(false);
              srv.close();
              done();
            });
          });
        });
      });
      client(srv, primus);
    });
  });

  it('should broadcast message to specific room from primus usin `room`', function(done){

    var srv = http();
    var total = 2;
    var primus = server(srv, opts);
    srv.listen(function(){
      var count = 1;
      var c1 = client(srv, primus);
      var c2 = client(srv, primus);
      var c3 = client(srv, primus);

      primus.on('connection', function(spark){
        spark.on('data', function (data) {
          primus.join(spark, data, function () {
            if (3 === count++) {
              primus.room('a').write('hi');
            }
          });
        });
      });

      c1.write('a');
      c2.write('a');
      c3.write('b');

      c1.on('data', function (data) {
        expect('hi' === data);
        --total || finish();
      });

      c2.on('data', function (data) {
        expect('hi' === data);
        --total || finish();
      });

      c3.on('data', function (data) {
        expect('hi' === data);
        --total || finish(new Error('Should not get message'));
      });

      function finish (err) {
        done(err);
        srv.close();
      }
      
    });
  });

  it('should broadcast message to multiple rooms from primus usin `room` method', function(done){

    var srv = http();
    var total = 2;
    var primus = server(srv, opts);
    srv.listen(function(){
      var count = 1;
      var c1 = client(srv, primus);
      var c2 = client(srv, primus);
      var c3 = client(srv, primus);

      primus.on('connection', function(spark){
        spark.on('data', function (data) {
          primus.join(spark, data, function () {
            if (3 === count++) {
              primus.room('a b').write('hi');
            }
          });
        });
      });

      c1.write('a');
      c2.write('b');
      c3.write('c');

      c1.on('data', function (data) {
        expect('hi' === data);
        --total || finish();
      });

      c2.on('data', function (data) {
        expect('hi' === data);
        --total || finish();
      });

      c3.on('data', function (data) {
        expect('hi' === data);
        --total || finish(new Error('Should not get message'));
      });

      function finish (err) {
        done(err);
        srv.close();
      }
      
    });
  });

  it('should trigger `joinroom` event when joining room', function(done){
    var srv = http();
    var primus = server(srv, opts);
    srv.listen(function(){
      primus.on('connection', function(spark){
        spark.join('room1');
        spark.on('joinroom', function (room) {
          expect(room).to.be.eql('room1');
          srv.close();
          done();
        });
      });
      client(srv, primus);
    });
  });

  it('should trigger `leaveroom` event when leaving room', function(done){
    var srv = http();
    var primus = server(srv, opts);
    srv.listen(function(){
      primus.on('connection', function(spark){
        spark.join('room1', function () {
          spark.leave('room1');
          spark.on('leaveroom', function (room) {
            expect(room).to.be.eql('room1');
            srv.close();
            done();
          });
        });
      });
      client(srv, primus);
    });
  });

  it('should trigger `leaveallrooms` events on client disconnect', function(done){
    this.timeout(0);
    var srv = http();
    var primus = server(srv, opts);
    srv.listen(function(){
      var c1 = client(srv, primus);
      primus.on('connection', function(spark){
        spark.join('a');
        spark.on('leaveallrooms', function (rooms) {
          expect(rooms).to.be.eql(['a']);
          srv.close();
          done();
        });
        spark.write('end');
      });
      c1.on('open', function () {
        c1.on('data', function (data) {
          if ('end' === data) c1.end();
        });
      });
    });
  });

  it('should trigger `joinroom` event when joining room using primus join method', function(done){
    var srv = http();
    var primus = server(srv, opts);
    srv.listen(function(){
      primus.on('connection', function(spark){
        primus.join(spark, 'room1');
        primus.on('joinroom', function (room, socket) {
          expect(room).to.be.eql('room1');
          expect(spark).to.be.eql(socket);
          srv.close();
          done();
        });
      });
      client(srv, primus);
    });
  });

  it('should trigger `leaveroom` event when leaving room using primus leave method', function(done){
    var srv = http();
    var primus = server(srv, opts);
    srv.listen(function(){
      primus.on('connection', function(spark){
        primus.join(spark, 'room1', function () {
          primus.leave(spark, 'room1');
          primus.on('leaveroom', function (room, socket) {
            expect(room).to.be.eql('room1');
            expect(spark).to.be.eql(socket);
            srv.close();
            done();
          });
        });
      });
      client(srv, primus);
    });
  });

  it('should trigger `leaveallrooms` events on client disconnect when listening on primus', function(done){
    this.timeout(0);
    var srv = http();
    var primus = server(srv, opts);
    srv.listen(function(){
      var c1 = client(srv, primus);
      primus.on('connection', function(spark){
        primus.join(spark, 'a');
        primus.on('leaveallrooms', function (rooms, socket) {
          expect(rooms).to.be.eql(['a']);
          expect(spark).to.be.eql(socket);
          srv.close();
          done();
        });
        spark.write('end');
      });
      c1.on('open', function () {
        c1.on('data', function (data) {
          if ('end' === data) c1.end();
        });
      });
    });
  });

  describe('primus-emitter', function (){

    it('should allow sending to single room from client', function(done){

      var srv = http();
      var primus = server(srv, opts);
      primus.use('emitter', 'primus-emitter');

      srv.listen(function(){
        var c1 = client(srv, primus);
        var c2 = client(srv, primus);
        var c3 = client(srv, primus);

        primus.on('connection', function(spark){
          spark.on('data', function (room) {
            if ('broadcast' === room) {
              spark.room('room1').send('news');
              return;
            }
            spark.join(room);
          });
        });

        c1.on('news', function (data) {
          finish();
        });

        c2.on('news', function (data) {
          finish(new Error('not'));
        });

        c3.on('news', function (data) {
          finish(new Error('not'));
        });

        function finish (data) {
          srv.close();
          done(data);
        }

        c1.write('room1');
        c2.write('room2');

        setTimeout(function () {
          c3.write('broadcast');
        }, 100);

      });
    });

    it('should allow sending to a single room from server', function(done){
      var srv = http();
      var primus = server(srv, opts);
      primus.use('emitter', 'primus-emitter');
      srv.listen(function(){
        var c1 = client(srv, primus);
        primus.on('connection', function(spark){
          spark.join('room1', function () {
            primus.room('room1').send('news');
          });
        });
        c1.on('news', function (data) {
          srv.close();
          done();
        });
      });
    });

    it('should allow sending to multiple rooms from client', function(done){
      //this.timeout(0);
      var srv = http();
      var primus = server(srv, opts);
      var total = 2;
      var count = 0;
      primus.use('emitter', 'primus-emitter');

      srv.listen(function(){

        var c1 = client(srv, primus);
        var c2 = client(srv, primus);
        var c3 = client(srv, primus);
        var c4 = client(srv, primus);

        primus.on('connection', function(spark){
          spark.on('join', function (room) {
            spark.join(room, function () {
              if (3 === count++) {
                spark.room('room1 room2 room3').send('news');
              }
            });
          });
        });

        c1.on('news', function (data) {
          --total || finish();
        });

        c2.on('news', function (data) {
          --total || finish();
        });

        c3.on('news', function (data) {
          --total || finish();
        });

        c4.on('news', function (data) {
          finish(new Error('not'));
        });

        function finish (data) {
          srv.close();
          done(data);
        }

        c1.send('join','room1');
        c2.send('join','room2');
        c3.send('join','room3');
        c4.send('join','room4');

      });
    });

    it('should allow sending to multiple rooms from server', function(done){
      //this.timeout(0);
      var srv = http();
      var primus = server(srv, opts);
      var total = 2;
      var count = 0;
      primus.use('emitter', 'primus-emitter');

      srv.listen(function(){

        var c1 = client(srv, primus);
        var c2 = client(srv, primus);
        var c3 = client(srv, primus);
        var c4 = client(srv, primus);

        primus.on('connection', function(spark){
          spark.on('join', function (room) {
            spark.join(room, function () {
              if (3 === count++) {
                primus.room('room1 room2 room3').send('news');
              }
            });
          });
        });

        c1.on('news', function (data) {
          --total || finish();
        });

        c2.on('news', function (data) {
          --total || finish();
        });

        c3.on('news', function (data) {
          --total || finish();
        });

        c4.on('news', function (data) {
          finish(new Error('not'));
        });

        function finish (data) {
          srv.close();
          done(data);
        }

        c1.send('join','room1');
        c2.send('join','room2');
        c3.send('join','room3');
        c4.send('join','room4');

      });
    });
  });
});