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

/**
 * Middleware to process the session token -- expects a token in a request header, processes it, and
 * returns information about the token in the _tokendata variable on the request.
 *
 * @param client client to use when talking to the user-api
 * @returns {{checkToken: checkToken}}
 */
module.exports = function (client) {

  return {
    checkToken: function(req, res, next) {
      var sessionToken = req.headers['x-tidepool-session-token'];

      client.checkToken(sessionToken, function(err, userData){
        if (err) {
          if (err.statusCode != null) {
            res.send(err.statusCode);
            return next(false);
          }
          else {
            res.send(500);  // internal server error -- something broke
            return next(err);
          }
        }
        else if (userData == null) {
          // Bad token
          res.send(401);
          return next(false);
        }
        else {
          req._tokendata = userData;
          return next();
        }
      });
    },

    getMetaPair: function(req, res, next) {
      // if our token is a user token, we can only return that user's information
      var userid = req._tokendata.userid;
      // but if it's a server token, then use the userid specified
      if (req._tokendata.isserver) {
        userid = req.params.userid;
      }

      client.getMetaPair(userid, function(err, pair) {
        if (err) {
          if (err.statusCode != null) {
            res.send(err.statusCode);
            return next(false);
          }
          else {
            res.send(500);  // internal server error -- something broke
            return next(err);
          }
        }
        else if (pair == null) {
          // Bad token
          res.send(401);
          return next(false);
        }
        else {
          req._metapair = pair;
          return next();
        }
      });
    }

  };
};
