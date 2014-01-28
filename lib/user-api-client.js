/*
== BSD2 LICENSE ==
Copyright (c) 2014, Tidepool Project

This program is free software; you can redistribute it and/or modify it under
the terms of the associated License, which is identical to the BSD 2-Clause
License as published by the Open Source Initiative at opensource.org.

This program is distributed in the hope that it will be useful, but WITHOUT
ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
FOR A PARTICULAR PURPOSE. See the License for more details.

You should have received a copy of the License along with this program; if
not, you can obtain one from Tidepool Project at tidepool.org.
== BSD2 LICENSE ==
*/
'use strict';

var url = require('url');

var request = require('request');

module.exports = function (config, hostGetter) {

  // Retrieve a host for the API we're fronting (calls into hakken)
  function getAPIHost() {
    //we just want the first one in this instance
    var hostSpec = hostGetter.get();
    if (hostSpec.length > 0) {
      return url.format(hostSpec[0]);
    }
    return null;
  }

  // Middleware to process the session token -- expects a token
  // in a request header, processes it, and returns information about the token
  // in the _tokendata variable on the request.
  function checkToken(req, res, next) {

    var sessionToken = req.headers['x-tidepool-session-token'];

    var apiHost = getAPIHost();
    if (!apiHost) {
      res.send(503);   // service unavailable -- since we can't find it
      return next('no service found');
    }

    var options = {
      url: apiHost + '/token/' + sessionToken,
      method: 'GET',
      headers: {
        'X-Tidepool-Session-Token': sessionToken
      }
    };

    request(options, function (error, response, body) {

      if (error) {
        res.send(500);  // internal server error -- something broke
        return next(error);
      }

      if (response.statusCode == 200) {
        var tokendata = JSON.parse(body);
        if (tokendata.userid) {
          req._tokendata = { 
            userid: tokendata.userid,
            isserver: tokendata.isserver
          };
          return next();
        }
      }

      // token was bad, so let them know
      res.send(401);
      return next();

    });
  }

  function getToken(req, res, next) {

    if (!req.headers['x-tidepool-session-token']) {

      // no token so let's get one
      var apiHost = getAPIHost();
      if (apiHost === null) {
        res.send(503);  // couldn't find the host, so service unavailable 
        return next('no service found');
      }

      var options = {
        url: apiHost + '/serverlogin',
        method: 'POST',
        headers: {
          'X-Tidepool-Server-Name': config.serverName,
          'X-Tidepool-Server-Secret': config.serverSecret
        }
      };

      request(options, function (error, response, body) {

        if (error) {
          res.send(503);
          return next(error);
        }

        var sessionToken = response.headers['x-tidepool-session-token'];
        if ((sessionToken) && response.statusCode === 200) {
          res.header('x-tidepool-session-token', sessionToken);
        } else {
          res.send(401);
        }

        return next();
      });

    } else {
      res.header('x-tidepool-session-token', req.headers['x-tidepool-session-token']);
      return next();
    }
  }

  return {
    checkToken: checkToken,
    getToken: getToken
  };

};
