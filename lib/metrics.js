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

var url = require('url');

module.exports = function(hostGetter, config, log, httpClient) {
  var servername = config.serviceName || 'unnamed';
  if (httpClient == null) {
    httpClient = require('./httpClient.js')(config);
  }

  // we don't ever error or return anything from metrics and a null callback is supported
  function happyResponder(response, body, cb) {
    if (cb) {
      cb();
    }
  }

  // if we get an error, log it but don't return an error
  function errorResponder(cb) {
    return function(err) {
      log.info({metricsResponse: err});
      if (cb) {
        cb();
      }
    };
  }

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
        httpClient.requestTo(apiHost + '/server/' + servername + '/' + eventname)
          .withQuery(parms)
          .withHeader('x-tidepool-session-token', token)
          .whenStatus(200, happyResponder)
          .go(errorResponder(cb));
      });
    },

    postThisUser: function(eventname, parms, token, cb) {
      _withApiHost(cb, function(apiHost) {
        httpClient.requestTo(apiHost + '/thisuser/' + eventname)
          .withQuery(parms)
          .withHeader('x-tidepool-session-token', token)
          .whenStatus(200, happyResponder)
          .go(errorResponder(cb));
      });
    },

    postWithUser: function(userid, eventname, parms, token, cb) {
      _withApiHost(cb, function(apiHost) {
        httpClient.requestTo(apiHost + '/user/' + userid + '/' + eventname)
          .withQuery(parms)
          .withHeader('x-tidepool-session-token', token)
          .whenStatus(200, happyResponder)
          .go(errorResponder(cb));
      });
    }
  };
};
