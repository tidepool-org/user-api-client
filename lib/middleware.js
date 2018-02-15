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

var _ = require('lodash');

var util = require('util');

var except = require('amoeba').except;

var log = require('./log.js')('middleware.js');

var sessionTokenHeader = 'x-tidepool-session-token';
var authorizationHeader = 'authorization';

/***
  Function: expressify(middlewareFn)
  Desc: Converts restify middleware into express middleware.
  Args: middlewareFn -- the restify middleware
  Returns: middleware that works with express
**/
exports.expressify = function (middlewareFn) {
  if (middlewareFn.length !== 3) {
    throw except.IAE('middlewareFn must be a 3 arg function, (req, res, next), had %s args', middelwareFn.length);
  }

  return function (req, res, next) {
    middlewareFn(req, res, function (err) {
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

function getSessionToken(request) {
  return request.headers[sessionTokenHeader]
}

function isSessionToken(request) {
  return !isBearerToken(request) && !_.isEmpty(getSessionToken(request));
}

function isBearerToken(request) {
  return !_.isEmpty(getBearerToken(request));
}

function getBearerToken(request) {
  var token = "";
  var accessTokenHeader = request.headers[authorizationHeader];
  if (!_.isEmpty(accessTokenHeader) && accessTokenHeader.toLowerCase().indexOf('bearer ') == 0) {
    var parts = accessTokenHeader.split(' ');
    if (parts.length === 2) {
      token = parts[1]
    }
  }
  return token;
}

/***
Function: checkToken(client, requiredScopes)
Desc: Middleware to process the session token or access token -- expects a token in a request header, processes it, and
      returns information about the token in the _tokendata variable on the request.
Args: client -- client to use when talking to the user-api
      requiredScopes - comma seperated string of scope(s) required to acces the API
**/
exports.checkToken = function (client, requiredScopes) {
  return function (req, res, next) {
    if (isBearerToken(req)) {
      var token = getBearerToken(req);
      client.checkTokenForScopes(token, requiredScopes, function (err, userData) {
        if (err) {
          if (err.statusCode != null) {
            res.send(err.statusCode);
            return next(false);
          }
          else {
            log.warn(err, 'Problem checking token[%s]', token);
            res.send(500);  // internal server error -- something broke
            return next(false);
          }
        }
        else if (userData == null) {
          // Bad token
          res.send(401, 'Invalid Token');
          return next(false);
        }
        else {
          req._sessionToken = token;
          req._tokendata = userData;
          return next();
        }
      });
    } else if (isSessionToken(req)) {
      var token = getSessionToken(req);
      client.checkToken(token, function (err, userData) {
        if (err) {
          if (err.statusCode != null) {
            res.send(err.statusCode);
            return next(false);
          }
          else {
            log.warn(err, 'Problem checking token');
            res.send(500);  // internal server error -- something broke
            return next(false);
          }
        }
        else if (userData == null) {
          // Bad token
          res.send(401, 'Invalid Token');
          return next(false);
        }
        else {
          req._sessionToken = token;
          req._tokendata = userData;
          return next();
        }
      });
    } else {
      res.send(401, 'Token must be set on header');
      return next(false);
    }
  };
};

exports.TidepoolInternalScope = 'tidepool:internal';
exports.TidepoolPublicScope = 'tidepool:public';