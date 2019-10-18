/*
 == BSD2 LICENSE ==
 */

/***        ([order:2000])
 General: This is a library that makes it easier for servers that are talking to the
 Tidepool User API.

 Setup: require('user-api-client')(config, hostGetter, request);
 Params:
 config -- an object containing configuration parameters
 hostGetter -- an object with a get() method.  The get() method should return an array of objects that can be
 passed into url.format() to produce a valid url to talk to.
 httpClient -- (optional) -- the result of require('./httpClient.js')(config). This is primarily exposed to allow
 for mocking in tests.  If not supplied a new "correct" one will be created.

 Generates an object that has two members -- client and middleware.

 Heading: Client
 */

'use strict';

var url = require('url');

var _ = require('lodash');
var amoeba = require('amoeba');
var pre = amoeba.pre;

function parseJsonHandler(res, body, cb) {
  return cb(null, JSON.parse(body));
}

function passthrough(res, body, cb) {
  return cb(null, body);
}

function giveThemNothingHandler(res, body, cb) {
  return cb(null, null);
}

module.exports = function (config, hostGetter, httpClient) {
  if (httpClient == null) {
    httpClient = require('./httpClient.js')(config);
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
  function _getServerToken(cb) {
    _withApiHost(cb, function (apiHost) {
      httpClient.requestTo(apiHost + '/serverlogin')
        .withMethod('POST')
        .withHeader('x-tidepool-server-name', config.serverName)
        .withHeader('x-tidepool-server-secret', config.serverSecret)
        .whenStatus(
        200,
        function (res, body, callback) {
          var sessionToken = res.headers['x-tidepool-session-token'];
          if (sessionToken != null) {
            callback(null, sessionToken);
          }
          else {
            throw new Error("Unable to initiate communications with user-api");
          }
        })
        .withDefaultHandler(
        function (res, body, callback) {
          throw new Error("Bad status on communications with user-api");
        })
        .go(cb);
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
    return _getServerToken(function (err, token) {
      var cbs = callbacksWaiting;
      callbacksWaiting = [];

      if (err != null) {
        cbs.forEach(function (cbObject) {
          cbObject.error(err);
        });
        return;
      }

      serverToken = token;
      setTimeout(function () {
        serverToken = null; // null out the token so another one is fetched
      }, config.tokenRefreshInterval).unref();

      cbs.forEach(function (cbObject) {
        cbObject.happy(serverToken);
      });
    });
  }

  // calls happyCb with both an apiHost and a usable serverToken
  function _withApiHostAndServerToken(errorCb, happyCb) {
    _withServerToken(errorCb, function (serverToken) {
      _withApiHost(errorCb, function (apiHost) {
        happyCb(apiHost, serverToken);
      });
    });
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
        httpClient.requestTo(apiHost + '/login')
          .withMethod('POST')
          .withAuth(username, password)
          .whenStatus(
          200,
          function (res, body, callback) {
            var userData = JSON.parse(body);
            return callback(null, res.headers['x-tidepool-session-token'], userData);
          })
          .withDefaultHandler(giveThemNothingHandler)
          .go(cb);
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
        httpClient.requestTo(apiHost + '/private')
          .withDefaultHandler(parseJsonHandler)
          .go(cb);
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
            httpClient.requestTo(apiHost + '/token/' + token)
              .withToken(serverToken)
              .whenStatus(200, parseJsonHandler)
              .withDefaultHandler(giveThemNothingHandler)
              .go(cb);
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
            httpClient.requestTo(apiHost + '/user')
              .withMethod('POST')
              .withToken(serverToken)
              .withBody(userObj)
              .whenStatus(201, parseJsonHandler)
              .withDefaultHandler(giveThemNothingHandler)
              .go(cb);
          });
        },

        /***
         Function: getUsersWithIds(userids, cb)
         Desc: Frontend to the API call to retrieve the public user information for an array of IDs
         Args: userids -- an array of Tidepool-assigned userid
         cb(err, response) -- the callback
         CallbackArgs: err -- null if no error, else an error object
         response -- result from the /users?id=id1,id2,id3... api call
         **/
        getUsersWithIds: function (userids, cb) {
          pre.notNull(userids, 'must specify userids');
          pre.isType(userids, 'array');

          _withApiHostAndServerToken(cb, function (apiHost, serverToken) {
            httpClient.requestTo(apiHost + '/users?id=' + _.join(userids))
              .withToken(serverToken)
              .whenStatus(200, parseJsonHandler)
              .withDefaultHandler(giveThemNothingHandler)
              .go(cb);
          });
        },

        /***
         Function: getUserInfo(userid, cb)
         Desc: Frontend to the API call to retrieve the public user information for a given ID
         Args: userid -- Tidepool-assigned userid
         cb(err, response) -- the callback
         CallbackArgs: err -- null if no error, else an error object
         response -- result from the /user/:userid/meta api call
         **/
        getUserInfo: function (userid, cb) {
          pre.notNull(userid, 'must specify a userid');

          _withApiHostAndServerToken(cb, function (apiHost, serverToken) {
            httpClient.requestTo(apiHost + '/user/' + userid)
              .withToken(serverToken)
              .whenStatus(200, parseJsonHandler)
              .withDefaultHandler(giveThemNothingHandler)
              .go(cb);
          });
        },

        /***
         Function: updateUser(userid, updates, cb)
         Desc: Frontend to the API call to change the public user information for a given ID
         Args: userid -- user identifier
         updates -- an object with updates
         cb(err, response) -- the callback
         CallbackArgs: err -- null if no error, else an error object
         response -- result from the /user/:userid/meta api call
         **/
        updateUser: function (userid, updates, cb) {
          pre.notNull(userid, 'must specify a userid');

          _withApiHostAndServerToken(cb, function (apiHost, serverToken) {
            httpClient.requestTo(apiHost + '/user/' + userid)
              .withMethod('PUT')
              .withToken(serverToken)
              .withJSON({updates: updates})
              .whenStatus(200, passthrough)
              .withDefaultHandler(giveThemNothingHandler)
              .go(cb);
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
    );
  }

  return  retVal;
};
