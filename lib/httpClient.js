'use strict';

var _ = require('lodash');
var axios = require('axios');
var https = require('https');

var pre = require('amoeba').pre;

module.exports = function (config, request) {
  if (config == null) {
    config = {};
  }
  if (request == null) {
    var mapKeys = function(options, keyMap) {
      return _.mapKeys(options, function(_, key) {
        return keyMap[key] || key;
      });
    };
    request = function(options, cb) {
      options = mapKeys(options, {body: 'data', qs: 'params'});
      if (options.auth) {
        options.auth = mapKeys(options.auth, {user: 'username', pass: 'password'});
      }
      options.transformResponse = res => res; // Do not automatically parse JSON
      axios(options)
        .then(function (res) {
          res = mapKeys(res, {status: 'statusCode', data: 'body'});
          cb(null, res, res.body);
        })
        .catch(function (err) {
          cb(err);
        });
    };
  }

  pre.defaultProperty(config, 'secureSsl', false);

  return {
    requestTo: function (url) {
      var options = {
        method: 'GET',
        headers: {},
        httpsAgent: new https.Agent({
          rejectUnauthorized: config.secureSsl
        }),
        validateStatus: null,
      };

      var statusHandlers = {};
      var defaultHandler = null;

      return {
        withMethod: function (method) {
          options.method = method;
          return this;
        },
        withHeader: function (header, value) {
          options.headers[header] = value;
          return this;
        },
        withContentType: function(type) {
          return this.withHeader('content-type', type);
        },
        withToken: function (token) {
          return this.withHeader('x-tidepool-session-token', token);
        },
        withBody: function (body) {
          options.body = body;
          return this;
        },
        withJSON: function(json) {
          return this.withContentType('application/json').withBody(JSON.stringify(json));
        },
        withQuery: function(queryObj) {
          options.qs = queryObj;
          return this;
        },
        withAuth: function(username, password) {
          options.auth = { user: username, pass: password };
          return this;
        },

        /**
         * Registers a function to handle a specific response status code.
         *
         * The function provided is in charge of calling the callback and continuing the execution chain
         *
         * @param status either a numeric status code or an array of numeric status codes.
         * @param fn A function(response, body, cb){} to use to extract the value from the response
         * @returns {exports}
         */
        whenStatus: function (status, fn) {
          if (Array.isArray(status)) {
            for (var i = 0; i < status.length; ++i) {
              this.whenStatus(status[i], fn);
            }
            return this;
          }

          statusHandlers[status] = fn;
          return this;
        },

        /**
         * Attaches a default handler that will be called if none of the status Handlers match.
         *
         * The normal default handling behavior is to call the callback with an error that looks like
         *
         * { statusCode: res.statusCode, message: body }
         *
         * @param fn A function(res, body, cb){} that will handle non-registered status codes
         * @returns {exports}
         */
        withDefaultHandler: function(fn) {
          defaultHandler = fn;
          return this;
        },

        /**
         * Issues the request and calls the given callback.
         * @param cb An idiomatic function(error, result){} callback
         * @returns {*}
         */
        go: function (cb) {
          options.url = url;
          request(
            options,
            function (err, res, body) {
              if (err != null) {
                return cb(err);
              } else if (statusHandlers[res.statusCode] != null) {
                return statusHandlers[res.statusCode](res, body, cb);
              } else {
                if (defaultHandler != null) {
                  return defaultHandler(res, body, cb);
                }
                return cb({ statusCode: res.statusCode, message: body });
              }
            }
          );
        }
      };
    }
  };
};