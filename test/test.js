var Primus = require('primus');
var Rooms = require('../');
var http = require('http').Server;
var expect = require('expect.js');
var opts = { transformer: 'sockjs', parser: 'JSON' };


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
        expect(spark.rooms()).to.eql([]);
        done();
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
          if ('send' === data); done();
        });
      });
      c1.write('send');
    });
  });

  it('should allow sending to multiple rooms', function(done){
    this.timeout(0);
    var srv = http();
    var primus = server(srv, opts);
    var total = 3;
    srv.listen(function(){

      var c1 = client(srv, primus);
      var c2 = client(srv, primus);
      var c3 = client(srv, primus);
      var c4 = client(srv, primus);
      var c5 = client(srv, primus);

      primus.on('connection', function(spark){
        spark.on('data', function (data) {
          spark.join(data);
          if (data === 'send') {
            spark.leave('send');
            spark.room('room1 room2 room3 room4').write('a');
          }
        });
      });

      c1.on('data', function (data) {
        done(new Error('not'));
      });

      c2.on('data', function (data) {
        --total || done();
      });

      c3.on('data', function (data) {
        --total || done();
      });

      c4.on('data', function (data) {
        --total || done();
      });

      c5.on('data', function (data) {
        done(new Error('not'));
      });

      c1.write('room1');
      c2.write('room1');
      c2.write('room2');
      c3.write('room3');
      c4.write('room4');
      c5.write('room5');

      setTimeout(function() {
        c1.write('send');
      }, 50);

    });
  });

  it('should avoid sending dupes', function(done){
    this.timeout(0);
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
        --total || done();
      });

      c3.on('data', function (data) {
        expect('a' === data);
        --total || done();
      });

      setTimeout(function() {
        c1.write('send');
      }, 50);
    });
  });

  it('should get all clients(id) connected to a room', function(done){
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
              done();
            });
          });
        });
      });
    });
  });
});