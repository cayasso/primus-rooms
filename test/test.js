describe('primus-rooms', function () {

  var expect = require('expect.js');
  var http = require('http');
  var opts = { transformer: 'websockets' };
  var Primus = require('primus');
  var Rooms = require('../');
  var sinon = require('sinon');
  var port = 3000;
  var timeout = 50;
  var primus;
  var server;

  // Creates the client
  function createClient(port) {
    var addr = server.address();
    var url = 'http://' + addr.address + ':' + (port || addr.port);
    return new primus.Socket(url);
  }

  beforeEach(function beforeEach(done) {
    server = http.createServer();
    primus = new Primus(server, opts);
    primus.use('rooms', Rooms);
    server.listen(port, done);
  });

  afterEach(function afterEach(done) {
    primus.end({close: false}); // Close all active connections
    server.close(done);
  });

  it('should have required methods', function(done){
    primus.on('connection', function (spark) {
      expect(spark.join).to.be.a('function');
      expect(spark.leave).to.be.a('function');
      expect(spark.leaveAll).to.be.a('function');
      expect(spark.room).to.be.a('function');
      expect(spark.rooms).to.be.a('function');
      expect(spark.clients).to.be.a('function');
      done();
    });
    createClient();
  });

  it('should join room', function(done){
    primus.on('connection', function(spark){
      spark.join('room1');
      spark.room('room1').clients(function (err, clients) {
        expect(!!~clients.indexOf(spark.id)).to.eql(true);
        done();
      });
    });
    createClient();
  });
  
  it('should join multiple rooms at once', function(done){
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
    createClient();
  });

  it('should join multiple rooms at once passing an array as argument', function(done){
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
    createClient();
  });

  it('should leave room', function(done){
    primus.on('connection', function(spark){
      spark.join('room1');
      spark.leave('room1');
      spark.room('room1').clients(function (err, clients) {
        expect(!!~clients.indexOf(spark.id)).to.eql(false);
        done();
      });
    });
    createClient();
  });
  
  it('should leave multiple rooms at once', function(done){
    primus.on('connection', function(spark){
      spark.join('room1 room2 room3 room4', function () {
        spark.leave('room1 room2 room3', function(){
          expect(spark.rooms()).to.eql(['room4']);
          done();
        });
      });
    });
    createClient();
  });

  it('should leave multiple rooms at once passing an array', function(done){
    primus.on('connection', function(spark){
      spark.join('room1 room2 room3 room4', function () {
        spark.leave(['room1', 'room2', 'room3'], function(){
          expect(spark.rooms()).to.be.eql(['room4']);
          done();
        });
      });
    });
    createClient();
  });

  it('should leave all rooms', function(done){
    primus.on('connection', function(spark){
      spark.join('room1');
      spark.join('room2');
      spark.join('room3');
      spark.leaveAll();
      expect(spark.rooms()).to.be.eql([]);
      done();
    });
    createClient();
  });

  it('should cleanup room on leave', function(done){
    primus.on('connection', function(spark){
      spark.join('room1');
      spark.leave('room1');
      expect(spark.primus.adapter().rooms).to.be.empty();
      done();
    });
    createClient();
  });

  it('should cleanup rooms on leave all', function(done){
    primus.on('connection', function(spark){
      spark.join('room1');
      spark.join('room2');
      spark.join('room3');
      spark.leaveAll();
      expect(spark.primus.adapter().rooms).to.be.empty();
      done();
    });
    createClient();
  });

  it('should allow method channing', function(done){
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
        done();
      });
    });
    createClient();
  });

  it('should allow simple connection', function(done){
    var c1 = createClient();
    
    primus.on('connection', function(spark){
      spark.on('data', function (data) {
        spark.write(data);
      });
    });

    c1.on('open', function () {
      c1.on('data', function (data) {
        if ('send' === data) {
          done();
        }
      });
    });
    c1.write('send');
  });

  it('should allow sending to multiple rooms', function(done){
    var count = 0;
    var c1 = createClient();
    var c2 = createClient();
    var c3 = createClient();
    var c4 = createClient();
    var spy1 = sinon.spy();
    var spy2 = sinon.spy();
    var spy3 = sinon.spy();
    var stub = sinon.stub().throws(new Error('Should not get message'));

    primus.on('connection', function(spark){
      spark.on('data', function (data) {
        spark.join(data, function () {
          ++count;
          if (4 === count) {
            spark.room('room1 room2 room3').write('a');
            setTimeout(function() {
              expect(spy1.callCount).to.be(1);
              expect(spy1.calledWith('a')).to.be(true);
              expect(spy2.callCount).to.be(1);
              expect(spy2.calledWith('a')).to.be(true);
              expect(spy3.callCount).to.be(1);
              expect(spy3.calledWith('a')).to.be(true);
              done();
            }, timeout);
          }
        });
      });
    });

    c1.on('data', spy1);
    c2.on('data', spy2);
    c3.on('data', spy3);
    c4.on('data', stub);

    c1.write('room1');
    c2.write('room2');
    c3.write('room3');
    c4.write('room4');
  });

  it('should avoid sending dupes', function(done){
    var c1 = createClient();
    var c2 = createClient();
    var c3 = createClient();
    var spy1 = sinon.spy();
    var spy2 = sinon.spy();

    primus.on('connection', function(spark){
      spark.join('room1');
      spark.join('room2');
      spark.join('room3');
      spark.on('data', function (data) {
        spark.room('room1 room2 room3').write('a');
        setTimeout(function() {
          expect(spy1.callCount).to.be(1);
          expect(spy1.calledWith('a')).to.be(true);
          expect(spy2.callCount).to.be(1);
          expect(spy2.calledWith('a')).to.be(true);
          done();
        }, timeout);
      });
    });

    c2.on('data', spy1);
    c3.on('data', spy2);

    c1.write('send');
  });

  it('should get all clients connected to a room', function(done){
    var ids = [];
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
    createClient();
    createClient();
    createClient();
    createClient().write('send');
  });

  it('should get all clients synchronously if no callback is provided', function(done){
    var ids = [];
    primus.on('connection', function(spark){
      ids.push(spark.id);
      spark.join('room1');
      spark.on('data', function (){
        var clients = spark.room('room1').clients();
        expect(clients).to.be.eql(ids);
        done();
      });
    });
    createClient();
    createClient();
    createClient();
    createClient().write('send');
  });

  it('should keeps track of rooms', function(done){
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
    createClient();
  });

  it('should allow passing adapter as argument', function(done){
    opts.adapter = {
      add: function (){},
      del: function (){},
      delAll: function (){},
      broadcast: function (){},
      clients: function (){}
    };
    primus.end();
    server = http.createServer();
    primus = new Primus(server, opts).use('rooms', Rooms);
    expect(primus.adapter()).to.be.eql(opts.adapter);
    delete opts.adapter;
    server.listen(port);
    done();
  });

  it('should allow setting and getting adapter', function(done){
    var adapter = {
      add: function (){},
      del: function (){},
      delAll: function (){},
      broadcast: function (){},
      clients: function (){}
    };
    primus.end();
    server = http.createServer();
    primus = new Primus(server, opts).use('rooms', Rooms);
    primus.adapter(adapter);
    expect(primus.adapter()).to.be.eql(adapter);
    server.listen(port);
    done();
  });

  it('should only allow objects as adapter', function(){
    var msg = 'Adapter should be an object';
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

  it('should remove client from room on client disconnect', function(done){
    var c1 = createClient();
    primus.on('connection', function(spark){
      spark.join('a');
      spark.on('end', function () {
        expect(spark.rooms()).to.be.empty();
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

  it('should get all clients connected to a room using primus method', function(done){
    var ids = [];
    primus.on('connection', function(spark){
      ids.push(spark.id);
      primus.join(spark, 'room1');
      spark.on('data', function (){
        primus.room('room1').clients(function (err, clients) {
          expect(clients).to.be.eql(ids);
          done();
        });
      });
    });
    createClient();
    createClient();
    createClient();
    createClient().write('send');
  });

  it('should get all clients synchronously if no callback is provided using primus method', function(done){
    var ids = [];
    primus.on('connection', function(spark){
      ids.push(spark.id);
      primus.join(spark, 'room1');
      spark.on('data', function (){
        var clients = primus.in('room1').clients();
        expect(clients).to.be.eql(ids);
        done();
      });
    });
    createClient();
    createClient();
    createClient();
    createClient().write('send');
  });

  it('should join spark to a room using primus method', function(done){
    primus.on('connection', function(spark){
      primus.join(spark, 'room1', function () {
        spark.room('room1').clients(function (err, clients) {
          expect(!!~clients.indexOf(spark.id)).to.eql(true);
          done();
        });
      });
    });
    createClient();
  });

  it('should remove spark from room using primus method', function(done){
    primus.on('connection', function(spark){
      primus.join(spark, 'room1', function () {
        primus.leave(spark, 'room1', function () {
          spark.room('room1').clients(function (err, clients) {
            expect(!!~clients.indexOf(spark.id)).to.eql(false);
            done();
          });
        });
      });
    });
    createClient();
  });

  it('should broadcast message to specific room from primus using `room`', function(done){
    var count = 0;
    var c1 = createClient();
    var c2 = createClient();
    var c3 = createClient();
    var spy1 = sinon.spy();
    var spy2 = sinon.spy();
    var stub = sinon.stub().throws(new Error('Should not get message'));

    primus.on('connection', function(spark){
      spark.on('data', function (data) {
        primus.join(spark, data, function () {
          ++count;
          if (3 === count) {
            primus.room('a').write('hi');
            setTimeout(function() {
              expect(spy1.callCount).to.be(1);
              expect(spy1.calledWith('hi')).to.be(true);
              expect(spy2.callCount).to.be(1);
              expect(spy2.calledWith('hi')).to.be(true);
              done();
            }, timeout);
          }
        });
      });
    });

    c1.on('data', spy1);
    c2.on('data', spy2);
    c3.on('data', stub);

    c1.write('a');
    c2.write('a');
    c3.write('b');
  });

  it('should broadcast message to multiple rooms from primus using `room` method', function(done){
    var count = 0;
    var c1 = createClient();
    var c2 = createClient();
    var c3 = createClient();
    var spy1 = sinon.spy();
    var spy2 = sinon.spy();
    var stub = sinon.stub().throws(new Error('Should not get message'));

    primus.on('connection', function(spark){
      spark.on('data', function (data) {
        primus.join(spark, data, function () {
          ++count;
          if (3 === count) {
            primus.room('a b').write('hi');
            setTimeout(function() {
              expect(spy1.callCount).to.be(1);
              expect(spy1.calledWith('hi')).to.be(true);
              expect(spy2.callCount).to.be(1);
              expect(spy2.calledWith('hi')).to.be(true);
              done();
            }, timeout);
          }
        });
      });
    });

    c1.on('data', spy1);
    c2.on('data', spy2);
    c3.on('data', stub);

    c1.write('a');
    c2.write('b');
    c3.write('c');
  });

  it('should trigger `joinroom` event when joining room', function(done){
    primus.on('connection', function(spark){
      spark.join('room1');
      spark.on('joinroom', function (room) {
        expect(room).to.be.eql('room1');
        done();
      });
    });
    createClient();
  });

  it('should trigger `leaveroom` event when leaving room', function(done){
    primus.on('connection', function(spark){
      spark.join('room1', function () {
        spark.leave('room1');
        spark.on('leaveroom', function (room) {
          expect(room).to.be.eql('room1');
          done();
        });
      });
    });
    createClient();
  });

  it('should trigger `leaveallrooms` events on client disconnect', function(done){
    var c1 = createClient();
    primus.on('connection', function(spark){
      spark.join('a');
      spark.on('leaveallrooms', function (rooms) {
        expect(rooms).to.be.eql(['a']);
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

  it('should trigger `joinroom` event when joining room using primus join method', function(done){
    primus.on('connection', function(spark){
      primus.join(spark, 'room1');
      primus.on('joinroom', function (room, socket) {
        expect(room).to.be.eql('room1');
        expect(spark).to.be.eql(socket);
        done();
      });
    });
    createClient();
  });

  it('should trigger `leaveroom` event when leaving room using primus leave method', function(done){
    primus.on('connection', function(spark){
      primus.join(spark, 'room1', function () {
        primus.leave(spark, 'room1');
        primus.on('leaveroom', function (room, socket) {
          expect(room).to.be.eql('room1');
          expect(spark).to.be.eql(socket);
          done();
        });
      });
    });
    createClient();
  });

  it('should trigger `leaveallrooms` events on client disconnect when listening on primus', function(done){
    var c1 = createClient();
    primus.on('connection', function(spark){
      primus.join(spark, 'a');
      primus.on('leaveallrooms', function (rooms, socket) {
        expect(rooms).to.be.eql(['a']);
        expect(spark).to.be.eql(socket);
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

  describe('primus-emitter', function (){

    it('should allow sending to single room from client', function(done){
      primus.use('emitter', 'primus-emitter');
      var c1 = createClient();
      var c2 = createClient();
      var c3 = createClient();
      var spy1 = sinon.spy();
      var stub1 = sinon.stub().throws(new Error('Should not get message'));
      var stub2 = sinon.stub().throws(new Error('Should not get message'));

      primus.on('connection', function(spark){
        spark.on('data', function (room) {
          if ('broadcast' === room) {
            spark.room('room1').send('news');
            setTimeout(function() {
              expect(spy1.callCount).to.be(1);
              done();
            }, timeout);
            return;
          }
          spark.join(room);
        });
      });

      c1.on('news', spy1);
      c2.on('news', stub1);
      c3.on('news', stub2);

      c1.write('room1');
      c2.write('room2');
      c3.write('broadcast');
    });

    it('should allow sending to a single room from server', function(done){
      primus.use('emitter', 'primus-emitter');
      var c1 = createClient();
      primus.on('connection', function(spark){
        spark.join('room1', function () {
          primus.room('room1').send('news');
        });
      });
      c1.on('news', function (data) {
        done();
      });
    });

    it('should allow sending to multiple rooms from client', function(done){
      primus.use('emitter', 'primus-emitter');
      var count = 0;
      var c1 = createClient();
      var c2 = createClient();
      var c3 = createClient();
      var c4 = createClient();
      var spy1 = sinon.spy();
      var spy2 = sinon.spy();
      var spy3 = sinon.spy();
      var stub = sinon.stub().throws(new Error('Should not get message'));

      primus.on('connection', function(spark){
        spark.on('join', function (room) {
          spark.join(room, function () {
            ++count;
            if (4 === count) {
              spark.room('room1 room2 room3').send('news');
              setTimeout(function() {
                expect(spy1.callCount).to.be(1);
                expect(spy2.callCount).to.be(1);
                expect(spy3.callCount).to.be(1);
                done();
              }, timeout);
            }
          });
        });
      });

      c1.on('news', spy1);
      c2.on('news', spy2);
      c3.on('news', spy3);
      c4.on('news', stub);

      c1.send('join','room1');
      c2.send('join','room2');
      c3.send('join','room3');
      c4.send('join','room4');
    });

    it('should allow sending to multiple rooms from server', function(done){
      primus.use('emitter', 'primus-emitter');
      var count = 0;
      var c1 = createClient();
      var c2 = createClient();
      var c3 = createClient();
      var c4 = createClient();
      var spy1 = sinon.spy();
      var spy2 = sinon.spy();
      var spy3 = sinon.spy();
      var stub = sinon.stub().throws(new Error('Should not get message'));

      primus.on('connection', function(spark){
        spark.on('join', function (room) {
          spark.join(room, function () {
            ++count;
            if (4 === count) {
              primus.room('room1 room2 room3').send('news');
              setTimeout(function() {
                expect(spy1.callCount).to.be(1);
                expect(spy2.callCount).to.be(1);
                expect(spy3.callCount).to.be(1);
                done();
              }, timeout);
            }
          });
        });
      });

      c1.on('news', spy1);
      c2.on('news', spy2);
      c3.on('news', spy3);
      c4.on('news', stub);

      c1.send('join','room1');
      c2.send('join','room2');
      c3.send('join','room3');
      c4.send('join','room4');
    });

    it('should allow sending to all clients from server', function(done){
      primus.use('emitter', 'primus-emitter');
      var count = 0;
      var c1 = createClient();
      var c2 = createClient();
      var c3 = createClient();
      var spy1 = sinon.spy();
      var spy2 = sinon.spy();
      var spy3 = sinon.spy();

      primus.on('connection', function(spark){
        ++count;
        spark.join('room' + count);
        if (3 === count) {
          primus.send('news');
          setTimeout(function() {
            expect(spy1.callCount).to.be(1);
            expect(spy2.callCount).to.be(1);
            expect(spy3.callCount).to.be(1);
            done();
          }, timeout);
        }
      });

      c1.on('news', spy1);
      c2.on('news', spy2);
      c3.on('news', spy3);
    });
  });
});
