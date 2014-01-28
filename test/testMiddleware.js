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

describe('middleware.js', function () {
  var userClientApi = require('../index.js');

  var getTokenMiddleware = null;

  before(function(done){
    setTimeout(
      function(){
        hakkenClient.start(function(err){
          if (err !== null) {
            throw err;
          }

          var watch = hakkenClient.watch('user-api');
          watch.start();

          getTokenMiddleware = userClientApi.middleware.checkToken(userClientApi.client(
            {
              serverName: 'testServer',
              serverSecret: 'This is a shared server secret'
            },
            watch
          ));

          setTimeout(done, 1000);
        });
      }, 1000);
  });

  describe.skip('simple test', function () {

    var servertoken = null;

    it('should give a 401 with a garbage token', function (done) {
      var req = buildRequest('123.abc.4342');
      var res = buildResponse();
      getTokenMiddleware.checkToken(req, res, function(err) {
        expect(err).to.equal(false);
        expect(res.statuscode).to.equal(401);
        done();
      });
    });
  });
});