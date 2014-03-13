'use strict';

var rooms = require('../')
  , Primus = require('primus')
  //, redis = require('redis')
  , http = require('http').Server
  , expect = require('expect.js')
  , port = 1111
  , opts = {
      transformer: 'websockets',
      /*redis: {
        createClient: redis.createClient.bind(redis),
        rooms: {
          ttl: 2000 // Optional, defaults to `86400000` (one day).
        }
      }*/
    }
  , srv, primus;

// port getter
Object.defineProperty(client, 'port', {
  get: function () {
    return port++;
  }
});

// creates the client
function client(srv, primus, port){
  var addr = srv.address()
    , url = 'http://' + addr.address + ':' + (port || addr.port);
  return new primus.Socket(url);
}

// creates the server
function server(srv, opts) {
  return new Primus(srv, opts)
    .use('rooms', rooms)
    //.use('redis', 'primus-redis');
}

describe('primus-rooms', function () {

  beforeEach(function beforeEach(done) {
    srv = http();
    primus = server(srv, opts);
    //primus.adapter().client.del('primus', function(){
      done();
    //});
  });

  afterEach(function afterEach(done) {
    if (primus.ignore)
      srv.close();
    else
      primus.end();

    //done();


    //primus.adapter().client.del('primus', function(){
      done();
    //});

  });

  it('should have required methods', function (done) {
    srv.listen(client.port, function () {
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

  it('should join room', function (done) {
    srv.listen(client.port, function () {
      primus.on('connection', function (spark) {
        spark.join('room1');
        spark.room('room1').clients(function (err, clients) {
          expect(clients).to.contain(spark.id);
          spark.join(1);
          spark.room(1).clients(function (err, clients) {
            expect(clients).to.contain(spark.id);
            spark.leaveAll(done);
          });
        });
      });
      client(srv, primus);
    });
  });
    
  it('should join multiple rooms at once', function (done) {
    srv.listen(client.port, function () {
      primus.on('connection', function (spark) {
        spark.join('room1 room2 room3', function () {
          spark.room('room1').clients(function (err, clients) {
            expect(!!~clients.indexOf(spark.id)).to.be.ok();
            spark.room('room2').clients(function (err, clients) {
              expect(!!~clients.indexOf(spark.id)).to.be.ok();
              spark.room('room3').clients(function (err, clients) {
                expect(!!~clients.indexOf(spark.id)).to.be.ok();
                spark.leaveAll(done);
              });
            });
          });
        });
      });
      client(srv, primus);
    });
  });

  it('should join multiple rooms at once passing an array as argument', function (done) {
    srv.listen(client.port, function () {
      primus.on('connection', function (spark) {
        spark.join([1, 'room2', 'room3'], function () {
          spark.room(1).clients(function (err, clients) {
            expect(clients).to.contain(spark.id);
            spark.room('room2').clients(function (err, clients) {
              expect(clients).to.contain(spark.id);
              spark.room('room3').clients(function (err, clients) {
                expect(clients).to.contain(spark.id);
                spark.leaveAll(done);
              });
            });
          });
        });
      });
      client(srv, primus);
    });
  });

  it('should leave room', function (done) {
    srv.listen(client.port, function () {
      primus.on('connection', function (spark) {
        spark.join('room1');
        spark.leave('room1');
        spark.room('room1').clients(function (err, clients) {
          expect(!!~clients.indexOf(spark.id)).to.eql(false);
          spark.leaveAll(done);
        });
      });
      client(srv, primus);
    });
  });

  it('should leave multiple rooms at once', function (done) {
    srv.listen(client.port, function () {
      primus.on('connection', function (spark) {
        spark.join('room1 room2 room3 room4', function () {
          spark.leave('room1 room2 room3', function () {
            spark.rooms(function (err, rooms) {
              expect(rooms).to.eql(['room4']);
              spark.leaveAll(done);
            });
          });
        });
      });
      client(srv, primus);
    });
  });

  it('should leave multiple rooms at once passing an array', function (done) {
    srv.listen(client.port, function () {
      primus.on('connection', function (spark) {
        spark.join('1 room2 room3 room4', function () {
          spark.leave([1, 'room2', 'room3'], function () {
            spark.rooms(function (err, rooms) {
              expect(rooms).to.eql(['room4']);
              spark.leaveAll(done);
            });
          });
        });
      });
      client(srv, primus);
    });
  });

  it('should leave all rooms', function (done) {
    srv.listen(client.port, function () {
      primus.on('connection', function (spark) {
        spark.join('room1', function (err) {
          if (err) return done(err);
          spark.join('room2', function (err) {
            if (err) return done(err);
            spark.join('room3', function (err) {
              if (err) return done(err);
              spark.leaveAll(function (err) {
                if (err) return done(err);
                spark.rooms(function (err, rooms) {
                  if (err) return done(err);
                  expect(rooms).to.eql([]);
                  done();
                });
              });
            });
          });
        });
      });
      client(srv, primus);
    });
  });

  // ROOMS DOESNT EXIST
  it('should cleanup room on leave', function (done) {
    srv.listen(function () {
      if (!primus.adapter.rooms) done();
      primus.on('connection', function (spark) {
        spark.join('room1', function (err) {
          if (err) return done(err);
          spark.leave('room1', function (err) {
            if (err) return done(err);
            expect(spark._rooms.adapter.rooms).to.be.empty();
            done();
          });
        });
      });
      client(srv, primus);
    });
  });

  it('should cleanup rooms on leave all', function (done) {
    srv.listen(function () {
      if (!primus.adapter.rooms) done();
      primus.on('connection', function (spark) {
        spark.join('room1', function (err) {
          if (err) return done(err);
          spark.join('room2', function (err) {
            if (err) return done(err);
            spark.join('room3', function (err) {
              if (err) return done(err);
              spark.leaveAll(function (err) {
                if (err) return done(err);
                spark.rooms(function (err, rooms) {
                  if (err) return done(err);
                  expect(spark._rooms.adapter.rooms).to.be.empty();
                  done();
                });
              });
            });
          });
        });
      });
      client(srv, primus);
    });
  });

  it('should allow method channing', function (done) {
    srv.listen(client.port, function () {
      primus.on('connection', function (spark) {
        spark
        .join('room1')
        .join('room2')
        .join('room3')
        .leave('room1')
        .leave('room2')
        .leave('room3');
        process.nextTick(function () {
          spark.rooms(function (err, rooms) {
            if (err) return done(err);
            expect(rooms).to.eql([]);
            done();
          });
        });
      });
      client(srv, primus);
    });
  });

  it('should allow simple connection', function (done) {
    srv.listen(client.port, function () {
      var c1 = client(srv, primus);
      primus.on('connection', function (spark) {
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
  });

  it('should allow sending to multiple rooms', function (done) {
    
    var total = 0
      , sender;

    srv.listen(client.port, function () {
      primus.on('connection', function (spark) {
        spark.on('data', function (data) {
          if ('send' === data) {
            sender = spark;
          }
          spark.join(data, function () {
            if (4 === ++total) {
              --total;
              sender.room([1, 'room2', 'room3']).write('hi');
            }
          });
        });
      });

      var c1 = client(srv, primus)
        , c2 = client(srv, primus)
        , c3 = client(srv, primus)
        , c4 = client(srv, primus);

      c1.on('data', function (msg) {
        expect(msg).to.be('hi');
        finish();
      });

      c2.on('data', function (msg) {
        expect(msg).to.be('hi');
        finish();
      });

      c3.on('data', function (msg) {
        expect(msg).to.be('hi');
        finish();
      });

      c4.on('data', function (msg) {
        done(new Error('not'));
      });

      function finish () {
        if (1 > --total) {
          primus.empty('1 room2 room3 send', done);
        }
      }
      
      c1.write(1);
      c2.write('room2');
      c3.write('room3');
      c4.write('send');
    });
  });

  it('should allow defining exception ids when broadcasting', function (done) {
    
    var total = 0
      , sender
      , except = [];

    srv.listen(client.port, function () {

      primus.on('connection', function (spark) {
        spark.on('data', function (data) {
          if (/room1|room2/.test(data)) {
            except.push(spark.id);
          }          
          if ('send' === data) {
            sender = spark;
          }
          spark.join(data, function () {
            if (4 === ++total) {
              sender.room('room1 room2 room3').except(except).write('hi');
            }
          });
        });
      });

      var c1 = client(srv, primus)
        , c2 = client(srv, primus)
        , c3 = client(srv, primus)
        , c4 = client(srv, primus);

      c1.on('data', function (msg) {
        done(new Error('not'));
      });

      c2.on('data', function (msg) {
        done(new Error('not'));
      });

      c3.on('data', function (msg) {
        expect(msg).to.be('hi');
        primus.empty('room1 room2 room3', done);
      });

      c4.on('data', function (msg) {
        done(new Error('not'));
      });
      
      c1.write('room1');
      c2.write('room2');
      c3.write('room3');
      c4.write('send');
    });
  });

  it('should allow defining exception ids as string when broadcasting', function (done) {
    
    var total = 0
      , sender
      , except = [];

    srv.listen(client.port, function () {
      primus.on('connection', function (spark) {
        spark.on('data', function (data) {
          if (/room1|room2/.test(data)) {
            except.push(spark.id);
          }          
          if ('send' === data) {
            sender = spark;
          }
          spark.join(data, function () {
            if (4 === ++total) {
              sender.room('room1 room2 room3').except(except.join(' ')).write('hi');
            }
          });
        });
      });

      var c1 = client(srv, primus)
        , c2 = client(srv, primus)
        , c3 = client(srv, primus)
        , c4 = client(srv, primus);

      c1.on('data', function (msg) {
        done(new Error('not'));
      });

      c2.on('data', function (msg) {
        done(new Error('not'));
      });

      c3.on('data', function (msg) {
        expect(msg).to.be('hi');
        primus.empty('room1 room2 room3', done);
      });

      c4.on('data', function (msg) {
        done(new Error('not'));
      });
      
      c1.write('room1');
      c2.write('room2');
      c3.write('room3');
      c4.write('send');
    });
  });

  it('should allow defining exception ids when broadcasting from server', function (done) {
    
    var total = 0
      , sender
      , except = [];

    srv.listen(function () {
      primus.on('connection', function (spark) {
        spark.on('data', function (data) {
          if (/room1|room3/.test(data)) {
            except.push(spark.id);
          }          
          if ('send' === data) {
            sender = spark;
          }
          spark.join(data, function () {
            if (4 === ++total) {
              --total;
              primus.in('room1 room2 room3').except(except).write('hi');
            }
          });
        });
      });

      var c1 = client(srv, primus)
        , c2 = client(srv, primus)
        , c3 = client(srv, primus)
        , c4 = client(srv, primus);

      c1.on('data', function (msg) {
        done(new Error('not'));
      });

      c2.on('data', function (msg) {
        expect(msg).to.be('hi');
        primus.empty('room1 room2 room3', done);
      });

      c3.on('data', function (msg) {
        done(new Error('not'));
      });

      c4.on('data', function (msg) {
        done(new Error('not'));
      });
      
      c1.write('room1');
      c2.write('room2');
      c3.write('room3');
      c4.write('send');
    });
  });

  it('should avoid sending dupes', function (done) {

    var total = 2;

    srv.listen(function () {
      primus.on('connection', function (spark) {
        spark.join('room1');
        spark.join('room2');
        spark.join('room3');
        spark.join('room4');
        spark.on('data', function (data) {
          if ('send' === data) {
            spark.room('room1 room2 room3').write('hi');
          }
        });
      });

      var c1 = client(srv, primus)
        , c2 = client(srv, primus)
        , c3 = client(srv, primus);

      c2.on('data', function (msg) {
        expect(msg).to.be('hi');
        finish();
      });

      c3.on('data', function (msg) {
        expect(msg).to.be('hi');
        finish();
      });

      function finish () {
        if (1 > --total) {
          primus.empty('room1 room2 room3', done);
        }
      }

      setTimeout(function() {
        c1.write('send');
      }, 50);
    });
  });

  it('should not allow broadcasting from a destroyed spark', function (done) {
    srv.listen(client.port, function () {

      primus.ignore = true;
      var disconnected = false;
      
      primus.on('connection', function (spark) {
        spark.join('room1');
      });
      
      primus.on('disconnection', function (spark) {
        spark.room('room1').write('hola');
        if (!disconnected) {
          disconnected = true;
          primus.empty('room1', done);
        }
      });

      var c1 = client(srv, primus);
      
      c1.on('open', function () {
        var c2 = client(srv, primus);
        c2.on('open', c2.end);
      });

      c1.on('data', function () {
        done(new Error('not'));
      });
      
    });
  });

  it('should get all clients connected to a room', function (done) {
    var ids = [];
    srv.listen(function () {
      primus.on('connection', function (spark) {
        ids.push(spark.id);
        spark.join('news');
        spark.on('data', function () {
          spark.room('news').clients(function (err, clients) {
            expect(clients.sort()).to.be.eql(ids);
            primus.empty(['news'], function () {
              done();
            });
          });
        });
      });
      client(srv, primus);
      client(srv, primus);
      client(srv, primus);
      var c = client(srv, primus);

      setTimeout(function(){
        c.write('send');
      }, 200);
      
    });
  });

  it('should get all clients synchronously if no callback is provided', function (done) {
    var ids = [];
    srv.listen(function () {
      if (!primus.adapter.rooms) return done();
      primus.on('connection', function (spark) {
        ids.push(spark.id);
        spark.join('room1');
        spark.on('data', function () {
          var clients = spark.room('room1').clients();
          expect(clients.sort()).to.be.eql(ids);
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

  it('should check if a room is empty', function (done) {
    var sparks = [];
    srv.listen(function () {
      primus.on('connection', function (spark) {
        spark.join('room1', function () {
          sparks.push(spark);
        });
        spark.on('data', function () {
          sparks.forEach(function (s, i) {
            s.isRoomEmpty('room1', function (err, empty) {
              if (err) return done(err);
              expect(empty).to.be.eql(false);
              s.leave('room1', function (err) {
                if (err) return done(err);
                s.isRoomEmpty('room1', function (err, empty) {
                  if (err) return done(err);
                  if (3 === i) {
                    expect(empty).to.be.eql(true);
                    primus.empty(done);
                  }
                });
              });
            });
          });
        });
      });
      client(srv, primus);
      client(srv, primus);
      client(srv, primus);
      var cl = client(srv, primus);

      setTimeout(function () {
        cl.write('send');
      }, 10);
    });
  });

  it('should check if a room is empty from server', function (done) {
    var sparks = [];
    srv.listen(function () {
      primus.on('connection', function (spark) {
        spark.join('room1', function (err) {
          if (err) return done(err);
          sparks.push(spark);
        });
        spark.on('data', function () {
          sparks.forEach(function (s, i) {
            primus.isRoomEmpty('room1', function (err, empty) {
              if (err) return done(err);
              
              expect(empty).to.be.eql(false);

              s.leave('room1', function (err) {
                if (err) return done(err);
                primus.isRoomEmpty('room1', function (err, empty) {
                  if (err) return done(err);
                  if (3 === i) {
                    expect(empty).to.be.eql(true);
                    primus.empty(done);
                  }
                });
              });
            });
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

  it('should empty a single room from server', function (done) {
    srv.listen(function () {
      primus.on('connection', function (spark) {
        spark.join('room1', function (err) {
          if (err) return done(err);
          spark.on('data', function () {
            primus.empty('room1', function (err) {
              if (err) return done(err);
              primus.isRoomEmpty('room1', function (err, empty) {
                if (err) return done(err);
                expect(empty).to.be.eql(true);
                primus.empty(done);
              });
            });
          });
        });
      });
      client(srv, primus);
      client(srv, primus);
      client(srv, primus)
      .write('send');
    });
  });

  it('should empty multiple rooms from server', function (done) {
    var sparks = [];
    srv.listen(function () {
      primus.on('connection', function (spark) {
        spark.join('room1', function (err) {
          if (err) return done(err);
          spark.join('room2', function (err) {
            if (err) return done(err);
            spark.join('room3', function (err) {
              if (err) return done(err);
              spark.on('data', function () {
                primus.in('room1 room2 room3').empty(function (err) {
                  if (err) return done(err);
                  primus.isRoomEmpty('room1', function (err, empty) {
                    if (err) return done(err);
                    expect(empty).to.be.eql(true);
                    primus.empty(done);
                  });
                });
              });
            });
          });
        });
      });
      client(srv, primus);
      client(srv, primus);
      client(srv, primus)
      .write('send');
    });
  });
  
  it('should keeps track of rooms', function (done) {
    srv.listen(function () {
      var conn = client(srv, primus);
      primus.on('connection', function (spark) {
        spark.join('a', function (err) {
          if (err) return done(err);
          spark.rooms(function (err, rooms) {
            if (err) return done(err);
            expect(rooms).to.eql(['a']);
            spark.join('b', function () {
              if (err) return done(err);
              spark.rooms(function (err, rooms) {
                if (err) return done(err);
                rooms.forEach(function (r) {
                  expect(['a', 'b']).to.contain(r);
                });
              });
              spark.leave('b', function () {
                if (err) return done(err);
                spark.rooms(function (err, rooms) {
                  if (err) return done(err);
                  expect(rooms).to.eql(['a']);
                  primus.empty(done);
                });
              });
            });
          });
        });
      });
    });
  });

  it('should return all rooms on server', function (done) {
    srv.listen(function () {
      var conn = client(srv, primus);
      primus.on('connection', function (spark) {
        spark.join('a', function (err) {
          if (err) return done(err);
          spark.join('b', function (err) {
            if (err) return done(err);
            primus.rooms(function (err, rooms) {
              if (err) return done(err);
              rooms.forEach(function (r) {
                expect(['a', 'b']).to.contain(r);
              });
              primus.empty(done);
            });
          });
        });
      });
    });
  });

  it('should return all rooms of specific client from server', function (done) {
    srv.listen(function () {
      var useId = true;
      client(srv, primus);
      primus.on('connection', function (spark) {
        if (useId) {
          useId = false;
          spark.join('a', function (err) {
            if (err) return done(err);
            spark.join('b', function (err) {
              if (err) return done(err);
              spark.leave('c', function (err) {
                if (err) return done(err);
                primus.rooms(spark.id, function (err, rooms) {
                  if (err) return done(err);
                  expect(rooms).to.eql(['a', 'b']);
                  client(srv, primus);
                });
              });
            });
          });
        } else {
          spark.join('d', function (err) {
            if (err) return done(err);
            spark.join('e', function (err) {
              if (err) return done(err);
              spark.leave('f', function (err) {
                if (err) return done(err);
                primus.rooms(spark, function (err, rooms) {
                  if (err) return done(err);
                  expect(rooms).to.eql(['d', 'e']);
                  primus.empty(done);
                });
              });
            });
          });
        }
      });
    });
  });

  it('should allow passing adapter as argument', function (done) {

    var adapter = {
      add: function () {},
      del: function () {},
      delAll: function () {},
      broadcast: function () {},
      clients: function () {}
    };

    opts.rooms = { adapter: adapter };

    primus = server(srv, opts);
    srv.listen(function () {
      expect(primus.adapter).to.be.eql(adapter);
      delete opts.rooms;
      done();
    });
  });

  it('should allow setting and getting adapter', function (done) {
    var adapter = {
      add: function () {},
      del: function () {},
      delAll: function () {},
      broadcast: function () {},
      clients: function () {}
    };
    srv.listen(function () {
      primus.adapter = adapter;
      expect(primus.adapter).to.be.eql(adapter);
      done();
    });
  });

  it('should only allow objects as adapter', function () {
    var msg = 'Adapter should be an object';
    srv.listen(function () {
      try {
        primus.adapter = 'not valid';
      } catch (e) {
        expect(e.message).to.be(msg);
      }

      try {
        primus.adapter = function () {};
      } catch (e) {
        expect(e.message).to.be(msg);
      }

      try {
        primus.adapter = 123456;
      } catch (e) {
        return expect(e.message).to.be(msg);
      }

      throw new Error('I should have throwed above');
    });
  });

  it('should remove client from room on client disconnect', function (done) {
    srv.listen(function () {
      var c1 = client(srv, primus);
      primus.on('connection', function (spark) {
        spark.join('a');
        spark.on('end', function () {
          setTimeout(function () {
            spark.rooms(function (err, rooms) {
              if (err) return done(err);
              expect(rooms).to.be.empty();
              primus.empty(done);
            });
          }, 100);
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

  it('should get all clients connected to a room using primus method', function (done) {
    
    var ids = [];

    srv.listen(function () {
      primus.on('connection', function (spark) {
        
        primus.join(spark, 'room1', function () {
          ids.push(spark.id);
        });

        spark.on('data', function () {
          primus.room('room1').clients(function (err, clients) {
            clients.forEach(function (id) {
              expect(ids).to.contain(id);
            });
            primus.empty(done);
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

  it('should get all clients synchronously if no callback is provided using primus method', function (done) {
    
    var ids = [];

    srv.listen(function () {
      if (!primus.adapter.rooms) return done();
      primus.on('connection', function (spark) {
        ids.push(spark.id);
        primus.join(spark, 'room1');
        spark.on('data', function () {
          var clients = primus.in('room1').clients();
          expect(clients).to.be.eql(ids);
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

  it('should join spark to a room using primus method', function (done) {
    srv.listen(function () {
      primus.on('connection', function (spark) {
        primus.join(spark, 'room1', function () {
          spark.room('room1').clients(function (err, clients) {
            expect(!!~clients.indexOf(spark.id)).to.eql(true);
  
            done();
          });
        });
      });
      client(srv, primus);
    });
  });

  it('should join spark to a room by spark id on from primus', function (done) {
    srv.listen(function () {
      primus.on('connection', function (spark) {
        primus.join(spark.id, 'room1');
        spark.room('room1').clients(function (err, clients) {
          expect(!!~clients.indexOf(spark.id)).to.eql(true);
          done();
        });
      });
      client(srv, primus);
    });
  });

  it('should join spark to a room with array of ids from primus', function (done) {
    srv.listen(function () {
      primus.on('connection', function (spark) {
        primus.join([spark.id], 'room1');
        spark.room('room1').clients(function (err, clients) {
          expect(!!~clients.indexOf(spark.id)).to.eql(true);
          done();
        });
      });
      client(srv, primus);
    });
  });

  it('should join spark to a room with array of spark instances from primus', function (done) {
    srv.listen(function () {
      primus.on('connection', function (spark) {
        primus.join([spark], 'room1');
        spark.room('room1').clients(function (err, clients) {
          expect(!!~clients.indexOf(spark.id)).to.eql(true);
          done();
        });
      });
      client(srv, primus);
    });
  });

  it('should remove spark from room using primus method', function (done) {
    srv.listen(function () {
      primus.on('connection', function (spark) {
        primus.join(spark, 'room1', function () {
          primus.leave(spark, 'room1', function () {
            spark.room('room1').clients(function (err, clients) {
              expect(!!~clients.indexOf(spark.id)).to.eql(false);
              done();
            });
          });
        });
      });
      client(srv, primus);
    });
  });

  it('should remove spark from room by passing spark id, from primus', function (done) {
    srv.listen(function () {
      primus.on('connection', function (spark) {
        primus.join(spark, 'room1', function () {
          primus.leave(spark.id, 'room1', function () {
            spark.room('room1').clients(function (err, clients) {
              expect(!!~clients.indexOf(spark.id)).to.eql(false);
              done();
            });
          });
        });
      });
      client(srv, primus);
    });
  });

  it('should remove spark from room by passing array of instances, from primus', function (done) {
    srv.listen(function () {
      primus.on('connection', function (spark) {
        primus.join(spark, 'room1', function () {
          primus.leave([spark], 'room1', function () {
            spark.room('room1').clients(function (err, clients) {
              expect(!!~clients.indexOf(spark.id)).to.eql(false);
              done();
            });
          });
        });
      });
      client(srv, primus);
    });
  });

  it('should remove spark from room by passing array of spark ids, from primus', function (done) {
    srv.listen(function () {
      primus.on('connection', function (spark) {
        primus.join(spark, 'room1', function () {
          primus.leave([spark.id], 'room1', function () {
            spark.room('room1').clients(function (err, clients) {
              expect(!!~clients.indexOf(spark.id)).to.eql(false);
              done();
            });
          });
        });
      });
      client(srv, primus);
    });
  });

  it('should join and leave multiple rooms by spark ids, from primus', function (done) {
    srv.listen(function () {
      var count = 3;
      var sparks = [];
      primus.on('connection', function (spark) {
        sparks.push(spark.id);
        if (!--count) {
          primus.join(sparks, 'room1 room2', function () {
            primus.rooms(function (err, rooms) {
              expect(rooms).to.contain('room1');
              expect(rooms).to.contain('room2');
              primus.leave(sparks, 'room2 room1', function () {
                primus.rooms(function (err, rooms) {
                  expect(rooms).to.be.eql([]);
                  done();
                });
              });
            });
          });
        }
      });
      client(srv, primus);
      client(srv, primus);
      client(srv, primus);
    });
  });

  it('should remove spark from room by passing array of spark ids, from primus', function (done) {
    srv.listen(function () {
      var count = 3;
      var sparks = [];
      primus.on('connection', function (spark) {
        sparks.push(spark);
        if (!--count) {
          primus.join(sparks, 'room1', function () {
            primus.leave(sparks, 'room1', function () {
              spark.in('room1').clients(function (err, clients) {
                expect(clients.length).to.eql(0);
                done();
              });
            });
          });
        }
      });
      client(srv, primus);
      client(srv, primus);
      client(srv, primus);
    });
  });

  it('should broadcast message to specific room from primus using `room`', function (done) {
    
    var total = 0;

    srv.listen(function () {

      var c1 = client(srv, primus)
        , c2 = client(srv, primus)
        , c3 = client(srv, primus);
      
      primus.on('connection', function (spark) {
        spark.on('data', function (data) {
          primus.join(spark, data, function () {
            if (3 === ++total) {
              --total;
              primus.room('a').write('hi');
            }
          });
        });
      });

      c1.write('a');
      c2.write('a');
      c3.write('b');

      c1.on('data', function (msg) {
        expect(msg).to.be('hi');
        finish();
      });

      c2.on('data', function (msg) {
        expect(msg).to.be('hi');
        finish();
      });

      c3.on('data', function (msg) {
        done(new Error('not'));
      });

      function finish () {
        if (1 > --total) done();
      }
      
    });
  });

  it('should broadcast message to multiple rooms from primus using `room` method', function (done) {
    
    var total = 0;

    srv.listen(function () {

      var c1 = client(srv, primus)
        , c2 = client(srv, primus)
        , c3 = client(srv, primus);

      primus.on('connection', function (spark) {
        spark.on('data', function (data) {
          primus.join(spark, data, function () {
            if (3 === ++total) {
              --total;
              primus.room('a b').write('hi');
            }
          });
        });
      });

      c1.write('a');
      c2.write('b');
      c3.write('c');

      c1.on('data', function (msg) {
        expect(msg).to.be('hi');
        finish();
      });

      c2.on('data', function (msg) {
        expect(msg).to.be('hi');
        finish();
      });

      c3.on('data', function (msg) {
        done(new Error('not'));
      });

      function finish () {
        if (1 > --total) done();
      }
      
    });
  });

  it('should trigger `joinroom` event when joining room', function (done) {
    srv.listen(function () {
      primus.on('connection', function (spark) {
        spark.join('room1');
        spark.on('joinroom', function (room) {
          expect(room).to.be.eql('room1');
          done();
        });
      });
      client(srv, primus);
    });
  });

  it('should trigger `leaveroom` event when leaving room', function (done) {
    srv.listen(function () {
      primus.on('connection', function (spark) {
        spark.join('room1', function () {
          spark.leave('room1');
          spark.on('leaveroom', function (room) {
            expect(room).to.be.eql('room1');
            done();
          });
        });
      });
      client(srv, primus);
    });
  });

  // THIS DO NO LONGER APPLY, NO TIME TO BIND AN EVENT TO SPARK WHEN IT IS ALREADY
  // CLOSED.
  /*it('should trigger `leaveallrooms` events on client disconnect', function (done) {
    srv.listen(function () {
      var c1 = client(srv, primus);
      primus.on('connection', function (spark) {
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
  });*/

  it('should trigger `joinroom` event when joining room using primus join method', function (done) {
    srv.listen(function () {
      primus.on('connection', function (spark) {
        primus.join(spark, 'room1');
        primus.on('joinroom', function (room, socket) {
          expect(room).to.be.eql('room1');
          expect(spark).to.be.eql(socket);
          done();
        });
      });
      client(srv, primus);
    });
  });

  it('should trigger `leaveroom` event when leaving room using primus leave method', function (done) {
    srv.listen(function () {
      primus.on('connection', function (spark) {
        primus.join(spark, 'room1', function () {
          primus.leave(spark, 'room1');
          primus.on('leaveroom', function (room, socket) {
            expect(room).to.be.eql('room1');
            expect(spark).to.be.eql(socket);
            done();
          });
        });
      });
      client(srv, primus);
    });
  });

  it('should trigger `leaveallrooms` events on client disconnect when listening on primus', function (done) {
    var disconnected = false;
    srv.listen(function () {
      var c1 = client(srv, primus);
      primus.on('connection', function (spark) {
        primus.join(spark, 'a');
        primus.on('leaveallrooms', function (rooms, socket) {
          if (disconnected) return;
          disconnected = true;
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
  });

  it('should still support broadcasting from server with `write`', function (done) {
    
    var total = 0;

    srv.listen(function () {
      
      primus.on('connection', function (spark) {
        if (3 === ++total) primus.write('hi');
      });

      var cl1 = client(srv, primus)
        , cl2 = client(srv, primus)
        , cl3 = client(srv, primus);

      cl1.on('data', function (msg) {
        expect(msg).to.be('hi');
        finish();
      });

      cl2.on('data', function (msg) {
        expect(msg).to.be('hi');
        finish();
      });

      cl3.on('data', function (msg) {
        expect(msg).to.be('hi');
        finish();
      });

      function finish() {
        if (1 > --total) done();
      }
    });
  });

  describe('primus-emitter', function () {

    it('should ignore `primus-rooms` reserved events', function (done) {

      var events = rooms.Rooms.events;

      primus.use('emitter', 'primus-emitter');

      srv.listen(client.port, function () {
        var cl = client(srv, primus);

        primus.on('connection', function (spark) {
          events.forEach(function (ev) {
            spark.on(ev, function (data) {
              if ('not ignored' === data) {
                done(new Error('should be ignored'));
              }
            });
          });
        });

        cl.on('open', function () {
          events.forEach(function (ev) {
            cl.send(ev, 'not ignored');
          });
          done();
        });

      });
    });

    it('should allow sending to specific room from client', function (done) {
      
      primus.use('emitter', 'primus-emitter');
      
      srv.listen(function () {
        var c1 = client(srv, primus)
          , c2 = client(srv, primus)
          , c3 = client(srv, primus);

        primus.on('connection', function (spark) {
          spark.on('join', function (room) {
            spark.join(room);
            if ('send' === room) {
              spark.room('room1').send('msg');
            }         
          });
        });

        c1.on('msg', function (data) {
          done();
        });

        c2.on('msg', function (data) {
          done(new Error('not'));
        });

        c3.on('msg', function (data) {
          done(new Error('not'));
        });

        c1.send('join', 'room1');
        c2.send('join', 'room2');

        setTimeout(function () {
          c3.send('join', 'send');
        }, 100);

      });
    });

    it('should allow sending to multiple rooms from client', function (done) {
      
      var total = 0
        , sender;

      primus.use('emitter', 'primus-emitter');

      srv.listen(function () {

        var c1 = client(srv, primus)
          , c2 = client(srv, primus)
          , c3 = client(srv, primus)
          , c4 = client(srv, primus);

        primus.on('connection', function (spark) {
          spark.on('join', function (room) {

            if ('send' === room) {
              sender = spark;
            }

            spark.join(room, function () {
              if (4 === ++total) {
                --total;
                sender.room('room1 room2 room3').send('msg', 'hi');
              }
            });
          });
        });

        c1.on('msg', function (msg) {
          expect(msg).to.be('hi');
          finish();
        });

        c2.on('msg', function (msg) {
          expect(msg).to.be('hi');
          finish();
        });

        c3.on('msg', function (msg) {
          expect(msg).to.be('hi');
          finish();
        });

        c4.on('msg', function (msg) {
          done(new Error('not'));
        });

        function finish() {
          if (1 > --total) done();
        }

        c1.send('join', 'room1');
        c2.send('join', 'room2');
        c3.send('join', 'room3');
        c4.send('join', 'send');

      });
    });

    it('should allow sending to a single room from server', function (done) {
      primus.use('emitter', 'primus-emitter');
      srv.listen(function () {
        
        var c1 = client(srv, primus);

        primus.on('connection', function (spark) {
          spark.join('room1', function () {
            primus.room('room1').send('news');
          });
        });
        c1.on('news', function (data) {
          done();
        });
      });
    });

    it('should not allow broadcasting message with ack', function (done) {
      primus.use('emitter', 'primus-emitter');
      srv.listen(function () {
        var c1 = client(srv, primus);
        primus.on('connection', function (spark) {
          spark.join('room1', function () {
            expect(function () {
              primus.room('room1').send('news', function(){});
            }).to.throwException(/Callbacks are not supported/);
            done();
          });
        });
        c1.on('news', function (data) {
          done();
        });
      });
    });

    it('should allow sending to multiple rooms from server', function (done) {

      var total = 0;

      primus.use('emitter', 'primus-emitter');

      srv.listen(function () {

        var c1 = client(srv, primus)
          , c2 = client(srv, primus)
          , c3 = client(srv, primus)
          , c4 = client(srv, primus);

        primus.on('connection', function (spark) {
          spark.on('join', function (room) {
            spark.join(room, function () {
              if (4 === ++total) {
                --total;
                primus.room('room1 room2 room3').send('msg', 'hi');
              }
            });
          });
        });

        c1.on('msg', function (msg) {
          expect(msg).to.be('hi');
          finish();
        });

        c2.on('msg', function (msg) {
          expect(msg).to.be('hi');
          finish();
        });

        c3.on('msg', function (msg) {
          expect(msg).to.be('hi');
          finish();
        });

        c4.on('msg', function (msg) {
          done(new Error('not'));
        });

        function finish() {
          if (1 > --total) done();
        }

        c1.send('join','room1');
        c2.send('join','room2');
        c3.send('join','room3');
        c4.send('join','room4');
      });
    });

    it('should return Primus instance when sending to a room from server', function() {
      primus.use('emitter', 'primus-emitter');
      expect(primus.room('room1').send('news')).to.be.a(Primus);
      srv.listen();
    });

    it('should allow sending to multiple rooms from server with `write`', function (done) {
      var total = 0;
      primus.use('emitter', 'primus-emitter');
      srv.listen(function () {
        var c1 = client(srv, primus)
          , c2 = client(srv, primus)
          , c3 = client(srv, primus)
          , c4 = client(srv, primus);

        primus.on('connection', function (spark) {
          spark.on('data', function (room) {
            spark.join(room, function () {
              if (4 === ++total) {
                --total;
                primus.room('room1 room2 room3').write('hi');
              }
            });
          });
        });

        c1.on('data', function (msg) {
          expect(msg).to.be('hi');
          finish();
        });

        c2.on('data', function (msg) {
          expect(msg).to.be('hi');
          finish();
        });

        c3.on('data', function (msg) {
          expect(msg).to.be('hi');
          finish();
        });

        c4.on('data', function (msg) {
          done(new Error('not'));
        });

        function finish() {
          if (1 > --total) done();
        }

        c1.write('room1');
        c2.write('room2');
        c3.write('room3');
        c4.write('room4');
      });
    });
        
    it('should still support broadcasting from server with primus-emitter `send`', function (done) {

      var total = 0;

      primus.use('emitter', 'primus-emitter');

      srv.listen(function () {
        
        primus.on('connection', function (spark) {
          if (3 === ++total) {
            primus.send('msg', 'hi');
          }
        });

        var cl1 = client(srv, primus)
          , cl2 = client(srv, primus)
          , cl3 = client(srv, primus);

        cl1.on('msg', function (msg) {
          expect(msg).to.be('hi');
          finish();
        });

        cl2.on('msg', function (msg) {
          expect(msg).to.be('hi');
          finish();
        });

        cl3.on('msg', function (msg) {
          expect(msg).to.be('hi');
          finish();
        });

        function finish() {
          if (1 > --total) done();
        }
      });
    });
  });

  describe('primus-multiplex', function () {

    it('should allow joining a room', function (done) {
      primus.use('multiplex', 'primus-multiplex');
      var a = primus.channel('a');
      srv.listen(function () {
        a.on('connection', function (spark) {
          spark.join('a', function () {
            done();
          });
        });
      });
      var cl = client(srv, primus)
        , cla = cl.channel('a');
    });

    it('should allow leaving a room', function (done) {
      primus.use('multiplex', 'primus-multiplex');
      var a = primus.channel('a');
      srv.listen(function () {
        a.on('connection', function (spark) {
          spark.join('a');
          spark.leave('a', function () {
            done();
          });
        });
      });
      var cl = client(srv, primus)
        , cla = cl.channel('a');
    });

    it('should allow broadcasting a message to a client', function (done) {
      primus.use('multiplex', 'primus-multiplex');
      var a = primus.channel('a');
      srv.listen(function () {
        a.on('connection', function (spark) {
          spark.on('data', function (room) {
            if ('me' === room) {
              spark.room('r1').write('hi');
            } else {
              spark.join(room);
            }
          });
        });
      });
      var cl = client(srv, primus)
        , c1a = cl.channel('a');
      c1a.on('data', function (msg) {
        expect(msg).to.be('hi');
        done();
      });
      c1a.write('r1');
      setTimeout(function () {
        var me = cl.channel('a');
        me.write('me');
      }, 0);

    });

    it('should allow broadcasting a message to multiple clients', function (done) {
      primus.use('multiplex', 'primus-multiplex');
      var a = primus.channel('a')
        , total = 3;

      srv.listen(function () {
        a.on('connection', function (spark) {
          spark.on('data', function (room) {
            spark.join(room);
            if ('send' === room) {
              spark.room('r1 r2 r3').write('hi');
            }
          });
        });
      });

      var cl = client(srv, primus)
        , c1a = cl.channel('a')
        , c2a = cl.channel('a')
        , c3a = cl.channel('a')
        , c4a = cl.channel('a');

      c1a.write('r1');
      c2a.write('r2');
      c3a.write('r3');

      c1a.on('data', function (msg) {
        expect(msg).to.be('hi');
        finish();
      });

      c2a.on('data', function (msg) {
        expect(msg).to.be('hi');
        finish();
      });

      c3a.on('data', function (msg) {
        expect(msg).to.be('hi');
        finish();
      });

      c4a.on('data', function (msg) {
        done(new Error('not'));
      });

      function finish() {
        if (1 > --total) done();
      }

      setTimeout(function () {
        c4a.write('send');
      }, 100);

    });

    it('should allow broadcasting a message to multiple clients with channel `write` method', function (done) {
      primus.use('multiplex', 'primus-multiplex');
      var a = primus.channel('a')
        , total = 3;

      srv.listen(function () {
        a.on('connection', function (spark) {
          spark.on('data', function (room) {
            spark.join(room);
            if ('send' === room) {
              a.room('r1 r2 r3').write('hi');
            }
          });
        });
      });

      var cl = client(srv, primus)
        , c1a = cl.channel('a')
        , c2a = cl.channel('a')
        , c3a = cl.channel('a')
        , c4a = cl.channel('a');

      c1a.write('r1');
      c2a.write('r2');
      c3a.write('r3');

      c1a.on('data', function (msg) {
        expect(msg).to.be('hi');
        finish();
      });

      c2a.on('data', function (msg) {
        expect(msg).to.be('hi');
        finish();
      });

      c3a.on('data', function (msg) {
        expect(msg).to.be('hi');
        finish();
      });

      c4a.on('data', function (msg) {
        done(new Error('not'));
      });

      function finish() {
        if (1 > --total) done();
      }

      setTimeout(function () {
        c4a.write('send');
      }, 100);

    });

    it('should allow broadcasting a message to multiple clients with channel `send` method', function (done) {
      
      primus.use('emitter', 'primus-emitter');
      primus.use('multiplex', 'primus-multiplex');

      var a = primus.channel('a')
        , total = 3;

      srv.listen(function () {
        a.on('connection', function (spark) {
          spark.on('join', function (room) {
            spark.join(room);
            if ('send' === room) {
              a.room('r1 r2 r3').send('msg', 'hi');
            }
          });
        });
      });

      var cl = client(srv, primus)
        , c1a = cl.channel('a')
        , c2a = cl.channel('a')
        , c3a = cl.channel('a')
        , c4a = cl.channel('a');

      c1a.send('join', 'r1');
      c2a.send('join', 'r2');
      c3a.send('join', 'r3');

      c1a.on('msg', function (msg) {
        expect(msg).to.be('hi');
        finish();
      });

      c2a.on('msg', function (msg) {
        expect(msg).to.be('hi');
        finish();
      });

      c3a.on('msg', function (msg) {
        expect(msg).to.be('hi');
        finish();
      });

      c4a.on('msg', function (msg) {
        done(new Error('not'));
      });

      function finish() {
        if (1 > --total) done();
      }

      setTimeout(function () {
        c4a.send('join', 'send');
      }, 100);

    });

    it('should allow broadcasting a message to a client with emitter', function (done) {
      
      primus.use('emitter', 'primus-emitter');
      primus.use('multiplex', 'primus-multiplex');
      
      var a = primus.channel('a');

      srv.listen(function () {
        a.on('connection', function (spark) {
          spark.on('join', function (room) {
            spark.join(room);
          });

          spark.on('msg', function (msg) {
            if ('broadcast' === msg) {
              spark.room('r1').send('msg', 'hi');
            }
          });
        });
      });

      var cl = client(srv, primus)
        , c1a = cl.channel('a');
      c1a.on('msg', function (msg) {
        expect(msg).to.be('hi');
        done();
      });
      c1a.send('join', 'r1');
      setTimeout(function () {
        var me = cl.channel('a');
        me.send('msg', 'broadcast');
      }, 0);

    });

    it('should allow broadcasting a message to multiple clients with emitter', function (done) {
      
      this.timeout(0);

      primus.use('multiplex', 'primus-multiplex');
      primus.use('emitter', 'primus-emitter');

      var a = primus.channel('a')
        , total = 3;

      srv.listen(function () {
        a.on('connection', function (spark) {
          spark.on('join', function (room) {
            spark.join(room);
            if ('send' === room) {
              spark.room('r1 r2 r3').send('msg', 'hi');
              return;
            }
          });
        });
      });

      var cl = client(srv, primus)
        , c1a = cl.channel('a')
        , c2a = cl.channel('a')
        , c3a = cl.channel('a')
        , c4a = cl.channel('a');

      c1a.send('join', 'r1');
      c2a.send('join', 'r2');
      c3a.send('join', 'r3');
      c3a.send('join', 'r4');

      c1a.on('msg', function (msg) {
        expect(msg).to.be('hi');
        finish();
      });

      c2a.on('msg', function (msg) {
        expect(msg).to.be('hi');
        finish();
      });

      c3a.on('msg', function (msg) {
        expect(msg).to.be('hi');
        finish();
      });

      c4a.on('msg', function (msg) {
        done(new Error('not'));
      });

      function finish() {
        if (1 > --total) done();
      }

      setTimeout(function () {
        c4a.send('join', 'send');
      }, 100);

    });

    it('should get all clients synchronously if no callback is provided using channel method', function (done) {
      var ids = [];
      primus.use('multiplex', 'primus-multiplex');
      var a = primus.channel('a')
        , total = 0;

      srv.listen(function () {
        a.on('connection', function (spark) {
          ids.push(spark.id);
          a.join(spark, 'room1');
          if (3 === ++total) {
            var clients = a.in('room1').clients();
            expect(clients).to.be.eql(ids);
            done();
          }
        });

        var cl = client(srv, primus);
        cl.channel('a');
        cl.channel('a');
        cl.channel('a');
      });
    });

    it('should join spark to a room using channel method', function (done) {
      primus.use('multiplex', 'primus-multiplex');
      var a = primus.channel('a');

      srv.listen(function () {
        a.on('connection', function (spark) {
          a.join(spark, 'room1', function () {
            spark.room('room1').clients(function (err, clients) {
              expect(!!~clients.indexOf(spark.id)).to.eql(true);
              done();
            });
          });
        });
        var cl = client(srv, primus);
        cl.channel('a');
      });
    });

    it('should remove spark form room using channel method', function (done) {
      primus.use('multiplex', 'primus-multiplex');
      var a = primus.channel('a');

      srv.listen(function () {
        a.on('connection', function (spark) {
          a.join(spark, 'room1', function () {
            a.leave(spark, 'room1', function () {
              spark.room('room1').clients(function (err, clients) {
                expect(!!~clients.indexOf(spark.id)).to.eql(false);
                done();
              });
            });
          });
        });
        var cl = client(srv, primus);
        cl.channel('a');
      });
    });

    it('should trigger `joinroom` event when joining room', function (done) {
      primus.use('multiplex', 'primus-multiplex');
      var a = primus.channel('a');

      srv.listen(function () {
        a.on('connection', function (spark) {
          spark.join('room1');
          spark.on('joinroom', function (room) {
            expect(room).to.be.eql('room1');
            done();
          });
        });
        var cl = client(srv, primus);
        cl.channel('a');
      });
    });

    it('should trigger `leaveroom` event when leaving room', function (done) {

      primus.use('multiplex', 'primus-multiplex');
      var a = primus.channel('a');
      
      srv.listen(function () {
        a.on('connection', function (spark) {
          spark.join('room1', function (err) {
            spark.on('leaveroom', function (room) {
              expect(room).to.be.eql('room1');
              done();
            });
            spark.leave('room1');
          });
        });

        var cl = client(srv, primus);
        cl.channel('a');
      });
    });

    it('should trigger `leaveallrooms` events on client disconnect', function (done) {
      primus.use('multiplex', 'primus-multiplex');
      var a = primus.channel('a');
      var disconnected = false;
      srv.listen(function () {
        a.on('connection', function (spark) {
          spark.join('a');         
          a.on('leaveallrooms', function (rooms, socket) {
            if (disconnected) return;
            disconnected = true;
            expect(rooms).to.be.eql(['a']);
            expect(spark).to.be.eql(socket);
            done();
          });
          spark.write('end');
        });

        var cl = client(srv, primus)
          , cla = cl.channel('a');
        cla.on('data', function (data) {
          if ('end' === data) cla.end();
        });
      });
    });

    it('should trigger `joinroom` event when joining room using channel join method', function (done) {
      primus.use('multiplex', 'primus-multiplex');
      var a = primus.channel('a');
      srv.listen(function () {
        a.on('connection', function (spark) {
          a.join(spark, 'room1');
          a.on('joinroom', function (room, socket) {
            expect(room).to.be.eql('room1');
            expect(spark).to.be.eql(socket);
            done();
          });
        });

        var cl = client(srv, primus)
          , cla = cl.channel('a');
      });
    });

    it('should trigger `leaveroom` event when leaving room using channel leave method', function (done) {
      primus.use('multiplex', 'primus-multiplex');
      var a = primus.channel('a');
      srv.listen(function () {
        a.on('connection', function (spark) {
          a.join(spark, 'room1', function () {
            a.leave(spark, 'room1');
            a.on('leaveroom', function (room, socket) {
              expect(room).to.be.eql('room1');
              expect(spark).to.be.eql(socket);
              done();
            });
          });
        });

        var cl = client(srv, primus)
          , cla = cl.channel('a');
      });
    });    
  });
});
