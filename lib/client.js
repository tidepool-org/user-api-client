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

  pre.defaultProperty(config, 'tokenRefreshInterval', 60 * 60 * 1000);
  pre.defaultProperty(config, 'pathPrefix', '');

  pre.notNull(hostGetter, 'Must have a hostGetter');

  // if everything's OK, calls happyCb with the api host
  function _withApiHost(errorCb, happyCb) {
    var hostSpec = hostGetter.get();
    if (hostSpec.length < 1) {
      return errorCb({ message: 'No hosts available', statusCode: 503 });
    }
    happyCb(url.format(hostSpec[0]) + config.pathPrefix);
  }

  // retrieves the server token if possible and calls happyCb(token)
  // Keeps a queue of requests so everyone gets the same token
  function _withServerSecret(errorCb, happyCb) {
    if (config.serverSecret != null) {
      return happyCb(config.serverSecret);
    }
  }

  // calls happyCb with both an apiHost and a usable secret
  function _withApiHostAndServerSecret(errorCb, happyCb) {
    _withServerSecret(errorCb, function (secret) {
      _withApiHost(errorCb, function (apiHost) {
        happyCb(apiHost, secret);
      });
    });
  }

  var retVal = {
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
    },

    /***
     Function: checkTokenForScopes(token, requiredScopes, cb)
      Desc: Frontend to the API call to check the validity of a server or user token
      Args: token -- the server token to be checked
            requiredScopes -- the scopes the token requires
      cb(err, response) -- the callback
      CallbackArgs: err -- null if no error, else an object
      response -- result from the /user/token api call
      **/
    checkTokenForScopes: function (token, requiredScopes, cb) {
      _withApiHostAndServerSecret(cb, function (apiHost, secret) {
        httpClient.requestTo(apiHost + '/token/' + token + '/' + requiredScopes)
          .withSecret(secret)
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

      _withApiHostAndServerSecret(cb, function (apiHost, secret) {
        httpClient.requestTo(apiHost + '/user')
          .withMethod('POST')
          .withSecret(secret)
          .withBody(userObj)
          .whenStatus(201, parseJsonHandler)
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
      _withApiHostAndServerSecret(cb, function (apiHost, secret) {
        httpClient.requestTo(apiHost + '/user/' + userid)
          .withSecret(secret)
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

      _withApiHostAndServerSecret(cb, function (apiHost, secret) {
        httpClient.requestTo(apiHost + '/user/' + userid)
          .withMethod('PUT')
          .withSecret(secret)
          .withJSON({updates: updates})
          .whenStatus(200, passthrough)
          .withDefaultHandler(giveThemNothingHandler)
          .go(cb);
      });
    },
    /***
     Function: getServerSecret()
      Desc: Frontend to the API call to change the public user information for a given ID
      returns: the server secret
      **/
    getServerSecret: function() {
      return config.serverSecret;
    }
  };

  return  retVal;
};
