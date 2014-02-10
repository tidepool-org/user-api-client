/*
== BSD2 LICENSE ==
*/

/***        ([order:2000])
  General: This is a library that makes it easier for servers that are talking to the 
  Tidepool User API.

  Setup: require('user-api-client')(config, hostGetter, request);
  Params:
    config -- an object containing configuration parameters
    hostGetter -- an object from hakken
    request -- (optional) -- the result of require('request'). If not supplied a new one will be created.
  
  Generates an object that has two members -- client and middleware.

  Heading: Client
 */

'use strict';

var url = require('url');
var util = require('util');

var _ = require('lodash');
var amoeba = require('amoeba');
var pre = amoeba.pre;

var clientLib = require('./httpClient.js');

module.exports = function(config, hostGetter, request, httpClient) {
  if (httpClient == null) {
    httpClient = clientLib(config, request);
  }

  var serverToServer = true;
  if (config.serverName == null || config.serverSecret == null) {
    serverToServer = false;
  }

  pre.defaultProperty(config, 'tokenRefreshInterval', 60 * 60 * 1000);
  pre.defaultProperty(config, 'pathPrefix', '');

  pre.notNull(hostGetter, 'Must have a hostGetter');

  /**
   * The current serverToken.
   *
   * @type {null}
   */
  var serverToken = null;

  /**
   * An array of callbacks waiting for the server token.  This is used to ensure that only one server token is gotten
   * at a time.
   *
   * @type {Array}
   */
  var callbacksWaiting = [];

  // if everything's OK, calls happyCb with the api host
  function _withApiHost(errorCb, happyCb) {
    var hostSpec = hostGetter.get();
    if (hostSpec.length < 1) {
      return errorCb({ message: 'No hosts available', statusCode: 503 });
    }
    happyCb(url.format(hostSpec[0]) + config.pathPrefix);
  }

  // tries to fetch the server token and calls cb(err, result)
  function _getServerToken(cb)
  {
    _withApiHost(cb, function(apiHost){
      httpClient.requestTo(apiHost + '/serverlogin')
        .withMethod('POST')
        .withHeader('x-tidepool-server-name', config.serverName)
        .withHeader('x-tidepool-server-secret', config.serverSecret)
        .whenStatus(
        200,
        function(res, body, callback){
          var sessionToken = res.headers['x-tidepool-session-token'];
          if (sessionToken != null) {
            callback(null, sessionToken);
          }
          else {
            callback({ statusCode: 503, message: 'Unable to initiate communications with user-api' });
          }
        })
        .withDefaultHandler(
        function(res, body, callback){
          return callback({ statusCode: 503, message: 'Bad status on communications with user-api' });
        })
        .go(cb);
/*

      request(options, function (err, res, body) {
        if (err) {
          return cb(err);
        }

        var sessionToken = res.headers['x-tidepool-session-token'];
        if ((sessionToken) && res.statusCode === 200) {
          return cb(null, sessionToken);
        } else {
          return cb({ message: util.format('No token returned or bad statusCode[%s]', res.statusCode), statusCode: 503 });
        }
      });
*/
    });
  }

  // retrieves the server token if possible and calls happyCb(token)
  // Keeps a queue of requests so everyone gets the same token
  function _withServerToken(errorCb, happyCb) {
    if (serverToken != null) {
      return happyCb(serverToken);
    }

    if (callbacksWaiting.length > 0) {
      callbacksWaiting.push({ error: errorCb, happy: happyCb });
    }

    callbacksWaiting.push({ error: errorCb, happy: happyCb });
    return _getServerToken(function(err, token){
      var cbs = callbacksWaiting;
      callbacksWaiting = [];

      if (err != null) {
        cbs.forEach(function(cbObject){
          cbObject.error(err);
        });
        return;
      }

      serverToken = token;
      setTimeout(function(){
        serverToken = null; // null out the token so another one is fetched
      }, config.tokenRefreshInterval).unref();

      cbs.forEach(function(cbObject){
        cbObject.happy(serverToken);
      });
    });
  }

  // calls happyCb with both an apiHost and a usable serverToken
  function _withApiHostAndServerToken(errorCb, happyCb) {
    _withServerToken(errorCb, function(serverToken) {
      _withApiHost(errorCb, function(apiHost) {
        happyCb(apiHost, serverToken);
      });
    });
  }

  function requestTo(path) {
    var options = {
      method: 'GET',
      headers: {},
      rejectUnauthorized: config.secureSsl
    };

    var statusHandlers = {};

    return {
      withMethod: function(method){
        options.method = method;
        return this;
      },
      withHeader: function(header, value) {
        options.headers[header] = value;
        return this;
      },
      withToken: function(token) {
        return this.withHeader('x-tidepool-session-token', token);
      },
      withBody: function(body) {
        options.body = body;
        return this;
      },

      /**
       * Registers a function to handle a specific response status code.
       *
       * The return value of the function will be passed to the callback provided on the go() method
       *
       * @param status either a numeric status code or an array of numeric status codes.
       * @param fn A function(response, body){} to use to extract the value from the response
       * @returns {exports}
       */
      whenStatus: function(status, fn) {
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
       * Issues the request and calls the given callback.
       * @param cb An idiomatic function(error, result){} callback
       * @returns {*}
       */
      go: function(cb) {
        var hostSpecs = hostGetter.get();
        if (hostSpecs.length < 1) {
          return cb({ statusCode: 503, message: "No hosts found" }, null);
        }
        options.url =

          request(
            util.format('%s%s%s', url.format(hostSpecs[0]), config.pathPrefix, path),
            options,
            function (err, res, body) {
              if (err != null) {
                return cb(err);
              } else if (statusHandlers[res.statusCode] != null) {
                return cb(null, statusHandlers[res.statusCode](res, body));
              } else {
                return cb({ statusCode: res.statusCode, message: util.inspect(body) });
              }
            }
          );
      }
    }
  }

  function parseJson(res, body) {
    return JSON.parse(body);
  }


  var retVal = {
    /***
     Function: login(username, password, cb)
     Desc: Frontend to the API call to log in a user
     Args: username -- string
     password -- password
     cb(err, response) -- the callback
     CallbackArgs: err -- null if no error, else an error object
     response -- result from the /user/login api call
     **/
    login: function (username, password, cb) {
      _withApiHost(cb, function (apiHost) {
        var options = {
          url: apiHost + '/login',
          method: 'POST',
          headers: {
            'X-Tidepool-UserID': username,
            'X-Tidepool-Password': password
          },
          rejectUnauthorized: config.secureSsl
        };

        request(options, function (error, res, body) {
          if (error != null) {
            return cb(error);
          }
          else if (res.statusCode == 200) {
            var userData = JSON.parse(body);
            return cb(null, res.headers['x-tidepool-session-token'], userData);
          }
          else {
            return cb(null, null);
          }
        });
      });
    },

    /***
     Function: getAnonymousPair(userid, cb)
     Desc: Frontend to the API call to retrieve a pair from the user object without storing it
     Args: userid -- Tidepool-assigned userid
     cb(err, response) -- the callback
     CallbackArgs: err -- null if no error, else an error object
     response -- result from the /user/private api call
     **/
    getAnonymousPair: function (cb) {
      _withApiHost(cb, function (apiHost) {
        var options = {
          url: apiHost + '/private',
          method: 'GET',
          rejectUnauthorized: config.secureSsl
        };

        request(options, function (error, response, body) {
          if (error != null) {
            return cb(error);
          }
          else {
            return cb(null, JSON.parse(body));
          }
        });
      });
    }
  };

  if (serverToServer) {
    _.extend(
      retVal,
      {
        /***
         Function: checkToken(token, cb)
         Desc: Frontend to the API call to check the validity of a server or user token
         Args: token -- the server token to be checked
         cb(err, response) -- the callback
         CallbackArgs: err -- null if no error, else an object
         response -- result from the /user/token api call
         **/
        checkToken: function (token, cb) {
          _withApiHostAndServerToken(cb, function (apiHost, serverToken) {
            var options = {
              url: apiHost + '/token/' + token,
              method: 'GET',
              headers: {
                'x-tidepool-session-token': serverToken
              },
              rejectUnauthorized: config.secureSsl
            };

            request(options, function (error, response, body) {
              if (error != null) {
                return cb(error);
              }
              else if (response.statusCode == 200) {
                return cb(null, JSON.parse(body));
              }
              else {
                return cb(null, null);
              }
            });
          });
        },

        /***
         Function: createUser(userObj, cb)
         Desc: Frontend to the API call to create a user
         Args: userObj -- object containing username, emails and password fields at minimum
         cb(err, response) -- the callback
         CallbackArgs: err -- null if no error, else an error object
         response -- result from the /user/user api call
         **/
        createUser: function (userObj, cb) {
          pre.hasProperty(userObj, 'username');
          pre.hasProperty(userObj, 'password');
          pre.isType(pre.hasProperty(userObj, 'emails'), 'array');

          _withApiHostAndServerToken(cb, function (apiHost, serverToken) {
            var options = {
              url: apiHost + '/user',
              method: 'POST',
              headers: {
                'x-tidepool-session-token': serverToken
              },
              rejectUnauthorized: config.secureSsl
            };

            request(options, function (error, res, body) {
              if (error != null) {
                return cb(error);
              }
              else if (res.statusCode == 201) {
                return cb(null, JSON.parse(body));
              }
              else {
                return cb(null, null);
              }
            });
          });
        },

        /***
         Function: getMetaPair(userid, cb)
         Desc: Frontend to the API call to retrieve the (id, hash) pair called 'meta' from the user/private object
         Args: userid -- Tidepool-assigned userid
         cb(err, response) -- the callback
         CallbackArgs: err -- null if no error, else an error object
         response -- result from the /user/private/:userid/meta api call
         **/
        getMetaPair: function (userid, cb) {
          pre.notNull(userid, "must specify a userid");

          _withApiHostAndServerToken(cb, function (apiHost, serverToken) {
            var options = {
              url: apiHost + '/private/' + userid + '/meta',
              method: 'GET',
              headers: {
                'x-tidepool-session-token': serverToken
              },
              rejectUnauthorized: config.secureSsl
            };

            request(options, function (error, response, body) {
              if (error != null) {
                return cb(error);
              }
              else if (response.statusCode == 200) {
                return cb(null, JSON.parse(body));
              }
              else {
                return cb(null, null);
              }
            });
          });
        },

        /***
         Function: withServerToken(cb)
         Desc: Calls CB with a valid server token, iff one can be retrieved
         Args: cb(err, token) -- the callback
         CallbackArgs: err -- always null if callback is called at all
         token -- a valid server token
         **/
        withServerToken: function (cb) {
          _withServerToken(cb, function (token) {
            cb(null, token);
          });
        }
      }
    )
  }

  return  retVal;
};