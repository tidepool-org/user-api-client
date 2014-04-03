'use strict';

var pre = require('amoeba').pre;

module.exports = function (config, request) {
  if (config == null) {
    config = {};
  }
  if (request == null) {
    request = require('request');
  }

  pre.defaultProperty(config, 'secureSsl', false);

  return {
    requestTo: function (url) {
      var options = {
        method: 'GET',
        headers: {},
        rejectUnauthorized: config.secureSsl
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
        withToken: function (token) {
          return this.withHeader('x-tidepool-session-token', token);
        },
        withBody: function (body) {
          options.body = body;
          return this;
        },
        withJSON: function(json) {
          options.json = json;
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