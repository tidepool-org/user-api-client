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
  it('should have a constant for the tidepool internal scope', function () {
    expect(middleware.TidepoolInternalScope).to.equal('tidepool:internal');
  });
  it('should have a constant for the tidepool public scope', function () {
    expect(middleware.TidepoolPublicScope).to.equal('tidepool:public');
  });
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
    var userApiClient = mockableObject.make('getServerSecret', 'checkTokenForScopes');
    var agent;
    var errorOnServer = null;
    var tidepoolPublicScope = 'tidepool:public';
    var legacyServiceSecretHeaderKey = 'x-tidepool-legacy-service-secret';
    var authorizationHeader = 'authorization';
    var bearerToken = 'Bearer 1234';
    var serverSecret = 'testing that we are secret';

    function checkTokenTests() {
      it('should return 401 if no token is set', function (done) {
        sinon.stub(userApiClient, 'getServerSecret');
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
        //sinon.stub(userApiClient, 'getServerSecret').callsArgWith(1, { 'something' });
        sinon.stub(userApiClient, 'getServerSecret');
        sinon.stub(userApiClient, 'checkTokenForScopes').callsArgWith(2, { message: 'something' }, tidepoolPublicScope);
        agent
          .get('/')
          .set(authorizationHeader, bearerToken)
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
        sinon.stub(userApiClient, 'getServerSecret');
        sinon.stub(userApiClient, 'checkTokenForScopes').callsArgWith(2, { message: 'something', statusCode: 911 }, tidepoolPublicScope);
        agent
          .get('/')
          .set(authorizationHeader, 'ssx')
          .expect(911)
          .end(
          function (err, res) {
            if (errorOnServer != null) {
              throw errorOnServer;
            }
            done(err);
          });
      });

      it('should return 401 when no error and no user info', function (done) {
        sinon.stub(userApiClient, 'getServerSecret');
        sinon.stub(userApiClient, 'checkTokenForScopes').callsArgWith(2, null, tidepoolPublicScope);
        agent
          .get('/')
          .set(legacyServiceSecretHeaderKey, 'wrong key')
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
        sinon.stub(userApiClient, 'getServerSecret').returns(serverSecret);
        sinon.stub(userApiClient, 'checkTokenForScopes').callsArgWith(2, null, userData, tidepoolPublicScope);
        agent
          .get('/')
          .set(authorizationHeader, bearerToken)
          .expect(
          200,
          {
            userData: userData,
            token: bearerToken
          },
          function (err) {
            if (errorOnServer != null) {
              throw errorOnServer;
            }
            expect(userApiClient.getServerSecret).to.have.been.calledOnce;
            expect(userApiClient.checkTokenForScopes).to.have.been.calledOnce;
            expect(userApiClient.checkTokenForScopes).to.have.been.calledWith(bearerToken, tidepoolPublicScope, sinon.match.func);
            done(err);
          }
          );
      });

      it('should get 200 and pass through _tokendata when things are good with server secret', function (done) {
        var userData = { some: 'access token data' };
        sinon.stub(userApiClient, 'getServerSecret').returns(serverSecret);
        sinon.stub(userApiClient, 'checkTokenForScopes').callsArgWith(2, null, userData, tidepoolPublicScope);
        agent
          .get('/')
          .set(legacyServiceSecretHeaderKey, serverSecret)
          .expect(
          200,
          {
            userData: { userid: legacyServiceSecretHeaderKey },
          },
          function (err) {
            if (errorOnServer != null) {
              throw errorOnServer;
            }
            expect(userApiClient.getServerSecret).to.have.been.calledOnce;
            expect(userApiClient.checkTokenForScopes).to.have.not.been.called;
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

        server.get('/', middleware.checkToken(userApiClient, tidepoolPublicScope), function (req, res, next) {
          res.send(200, {
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
          middleware.expressify(middleware.checkToken(userApiClient, tidepoolPublicScope)),
          function (req, res, next) {
            res.status(200).send({
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
});
