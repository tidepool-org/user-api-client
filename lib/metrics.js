// module to set up metrics

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

var request = require('request');
var url = require('url');

module.exports = function(hostGetter, config, log) {
  var servername = config.serviceName || 'unnamed';

  function _withApiHost(errorCb, happyCb) {
    var hostSpec = hostGetter.get();
    if (hostSpec.length < 1) {
      return errorCb({ message: 'No metrics hosts available', statusCode: 503 });
    }
    happyCb(url.format(hostSpec[0]));
  }

  return {
    postServer: function(eventname, parms, token, cb) {
      _withApiHost(cb, function(apiHost) {
        var reqOptions = {
          uri: apiHost + '/server/' + servername + '/' + eventname,
          qs: parms,
          headers: { 'x-tidepool-session-token': token },
          method: 'GET',
        };
        // 4/8/14 -- leaving this here until metrics stabilizes
        log.info({options: reqOptions});
        request(reqOptions, function (error, response, body) {
          if (error) {
            log.error(error);
          }
          return cb();
        });
      });
    },

    postThisUser: function(eventname, parms, token, cb) {
      _withApiHost(cb, function(apiHost) {
        var reqOptions = {
          uri: apiHost + '/thisuser/' + eventname,
          qs: parms,
          headers: { 'x-tidepool-session-token': token },
          method: 'GET',
        };
        // 4/8/14 -- leaving this here until metrics stabilizes
        log.info({options: reqOptions});
        request(reqOptions, function (error, response, body) {
          if (error) {
            log.error(error);
          }
          return cb();
        });
      });
    },

    postWithUser: function(userid, eventname, parms, token, cb) {
      _withApiHost(cb, function(apiHost) {
        var reqOptions = {
          uri: apiHost + '/user/' + userid + '/' + eventname,
          qs: parms,
          headers: { 'x-tidepool-session-token': token },
          method: 'GET',
        };
        // 4/8/14 -- leaving this here until metrics stabilizes
        log.info({options: reqOptions});
        request(reqOptions, function (error, response, body) {
          if (error) {
            log.error(error);
          }
          return cb();
        });
      });
    }
  };
};
