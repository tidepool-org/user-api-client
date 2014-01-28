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
    host: 'localhost:20000',
    heartbeatInterval: 1000,
    pollInterval: 1000,
    missedHeartbeatsAllowed: 3
  }
);
var hakkenServer = hakken.server;
var hakkenClient = hakken.client.make();


function buildRequest(tok) {
  return {
    headers: {
      'x-tidepool-session-token': tok
    }
  };
}

function buildResponse() {
  return {};
}

describe('user-api-client:', function () {
  var apiclient = null;

  before(function(done){
    hakkenServer.makeSimple('localhost', '20000').start();

    // Setup and start user-api here.

    setTimeout(
      function(){
        hakkenClient.start(function(err){
          if (err != null) {
            throw err;
          }

          var watch = hakkenClient.watch('user-api');
          watch.start();

          apiclient = require('../lib/user-api-client.js')(
            {
              serverName: 'testServer',
              serverSecret: '1234'
            },
            watch
          );

          setTimeout(done, 1000);
        })
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

    it('should be callable', function (done) {
      apiclient.checkToken(buildRequest('123.abc.4342'), buildResponse(), function(err, result) {
        expect(err).to.not.exist;
        expect(result).to.exist;
        done();
      });
    });

  });
});