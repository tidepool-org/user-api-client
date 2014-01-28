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

var expect = require('chai').expect;
// expect violates this jshint thing a lot, so we just suppress it
/* jshint expr: true */

var hakken = require('hakken')(
  {
    host: 'localhost:8000',
    heartbeatInterval: 1000,
    pollInterval: 1000,
    missedHeartbeatsAllowed: 3
  }
);
var hakkenClient = hakken.client.make();


function buildRequest(tok) {
  return {
    headers: {
      'x-tidepool-session-token': tok
    }
  };
}

function buildResponse() {
  return {
    statuscode: 200, // if not otherwise specified
    headers: {},
    send: function(x) {
      console.log(x);
      this.statuscode = x;
    },
    header: function(k, v) { this.headers[k] = v; }
  };
}

describe('user-api-client-local:', function () {
  var apiclient = null;

  before(function(done){
    setTimeout(
      function(){
        hakkenClient.start(function(err){
          if (err !== null) {
            throw err;
          }

          var watch = hakkenClient.watch('user-api');
          watch.start();

          apiclient = require('../lib/user-api-client.js')(
            {
              serverName: 'testServer',
              serverSecret: 'This is a shared server secret'
            },
            watch
          );

          setTimeout(done, 1000);
        });
      }, 1000);
  });

  describe('basics:', function () {
    it('should have an app', function () {
      expect(apiclient).to.exist;
    });
    it('should have checkToken method', function () {
      expect(apiclient).to.respondTo('checkToken');
    });
    it('should have getToken method', function () {
      expect(apiclient).to.respondTo('getToken');
    });
  });

  describe('simple test', function () {

    var servertoken = null;

    it('should give a 401 with a garbage token', function (done) {
      var req = buildRequest('123.abc.4342');
      var res = buildResponse();
      apiclient.checkToken(req, res, function(err) {
        expect(err).to.not.exist;
        expect(res.statuscode).to.equal(401);
        done();
      });
    });

    it('should be able to call getToken and get a useful result', function (done) {
      var req = { headers: {} };
      var res = buildResponse();
      apiclient.getToken(req, res, function(err) {
        expect(err).to.not.exist;
        expect(res.statuscode).to.equal(200);
        expect(res.headers).to.have.property('x-tidepool-session-token');
        servertoken = res.headers['x-tidepool-session-token'];
        done();
      });
    });

    it('should give a 200 with a real token', function (done) {
      var req = buildRequest(servertoken);
      var res = buildResponse();
      apiclient.checkToken(req, res, function(err) {
        expect(err).to.not.exist;
        expect(res.statuscode).to.equal(200);
        done();
      });
    });

  });
});