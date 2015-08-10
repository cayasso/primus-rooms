'use strict';

var rooms = require('../')
  , Primus = require('primus')
  , http = require('http').Server
  , expect = require('expect.js')
  , opts = { transformer: 'websockets' }
  , srv, primus;

// creates the client
function client() {
  var addr = srv.address();
  if (!addr) throw new Error('Server is not listening');
  return new primus.Socket('http://localhost:' + addr.port);
}

// creates the server
function server(srv, opts) {
  return new Primus(srv, opts).use('rooms', rooms);
}

describe('primus-rooms', function () {
  beforeEach(function beforeEach(done) {
    srv = http();
    primus = server(srv, opts);
    srv.listen(done);
  });

  afterEach(function afterEach(done) {
    primus.end(done);
  });

  it('should have required methods', function (done) {
    primus.on('connection', function (spark) {
      expect(spark.join).to.be.a('function');
      expect(spark.leave).to.be.a('function');
      expect(spark.leaveAll).to.be.a('function');
      expect(spark.room).to.be.a('function');
      expect(spark.rooms).to.be.a('function');
      expect(spark.clients).to.be.a('function');
      done();
    });

    client();
  });

  it('should join room', function (done) {
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

    client();
  });

  it('should join multiple rooms at once', function (done) {
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

    client();
  });

  it('should join multiple rooms at once passing an array as argument', function (done) {
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

    client();
  });

  it('should leave room', function (done) {
    primus.on('connection', function (spark) {
      spark.join('room1');
      spark.leave('room1');
      spark.room('room1').clients(function (err, clients) {
        expect(!!~clients.indexOf(spark.id)).to.eql(false);
        spark.leaveAll(done);
      });
    });

    client();
  });

  it('should leave multiple rooms at once', function (done) {
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

    client();
  });

  it('should leave multiple rooms at once passing an array', function (done) {
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

    client();
  });

  it('should leave all rooms', function (done) {
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

    client();
  });

  // ROOMS DOESNT EXIST
  it('should cleanup room on leave', function (done) {
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

    client();
  });

  it('should cleanup rooms on leave all', function (done) {
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
              spark.rooms(function (err) {
                if (err) return done(err);
                expect(spark._rooms.adapter.rooms).to.be.empty();
                done();
              });
            });
          });
        });
      });
    });

    client();
  });

  it('should allow method channing', function (done) {
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

    client();
  });

  it('should allow simple connection', function (done) {
    primus.on('connection', function (spark) {
      spark.on('data', function (data) {
        spark.write(data);
      });
    });

    var c = client();

    c.on('data', function (data) {
      if ('send' === data) done();
    });
    c.write('send');
  });

  it('should allow sending to multiple rooms', function (done) {
    var total = 0
      , sender;

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

    var c1 = client()
      , c2 = client()
      , c3 = client()
      , c4 = client();

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

    c4.on('data', function () {
      done(new Error('Test invalidation'));
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

  it('should allow defining exception ids when broadcasting', function (done) {
    var total = 0
      , sender
      , except = [];

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

    var c1 = client()
      , c2 = client()
      , c3 = client()
      , c4 = client();

    c1.on('data', function () {
      done(new Error('Test invalidation'));
    });

    c2.on('data', function () {
      done(new Error('Test invalidation'));
    });

    c3.on('data', function (msg) {
      expect(msg).to.be('hi');
      primus.empty('room1 room2 room3', done);
    });

    c4.on('data', function () {
      done(new Error('Test invalidation'));
    });

    c1.write('room1');
    c2.write('room2');
    c3.write('room3');
    c4.write('send');
  });

  it('should allow defining exception ids as string when broadcasting', function (done) {
    var total = 0
      , sender
      , except = [];

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

    var c1 = client()
      , c2 = client()
      , c3 = client()
      , c4 = client();

    c1.on('data', function () {
      done(new Error('Test invalidation'));
    });

    c2.on('data', function () {
      done(new Error('Test invalidation'));
    });

    c3.on('data', function (msg) {
      expect(msg).to.be('hi');
      primus.empty('room1 room2 room3', done);
    });

    c4.on('data', function () {
      done(new Error('Test invalidation'));
    });

    c1.write('room1');
    c2.write('room2');
    c3.write('room3');
    c4.write('send');
  });

  it('should allow defining exception ids when broadcasting from server', function (done) {
    var total = 0
      , sender
      , except = [];

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

    var c1 = client()
      , c2 = client()
      , c3 = client()
      , c4 = client();

    c1.on('data', function () {
      done(new Error('Test invalidation'));
    });

    c2.on('data', function (msg) {
      expect(msg).to.be('hi');
      primus.empty('room1 room2 room3', done);
    });

    c3.on('data', function () {
      done(new Error('Test invalidation'));
    });

    c4.on('data', function () {
      done(new Error('Test invalidation'));
    });

    c1.write('room1');
    c2.write('room2');
    c3.write('room3');
    c4.write('send');
  });

  it('should allow transforming data before broadcasting from client', function (done) {
    var total = 0
      , sender;

    primus.on('connection', function (spark) {
      spark.on('data', function (data) {

        spark.from = data;

        if ('send' === data) {
          sender = spark;
        }
        spark.join(data, function () {
          ++total;
          if (3 === total) {
            --total;
            sender.in('room1 room2').transform(function (packet) {
              var socket = this;
              packet.data[0] = 'hi from ' + socket.from;
            }).write('hi');
          }
        });
      });
    });

    var c1 = client()
      , c2 = client()
      , c3 = client();

    c1.on('data', function (msg) {
      expect(msg).to.be('hi from room1');
    });

    c2.on('data', function (msg) {
      expect(msg).to.be('hi from room2');
      primus.empty('room1 room2', done);
    });

    c1.write('room1');

    setTimeout(function () {
      c2.write('room2');
      c3.write('send');
    }, 50);
  });

  it('should allow transforming data asynchronously before broadcasting from client', function (done) {
    var total = 0
      , sender;

    primus.on('connection', function (spark) {
      spark.on('data', function (data) {
        spark.from = data;

        if ('send' === data) {
          sender = spark;
        }
        spark.join(data, function () {
          ++total;
          if (3 === total) {
            --total;
            sender.in('room1 room2').transform(function (packet, next) {
              var socket = this;
              setTimeout(function () {
                packet.data[0] = 'hi from ' + socket.from;
                next();
              }, 100);
            }).write('hi');
          }
        });
      });
    });

    var c1 = client()
      , c2 = client()
      , c3 = client();

    c1.on('data', function (msg) {
      expect(msg).to.be('hi from room1');
    });

    c2.on('data', function (msg) {
      expect(msg).to.be('hi from room2');
      primus.empty('room1 room2', done);
    });

    c1.write('room1');

    setTimeout(function () {
      c2.write('room2');
      c3.write('send');
    }, 50);
  });

  it('should allow transforming data before broadcasting from server', function (done) {
    var total = 0;

    primus.on('connection', function (spark) {
      spark.on('data', function (data) {
        spark.from = data;
        spark.join(data, function () {
          ++total;
          if (2 === total) {
            --total;
            primus.in('room1 room2').transform(function (packet) {
              var socket = this;
              packet.data[0] = 'hi from ' + socket.from;
            }).write('hi');
          }
        });
      });
    });

    var c1 = client()
      , c2 = client();

    c1.on('data', function (msg) {
      expect(msg).to.be('hi from room1');
    });

    c2.on('data', function (msg) {
      expect(msg).to.be('hi from room2');
      primus.empty('room1 room2', done);
    });

    c1.write('room1');

    setTimeout(function () {
      c2.write('room2');
    }, 50);
  });

  it('should allow transforming asynchronously data before broadcasting from server', function (done) {
    var total = 0;

    primus.on('connection', function (spark) {
      spark.on('data', function (data) {
        spark.from = data;
        spark.join(data, function () {
          ++total;
          if (2 === total) {
            --total;
            primus.in('room1 room2').transform(function (packet, next) {
              var socket = this;
              setTimeout(function () {
                packet.data[0] = 'hi from ' + socket.from;
                next();
              }, 100);
            }).write('hi');
          }
        });
      });
    });

    var c1 = client()
      , c2 = client();

    c1.on('data', function (msg) {
      expect(msg).to.be('hi from room1');
    });

    c2.on('data', function (msg) {
      expect(msg).to.be('hi from room2');
      primus.empty('room1 room2', done);
    });

    c1.write('room1');

    setTimeout(function () {
      c2.write('room2');
    }, 50);
  });

  it('should avoid sending dupes', function (done) {
    var total = 2;

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

    var c1 = client()
      , c2 = client()
      , c3 = client();

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

    setTimeout(function () {
      c1.write('send');
    }, 50);
  });

  it('should not allow broadcasting from a destroyed spark', function (done) {
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

    var c1 = client();

    c1.on('open', function () {
      var c2 = client();
      c2.on('open', c2.end);
    });

    c1.on('data', function () {
      done(new Error('Test invalidation'));
    });
  });

  it('should get all clients connected to a room', function (done) {
    var ids = [];

    primus.on('connection', function (spark) {
      ids.push(spark.id);
      spark.join('news');
      spark.on('data', function () {
        spark.room('news').clients(function (err, clients) {
          expect(clients.sort()).to.be.eql(ids);
          primus.empty(['news'], done);
        });
      });
    });

    var c = client();

    client();
    client();
    client();

    setTimeout(function () {
      c.write('send');
    }, 100);
  });

  it('should get all clients synchronously if no callback is provided', function (done) {
    var ids = [];

    primus.on('connection', function (spark) {
      ids.push(spark.id);
      spark.join('room1');
      spark.on('data', function () {
        var clients = spark.room('room1').clients();
        expect(clients.sort()).to.be.eql(ids);
        done();
      });
    });

    var c = client();

    client();
    client();
    client();

    setTimeout(function () {
      c.write('send');
    }, 100);
  });

  it('should check if a room is empty', function (done) {
    var sparks = [];

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

    var c = client();

    client();
    client();
    client();

    setTimeout(function () {
      c.write('send');
    }, 100);
  });

  it('should check if a room is empty from server', function (done) {
    var sparks = [];

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

    var c = client();

    client();
    client();
    client();

    setTimeout(function () {
      c.write('send');
    }, 100);
  });

  it('should empty a single room from server', function (done) {
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

    var c = client();

    client();
    client();
    client();

    setTimeout(function () {
      c.write('send');
    }, 100);
  });

  it('should empty multiple rooms from server', function (done) {
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

    var c = client();

    client();
    client();
    client();

    setTimeout(function () {
      c.write('send');
    }, 100);
  });

  it('should keeps track of rooms', function (done) {
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

    client();
  });

  it('should return all rooms on server', function (done) {
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

    client();
  });

  it('should return all rooms of specific client from server', function (done) {
    var useId = true;

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
                client();
              });
            });
          });
        });
        return;
      }

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
    });

    client();
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

    primus.end();
    srv = http();
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

    primus.adapter = adapter;
    expect(primus.adapter).to.be.eql(adapter);
    done();
  });

  it('should only allow objects as adapter', function () {
    var msg = 'Adapter should be an object';

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

    throw new Error('Test invalidation');
  });

  it('should destroy references to instance', function (done) {
    primus.on('connection', function (spark) {
      var rms = spark._rooms;
      spark._rooms.destroy(function () {
        expect(spark._rooms).to.be(undefined);
        expect(rms.primus).to.be(undefined);
        expect(rms.ctx).to.be(undefined);
        expect(rms.id).to.be(undefined);
        spark.removeListener('end', rms.onend);
        done();
      });
    });

    client();
  });

  it('should get all clients connected to a room using primus method', function (done) {
    var ids = [];

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

    var c = client();

    client();
    client();
    client();

    setTimeout(function () {
      c.write('send');
    }, 100);
  });

  it('should get all clients synchronously if no callback is provided using primus method', function (done) {
    var ids = [];

    primus.on('connection', function (spark) {
      ids.push(spark.id);
      primus.join(spark, 'room1');
      spark.on('data', function () {
        var clients = primus.in('room1').clients();
        expect(clients).to.be.eql(ids);
        done();
      });
    });

    var c = client();

    client();
    client();
    client();

    setTimeout(function () {
      c.write('send');
    }, 100);
  });

  it('should join spark to a room using primus method', function (done) {
    primus.on('connection', function (spark) {
      primus.join(spark, 'room1', function () {
        spark.room('room1').clients(function (err, clients) {
          expect(!!~clients.indexOf(spark.id)).to.eql(true);
          done();
        });
      });
    });

    client();
  });

  it('should join spark to a room by spark id on from primus', function (done) {
    primus.on('connection', function (spark) {
      primus.join(spark.id, 'room1');
      spark.room('room1').clients(function (err, clients) {
        expect(!!~clients.indexOf(spark.id)).to.eql(true);
        done();
      });
    });

    client();
  });

  it('should join spark to a room with array of ids from primus', function (done) {
    primus.on('connection', function (spark) {
      primus.join([spark.id], 'room1');
      spark.room('room1').clients(function (err, clients) {
        expect(!!~clients.indexOf(spark.id)).to.eql(true);
        done();
      });
    });

    client();
  });

  it('should join spark to a room with array of spark instances from primus', function (done) {
    primus.on('connection', function (spark) {
      primus.join([spark], 'room1');
      spark.room('room1').clients(function (err, clients) {
        expect(!!~clients.indexOf(spark.id)).to.eql(true);
        done();
      });
    });

    client();
  });

  it('should remove spark from room using primus method', function (done) {
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

    client();
  });

  it('should remove spark from room by passing spark id, from primus', function (done) {
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

    client();
  });

  it('should remove spark from room by passing array of instances, from primus', function (done) {
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

    client();
  });

  it('should remove spark from room by passing array of spark ids, from primus', function (done) {
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

    client();
  });

  it('should join and leave multiple rooms by spark ids, from primus', function (done) {
    var sparks = []
      , count = 3;

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

    client();
    client();
    client();
  });

  it('should remove spark from room by passing array of sparks, from primus', function (done) {
    var sparks = []
      , count = 3;

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

    client();
    client();
    client();
  });

  it('should broadcast message to specific room from primus using `room`', function (done) {
    var total = 0;

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

    function ondata(msg) {
      expect(msg).to.be('hi');
      if (1 > --total) done();
    }

    var c1 = client()
      , c2 = client()
      , c3 = client();

    c1.on('data', ondata);
    c2.on('data', ondata);
    c3.on('data', function () {
      done(new Error('Test invalidation'));
    });

    c1.write('a');
    c2.write('a');
    c3.write('b');
  });

  it('should broadcast message to multiple rooms from primus using `room` method', function (done) {
    var total = 0;

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

    function ondata(msg) {
      expect(msg).to.be('hi');
      if (1 > --total) done();
    }

    var c1 = client()
      , c2 = client()
      , c3 = client();

    c1.on('data', ondata);
    c2.on('data', ondata);
    c3.on('data', function () {
      done(new Error('Test invalidation'));
    });

    c1.write('a');
    c2.write('b');
    c3.write('c');
  });

  it('should trigger `joinroom` event when joining room', function (done) {
    primus.on('connection', function (spark) {
      spark.join('room1');
      spark.on('joinroom', function (room) {
        expect(room).to.be.eql('room1');
        done();
      });
    });

    client();
  });

  it('should trigger `leaveroom` event when leaving room', function (done) {
    primus.on('connection', function (spark) {
      spark.join('room1', function () {
        spark.leave('room1');
        spark.on('leaveroom', function (room) {
          expect(room).to.be.eql('room1');
          done();
        });
      });
    });

    client();
  });

  it('should trigger `leaveallrooms` events on client disconnect', function (done) {
    primus.on('connection', function (spark) {
      spark.join('a');
      spark.on('leaveallrooms', function (rooms) {
        expect(rooms).to.be.eql(['a']);
        done();
      });
      spark.write('end');
    });

    client().on('data', function (data) {
      if ('end' === data) this.end();
    });
  });

  it('should trigger `joinroom` event when joining room using primus join method', function (done) {
    primus.on('connection', function (spark) {
      primus.join(spark, 'room1');
      primus.on('joinroom', function (room, socket) {
        expect(room).to.be.eql('room1');
        expect(spark).to.be.eql(socket);
        done();
      });
    });

    client();
  });

  it('should trigger `leaveroom` event when leaving room using primus leave method', function (done) {
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

    client();
  });

  it('should trigger `leaveallrooms` events on client disconnect when listening on primus', function (done) {
    primus.on('connection', function (spark) {
      primus.on('leaveallrooms', function (rooms, socket) {
        expect(rooms).to.be.eql(['a']);
        expect(spark).to.be.eql(socket);
        spark.rooms(function (err, rooms) {
          if (err) return done(err);
          expect(rooms).to.be.empty();
          done();
        });
      });
      spark.join('a');
      spark.write('end');
    });

    client().on('data', function (data) {
      if ('end' === data) this.end();
    });
  });

  it('should still support broadcasting from server with `write`', function (done) {
    var total = 0;

    primus.on('connection', function () {
      if (3 === ++total) primus.write('hi');
    });

    function ondata(msg) {
      expect(msg).to.be('hi');
      if (1 > --total) done();
    }

    client().on('data', ondata);
    client().on('data', ondata);
    client().on('data', ondata);
  });

  describe('wildcards', function () {
    it('should allow joining to wildcard room', function (done) {
      var total = 0
        , sender;

      primus.on('connection', function (spark) {
        spark.on('data', function (data) {
          if ('send' === data) {
            sender = spark;
          }
          spark.join(data, function () {
            if (4 === ++total) {
              --total;
              sender.in('user:123:abc').write('hi');
            }
          });
        });
      });

      function ondata(msg) {
        expect(msg).to.be('hi');
        if (1 > --total) {
          primus.empty(['send', 'user:*', 'user:*:abc', 'user:123:abc'], done);
        }
      }

      var c1 = client()
        , c2 = client()
        , c3 = client()
        , c4 = client();

      c1.on('data', ondata);
      c2.on('data', ondata);
      c3.on('data', ondata);
      c4.on('data', function () {
        done(new Error('Test invalidation'));
      });

      c1.write('user:*');
      c2.write('user:*:abc');
      c3.write('user:123:abc');
      c4.write('send');
    });

    it('should treat wildcard room strings as regular rooms', function (done) {
      var total = 0
        , sender;

      primus.use('emitter', 'primus-emitter');
      primus.on('connection', function (spark) {
        spark.on('msg', function (data) {
          if ('send' === data) {
            sender = spark;
          }
          spark.join(data, function () {
            if (3 === ++total) {
              sender.in('user:*:abc').send('news', 'hi');
            }
          });
        });
      });

      var c1 = client()
        , c2 = client()
        , c3 = client();

      c1.on('news', function () {
        done(new Error('Test invalidation'));
      });

      c2.on('news', function (msg) {
        expect(msg).to.be('hi');
        done();
      });

      c3.on('news', function () {
        done(new Error('Test invalidation'));
      });

      c1.send('msg', 'user');
      c2.send('msg', 'user:*:abc');
      c3.send('msg', 'send');
    });

    it('should send to rooms and wildcard rooms when the target room has a wildcard', function (done) {
      var total = 0
        , sender;

      primus.on('connection', function (spark) {
        spark.on('data', function (data) {
          if ('send' === data) {
            sender = spark;
          }
          spark.join(data, function () {
            if (3 === ++total) {
              --total;
              sender.in('user:*:abc').write('hi');
            }
          });
        });
      });

      function ondata(msg) {
        expect(msg).to.be('hi');
        if (1 > --total) {
          primus.empty('send user:*:* user:*:abc', done);
        }
      }

      var c1 = client()
        , c2 = client()
        , c3 = client();

      c1.on('data', ondata);
      c2.on('data', ondata);
      c3.on('data', function () {
        done(new Error('Test invalidation'));
      });

      c1.write('user:*:*');
      c2.write('user:*:abc');
      c3.write('send');
    });

    it('should allow wildcard deletes', function (done) {
      primus.end();
      srv = http();
      primus = server(srv, { rooms: { wildDelete: false } });
      srv.listen(function () {
        primus.on('connection', function (spark) {          
          spark.join('*:*:*', function () {
            spark.join('a:*:*', function () {
              spark.join('a:b:*', function () {
                spark.join('*:*:c', function () {
                  spark.join('*:b:c', function () {
                    spark.join('a:b:c', function () {
                      spark.leave('*:*:*', function () {
                        spark.rooms(function (err, rooms) {
                          expect(rooms).to.be.empty;
                          done();
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        });
        client();
      });
    });

    it('should allow to disable wildcard', function (done) {
      var total = 0
        , sender;

      primus.end();
      srv = http();
      primus = server(srv, { rooms: { wildcard: false } });

      srv.listen(function () {
        primus.on('connection', function (spark) {
          spark.on('data', function (data) {
            if ('send' === data) {
              sender = spark;
            }
            spark.join(data, function () {
              if (3 === ++total) {
                sender.in('user:123:abc').write('hi');
              }
            });
          });
        });

        var c1 = client()
          , c2 = client()
          , c3 = client();

        c1.on('data', function (msg) {
          expect(msg).to.be('hi');
          done();
        });

        c2.on('data', function () {
          done(new Error('Test invalidation'));
        });

        c3.on('data', function () {
          done(new Error('Test invalidation'));
        });

        c1.write('user:123:abc');
        c2.write('user:*:abc');
        c3.write('send');
      });
    });
  });

  describe('primus-emitter', function () {
    beforeEach(function () {
      primus.use('emitter', 'primus-emitter');
    });

    it('should ignore `primus-rooms` reserved events', function (done) {
      var events = rooms.Rooms.events;

      primus.on('connection', function (spark) {
        events.forEach(function (ev) {
          spark.on(ev, function (data) {
            if ('not ignored' === data) {
              done(new Error('Should be ignored'));
            }
          });
        });
      });

      var c = client();

      c.on('open', function () {
        events.forEach(function (ev) {
          c.send(ev, 'not ignored');
        });
        done();
      });
    });

    it('should allow sending to specific room from client', function (done) {
      primus.on('connection', function (spark) {
        spark.on('join', function (room) {
          spark.join(room);
          if ('send' === room) {
            spark.room('room1').send('msg');
          }
        });
      });

      var c1 = client()
        , c2 = client()
        , c3 = client();

      c1.on('msg', function () {
        done();
      });

      c2.on('msg', function () {
        done(new Error('Test invalidation'));
      });

      c3.on('msg', function () {
        done(new Error('Test invalidation'));
      });

      c1.send('join', 'room1');
      c2.send('join', 'room2');

      setTimeout(function () {
        c3.send('join', 'send');
      }, 100);
    });

    it('should allow sending to multiple rooms from client', function (done) {
      var total = 0
        , sender;

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

      function onmsg(msg) {
        expect(msg).to.be('hi');
        if (1 > --total) done();
      }

      var c1 = client()
        , c2 = client()
        , c3 = client()
        , c4 = client();

      c1.on('msg', onmsg);
      c2.on('msg', onmsg);
      c3.on('msg', onmsg);
      c4.on('msg', function () {
        done(new Error('Test invalidation'));
      });

      c1.send('join', 'room1');
      c2.send('join', 'room2');
      c3.send('join', 'room3');
      c4.send('join', 'send');
    });

    it('should allow sending to a single room from server', function (done) {
      primus.on('connection', function (spark) {
        spark.join('room1', function () {
          primus.room('room1').send('news');
        });
      });

      client().on('news', function () {
        done();
      });
    });

    it('should not allow broadcasting message with ack', function (done) {
      primus.on('connection', function (spark) {
        spark.join('room1', function () {
          expect(function () {
            primus.room('room1').send('news', function () {});
          }).to.throwException(/Callbacks are not supported/);
          done();
        });
      });

      client().on('news', function () {
        done();
      });
    });

    it('should allow sending to multiple rooms from server', function (done) {
      var total = 0;

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

      function onmsg(msg) {
        expect(msg).to.be('hi');
        if (1 > --total) done();
      }

      var c1 = client()
        , c2 = client()
        , c3 = client()
        , c4 = client();

      c1.on('msg', onmsg);
      c2.on('msg', onmsg);
      c3.on('msg', onmsg);
      c4.on('msg', function () {
        done(new Error('Test invalidation'));
      });

      c1.send('join','room1');
      c2.send('join','room2');
      c3.send('join','room3');
      c4.send('join','room4');
    });

    it('should return Primus instance when sending to a room from server', function() {
      expect(primus.room('room1').send('news')).to.be.a(Primus);
    });

    it('should allow sending to multiple rooms from server with `write`', function (done) {
      var total = 0;

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

      function data(msg) {
        expect(msg).to.be('hi');
        if (1 > --total) done();
      }

      var c1 = client()
        , c2 = client()
        , c3 = client()
        , c4 = client();

      c1.on('data', data);
      c2.on('data', data);
      c3.on('data', data);
      c4.on('data', function () {
        done(new Error('Test invalidation'));
      });

      c1.write('room1');
      c2.write('room2');
      c3.write('room3');
      c4.write('room4');
    });

    it('should still support broadcasting from server with primus-emitter `send`', function (done) {
      var total = 0;

      primus.on('connection', function () {
        if (3 === ++total) {
          primus.send('msg', 'hi');
        }
      });

      function onmsg(msg) {
        expect(msg).to.be('hi');
        if (1 > --total) done();
      }

      client().on('msg', onmsg);
      client().on('msg', onmsg);
      client().on('msg', onmsg);
    });
  });

  describe('primus-multiplex', function () {
    beforeEach(function () {
      primus.use('multiplex', 'primus-multiplex');
    });

    it('should allow joining a room', function (done) {
      var a = primus.channel('a');

      a.on('connection', function (spark) {
        spark.join('a', function () {
          done();
        });
      });

      client().channel('a');
    });

    it('should allow leaving a room', function (done) {
      var a = primus.channel('a');

      a.on('connection', function (spark) {
        spark.join('a');
        spark.leave('a', function () {
          done();
        });
      });

      client().channel('a');
    });

    it('should allow broadcasting a message to a client', function (done) {
      var a = primus.channel('a');

      a.on('connection', function (spark) {
        spark.on('data', function (room) {
          if ('broadcast' === room) {
            spark.room('r1').write('hi');
          } else {
            spark.join(room);
          }
        });
      });

      var c = client()
        , ch1 = c.channel('a')
        , ch2 = c.channel('a');

      ch1.on('data', function (msg) {
        expect(msg).to.be('hi');
        done();
      });

      ch1.write('r1');
      ch2.write('broadcast');
    });

    it('should allow broadcasting a message to multiple clients', function (done) {
      var a = primus.channel('a')
        , total = 3;

      a.on('connection', function (spark) {
        spark.on('data', function (room) {
          spark.join(room);
          if ('send' === room) {
            spark.room('r1 r2 r3').write('hi');
          }
        });
      });

      function ondata(msg) {
        expect(msg).to.be('hi');
        if (1 > --total) done();
      }

      var c = client()
        , ch1 = c.channel('a')
        , ch2 = c.channel('a')
        , ch3 = c.channel('a')
        , ch4 = c.channel('a');

      ch1.on('data', ondata);
      ch2.on('data', ondata);
      ch3.on('data', ondata);
      ch4.on('data', function () {
        done(new Error('Test invalidation'));
      });

      ch1.write('r1');
      ch2.write('r2');
      ch3.write('r3');
      ch4.write('send');
    });

    it('should allow broadcasting a message to multiple clients with channel `write` method', function (done) {
      var a = primus.channel('a')
        , total = 3;

      a.on('connection', function (spark) {
        spark.on('data', function (room) {
          spark.join(room);
          if ('send' === room) {
            a.room('r1 r2 r3').write('hi');
          }
        });
      });

      function ondata(msg) {
        expect(msg).to.be('hi');
        if (1 > --total) done();
      }

      var c = client()
        , ch1 = c.channel('a')
        , ch2 = c.channel('a')
        , ch3 = c.channel('a')
        , ch4 = c.channel('a');

      ch1.on('data', ondata);
      ch2.on('data', ondata);
      ch3.on('data', ondata);
      ch4.on('data', function () {
        done(new Error('Test invalidation'));
      });

      ch1.write('r1');
      ch2.write('r2');
      ch3.write('r3');
      ch4.write('send');
    });

    it('should allow broadcasting a message to multiple clients with channel `send` method', function (done) {
      primus.use('emitter', 'primus-emitter');

      var a = primus.channel('a')
        , total = 3;

      a.on('connection', function (spark) {
        spark.on('join', function (room) {
          spark.join(room);
          if ('send' === room) {
            a.room('r1 r2 r3').send('msg', 'hi');
          }
        });
      });

      function onmsg(msg) {
        expect(msg).to.be('hi');
        if (1 > --total) done();
      }

      var c = client()
        , ch1 = c.channel('a')
        , ch2 = c.channel('a')
        , ch3 = c.channel('a')
        , ch4 = c.channel('a');

      ch1.on('msg', onmsg);
      ch2.on('msg', onmsg);
      ch3.on('msg', onmsg);
      ch4.on('msg', function () {
        done(new Error('Test invalidation'));
      });

      ch1.send('join', 'r1');
      ch2.send('join', 'r2');
      ch3.send('join', 'r3');
      ch4.send('join', 'send');
    });

    it('should allow broadcasting a message to a client with emitter', function (done) {
      primus.use('emitter', 'primus-emitter');

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

      var c = client()
        , ch1 = c.channel('a')
        , ch2 = c.channel('a');

      ch1.on('msg', function (msg) {
        expect(msg).to.be('hi');
        done();
      });

      ch1.send('join', 'r1');
      ch2.send('msg', 'broadcast');
    });

    it('should allow broadcasting a message to multiple clients with emitter', function (done) {
      primus.use('emitter', 'primus-emitter');

      var a = primus.channel('a')
        , total = 3;

      a.on('connection', function (spark) {
        spark.on('join', function (room) {
          spark.join(room);
          if ('send' === room) {
            spark.room('r1 r2 r3').send('msg', 'hi');
            return;
          }
        });
      });

      function onmsg(msg) {
        expect(msg).to.be('hi');
        if (1 > --total) done();
      }

      var c = client()
        , ch1 = c.channel('a')
        , ch2 = c.channel('a')
        , ch3 = c.channel('a')
        , ch4 = c.channel('a');

      ch1.on('msg', onmsg);
      ch2.on('msg', onmsg);
      ch3.on('msg', onmsg);
      ch4.on('msg', function () {
        done(new Error('Test invalidation'));
      });

      ch1.send('join', 'r1');
      ch2.send('join', 'r2');
      ch3.send('join', 'r3');
      ch4.send('join', 'send');
    });

    it('should get all clients synchronously if no callback is provided using channel method', function (done) {
      var a = primus.channel('a')
        , total = 0
        , ids = [];

      a.on('connection', function (spark) {
        ids.push(spark.id);
        a.join(spark, 'room1');
        if (3 === ++total) {
          var clients = a.in('room1').clients();
          expect(clients).to.be.eql(ids);
          done();
        }
      });

      var c = client();
      c.channel('a');
      c.channel('a');
      c.channel('a');
    });

    it('should join spark to a room using channel method', function (done) {
      var a = primus.channel('a');

      a.on('connection', function (spark) {
        a.join(spark, 'room1', function () {
          spark.room('room1').clients(function (err, clients) {
            expect(!!~clients.indexOf(spark.id)).to.eql(true);
            done();
          });
        });
      });

      client().channel('a');
    });

    it('should remove spark form room using channel method', function (done) {
      var a = primus.channel('a');

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

      client().channel('a');
    });

    it('should trigger `joinroom` event when joining room', function (done) {
      var a = primus.channel('a');

      a.on('connection', function (spark) {
        spark.join('room1');
        spark.on('joinroom', function (room) {
          expect(room).to.be.eql('room1');
          done();
        });
      });

      client().channel('a');
    });

    it('should trigger `leaveroom` event when leaving room', function (done) {
      var a = primus.channel('a');

      a.on('connection', function (spark) {
        spark.join('room1', function () {
          spark.on('leaveroom', function (room) {
            expect(room).to.be.eql('room1');
            done();
          });
          spark.leave('room1');
        });
      });

      client().channel('a');
    });

    it('should trigger `leaveallrooms` events on client disconnect', function (done) {
      var a = primus.channel('a')
        , disconnected = false;

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

      var c = client()
        , ch = c.channel('a');

      ch.on('data', function (data) {
        if ('end' === data) ch.end();
      });
    });

    it('should trigger `joinroom` event when joining room using channel join method', function (done) {
      var a = primus.channel('a');

      a.on('connection', function (spark) {
        a.join(spark, 'room1');
        a.on('joinroom', function (room, socket) {
          expect(room).to.be.eql('room1');
          expect(spark).to.be.eql(socket);
          done();
        });
      });

      client().channel('a');
    });

    it('should trigger `leaveroom` event when leaving room using channel leave method', function (done) {
      var a = primus.channel('a');

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

      client().channel('a');
    });
  });
});
