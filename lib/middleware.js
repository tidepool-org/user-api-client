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
/***              ([order: 4000])
  Heading: Middleware
 */

'use strict';

var util = require('util');

var except = require('amoeba').except;

var log = require('./log.js')('middleware.js');

var sessionTokenHeader = 'x-tidepool-session-token';

/***
  Function: expressify(middlewareFn)
  Desc: Converts restify middleware into express middleware.
  Args: middlewareFn -- the restify middleware
  Returns: middleware that works with express
**/
exports.expressify = function(middlewareFn) {
  if (middlewareFn.length !== 3) {
    throw except.IAE('middlewareFn must be a 3 arg function, (req, res, next), had %s args', middelwareFn.length);
  }

  return function(req, res, next) {
    middlewareFn(req, res, function(err) {
      if (err != null) {
        if (err !== false) {
          next(err)
        }
      }
      else {
        next();
      }
    });
  };
};

/***
  Function: checkToken(client)
  Desc: Middleware to process the session token -- expects a token in a request header, processes it, and
        returns information about the token in the _tokendata variable on the request.
  Args: client -- client to use when talking to the user-api**/
exports.checkToken = function (client) {
  return function(req, res, next) {
    var sessionToken = req.headers[sessionTokenHeader];

    if (sessionToken == null) {
      res.send(401, util.format('Session token must be set on header[%s]', sessionTokenHeader));
      return next(401);
    }

    client.checkToken(sessionToken, function(err, userData){
      if (err) {
        if (err.statusCode != null) {
          res.send(err.statusCode);
          return next(err.statusCode);
        }
        else {
          log.warn(err, 'Problem checking token[%s]', sessionToken);
          res.send(500);  // internal server error -- something broke
          return next(500);
        }
      }
      else if (userData == null) {
        // Bad token
        res.send(401, 'Invalid Token');
        return next(401);
      }
      else {
        req._sessionToken = sessionToken;
        req._tokendata = userData;
        return next();
      }
    });
  };
};
