// == BSD2 LICENSE ==
// Copyright (c) 2014, Tidepool Project
// 
// This program is free software; you can redistribute it and/or modify it under
// the terms of the associated License, which is identical to the BSD 2-Clause
// License as published by the Open Source Initiative at opensource.org.
// 
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
// FOR A PARTICULAR PURPOSE. See the License for more details.
// 
// You should have received a copy of the License along with this program; if
// not, you can obtain one from Tidepool Project at tidepool.org.
// == BSD2 LICENSE ==

'use strict';

var salinity = require('salinity');
var expect = salinity.expect;
var mockableObject = salinity.mockableObject;
var sinon = salinity.sinon;
// expect violates this jshint thing a lot, so we just suppress it
/* jshint expr: true */

var middleware = require('../lib/middleware.js');

describe('middleware.js', function () {
  describe('expressify', function () {
    it('should call the callback on next(\'route\')', function () {
      var expressified = middleware.expressify(function (req, res, next) {
        next('route');
      });
      var called = false;
      expressified({}, {}, function (val) {
        expect(val).equals('route');
        called = true;
      });
      expect(called).to.be.true;
    });

    it('should not call the callback on next(false)', function () {
      var expressified = middleware.expressify(function (req, res, next) {
        next(false);
      });
      expressified({}, {}, function (val) {
        throw new Error('This should not be called');
      });
    });
  });

  describe('checkToken', function () {
    var userApiClient = mockableObject.make('checkToken');
    var agent;
    var errorOnServer = null;

    function checkTokenTests() {
      it('should return 401 if no token is set', function (done) {
        agent
          .get('/')
          .expect(401)
          .end(
          function (err, res) {
            if (errorOnServer != null) {
              throw errorOnServer;
            }
            done(err);
          });
      });

      it('should return 500 on some error', function (done) {
        sinon.stub(userApiClient, 'checkToken').callsArgWith(1, { message: 'something' });
        agent
          .get('/')
          .set('x-tidepool-session-token', '1234')
          .expect(500)
          .end(
          function (err, res) {
            if (errorOnServer != null) {
              throw errorOnServer;
            }
            done(err);
          });
      });

      it('should return the statusCode from the error if one is provided', function (done) {
        sinon.stub(userApiClient, 'checkToken').callsArgWith(1, { message: 'something', statusCode: 570 });
        agent
          .get('/')
          .set('x-tidepool-session-token', '1234')
          .expect(570)
          .end(
          function (err, res) {
            if (errorOnServer != null) {
              throw errorOnServer;
            }
            done(err);
          });
      });

      it('should return 401 when no error and no user info', function (done) {
        sinon.stub(userApiClient, 'checkToken').callsArgWith(1, null, null);
        agent
          .get('/')
          .set('x-tidepool-session-token', '1234')
          .expect(401)
          .end(
          function (err, res) {
            if (errorOnServer != null) {
              throw errorOnServer;
            }
            done(err);
          });
      });

      it('should get 200 and pass through _tokendata and _sessionToken when things are good', function (done) {
        var userData = { some: 'token data' };
        sinon.stub(userApiClient, 'checkToken').callsArgWith(1, null, userData);
        agent
          .get('/')
          .set('x-tidepool-session-token', '1234')
          .expect(
          250,
          {
            userData: userData,
            token: '1234'
          },
          function (err) {
            if (errorOnServer != null) {
              throw errorOnServer;
            }
            expect(userApiClient.checkToken).to.have.been.calledOnce;
            expect(userApiClient.checkToken).to.have.been.calledWith('1234', sinon.match.func);
            done(err);
          }
        );
      });
    }

    describe('restify', function () {
      var server;

      before(function (done) {
        server = require('restify').createServer(
          {
            name: 'restifyTestServer'
          }
        );

        server.get('/', middleware.checkToken(userApiClient), function (req, res, next) {
          res.send(250, {
            userData: req._tokendata,
            token: req._sessionToken
          });
          next();
        });
        server.on('uncaughtException', function (req, res, route, err) {
          errorOnServer = err;
          console.log('\nWOERIOEWJ', err);
          console.log(err.stack);
        });
        server.listen(21001, function (err) {
          agent = require('supertest')('http://localhost:21001');
          done(err);
        });
      });

      after(function (done) {
        server.close(done);
      });

      beforeEach(function () {
        mockableObject.reset(userApiClient);
      });

      checkTokenTests();
    });

    describe('express', function () {
      var server;

      before(function (done) {
        var app = require('express')();

        app.get(
          '/',
          middleware.expressify(middleware.checkToken(userApiClient)),
          function (req, res, next) {
            res.send(250, {
              userData: req._tokendata,
              token: req._sessionToken
            });
          },
          function (err, req, res, next) {
            errorOnServer = err;
          }
        );
        server = require('http').createServer(app);
        server.listen(21001, function (err) {
          agent = require('supertest')('http://localhost:21001');
          done(err);
        });
      });

      after(function (done) {
        server.close(done);
      });

      beforeEach(function () {
        mockableObject.reset(userApiClient);
        errorOnServer = null;
      });

      checkTokenTests();
    });
  });

  describe('getMeta', function () {
    function initDependencyHandler(req, res, next) { return next(); }

    var userApiClient = mockableObject.make('getMetaPair');
    var agent;
    var dependencyHandler = initDependencyHandler;
    var errorOnServer = null;

    function checkTokenTests() {
      it('should return 401 if no token is set', function (done) {
        agent
          .get('/')
          .expect(401)
          .end(
          function (err, res) {
            if (errorOnServer != null) {
              throw errorOnServer;
            }
            done(err);
          });
      });

      it('should return 500 on some error', function (done) {
        sinon.stub(userApiClient, 'getMetaPair').callsArgWith(1, { message: 'something' });
        dependencyHandler = function (req, res, next) {
          req._tokendata = { userid: 1234 };
          next();
        };
        agent
          .get('/')
          .expect(500)
          .end(
          function (err, res) {
            if (errorOnServer != null) {
              throw errorOnServer;
            }
            done(err);
          });
      });

      it('should return the statusCode from the error if one is provided', function (done) {
        sinon.stub(userApiClient, 'getMetaPair').callsArgWith(1, { message: 'something', statusCode: 570 });
        dependencyHandler = function (req, res, next) {
          req._tokendata = { userid: 1234 };
          next();
        };
        agent
          .get('/')
          .expect(570)
          .end(
          function (err, res) {
            if (errorOnServer != null) {
              throw errorOnServer;
            }
            done(err);
          });
      });

      it('should return 401 when no error and no user info', function (done) {
        sinon.stub(userApiClient, 'getMetaPair').callsArgWith(1, null, null);
        dependencyHandler = function (req, res, next) {
          req._tokendata = { userid: 1234 };
          next();
        };
        agent
          .get('/')
          .expect(401)
          .end(
          function (err, res) {
            if (errorOnServer != null) {
              throw errorOnServer;
            }
            done(err);
          });
      });

      it('should get 200 and pass through _metapair when things are good', function (done) {
        var metaPair = { id: 'some id', hash: 'a hash' };
        dependencyHandler = function (req, res, next) {
          req._tokendata = { userid: '1234' };
          next();
        };
        sinon.stub(userApiClient, 'getMetaPair').callsArgWith(1, null, metaPair);
        agent
          .get('/')
          .expect(
          250,
          { metapair: metaPair },
          function (err) {
            if (errorOnServer != null) {
              throw errorOnServer;
            }
            expect(userApiClient.getMetaPair).to.have.been.calledOnce;
            expect(userApiClient.getMetaPair).to.have.been.calledWith('1234', sinon.match.func);
            done(err);
          }
        );
      });

      it('should ignore requested userid but still succeed when not a server token', function (done) {
        var metaPair = { some: 'token data' };
        dependencyHandler = function (req, res, next) {
          req._tokendata = { userid: '5678' };
          next();
        };
        sinon.stub(userApiClient, 'getMetaPair').callsArgWith(1, null, metaPair);
        agent
          .get('/')
          .expect(
          250,
          { metapair: metaPair },
          function (err) {
            if (errorOnServer != null) {
              throw errorOnServer;
            }
            expect(userApiClient.getMetaPair).to.have.been.calledOnce;
            expect(userApiClient.getMetaPair).to.have.been.calledWith('5678', sinon.match.func);
            done(err);
          }
        );
      });

      it('should get pair for whatever userid is requested when provided a server token', function (done) {
        var metaPair = { some: 'token data' };
        dependencyHandler = function (req, res, next) {
          req._tokendata = { userid: '1234', isserver: true };
          req.params = { userid: 'abcd' };
          next();
        };
        sinon.stub(userApiClient, 'getMetaPair').callsArgWith(1, null, metaPair);
        agent
          .get('/')
          .expect(
          250,
          { metapair: metaPair },
          function (err) {
            if (errorOnServer != null) {
              throw errorOnServer;
            }
            expect(userApiClient.getMetaPair).to.have.been.calledOnce;
            expect(userApiClient.getMetaPair).to.have.been.calledWith('abcd', sinon.match.func);
            done(err);
          }
        );
      });
    }

    describe('restify', function () {
      var server;

      before(function (done) {
        server = require('restify').createServer(
          {
            name: 'restifyTestServer'
          }
        );

        server.get(
          '/',
          function (req, res, next) {
            dependencyHandler(req, res, next);
          },
          middleware.getMetaPair(userApiClient),
          function (req, res, next) {
            res.send(250, { metapair: req._metapair });
            next();
          }
        );
        server.on('uncaughtException', function (req, res, route, err) {
          errorOnServer = err;
        });
        server.listen(21001, function (err) {
          agent = require('supertest')('http://localhost:21001');
          done(err);
        });
      });

      after(function (done) {
        server.close(done);
      });

      beforeEach(function () {
        mockableObject.reset(userApiClient);
        dependencyHandler = initDependencyHandler;
        errorOnServer = null;
      });

      checkTokenTests();
    });

    describe('express', function () {
      var server;

      before(function (done) {
        var app = require('express')();

        app.get(
          '/',
          middleware.expressify(function (req, res, next) {
            dependencyHandler(req, res, next);
          }),
          middleware.expressify(middleware.getMetaPair(userApiClient)),
          function (req, res) {
            res.send(250, { metapair: req._metapair });
          },
          function (err, req, res, next) {
            errorOnServer = err;
          }
        );
        server = require('http').createServer(app);
        server.listen(21001, function (err) {
          agent = require('supertest')('http://localhost:21001');
          done(err);
        });
      });

      after(function (done) {
        server.close(done);
      });

      beforeEach(function () {
        mockableObject.reset(userApiClient);
        errorOnServer = null;
        dependencyHandler = initDependencyHandler;
      });

      checkTokenTests();
    });
  });
});