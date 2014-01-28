var url = require('url');
var util = require('util');

var amoeba = require('amoeba');
var pre = amoeba.pre;

module.exports = function(config, hostGetter, request) {
  if(request == null) {
    request = require('request');
  }

  var serverName = pre.hasProperty(config, 'serverName');
  var serverSecret = pre.hasProperty(config, 'serverSecret');
  var tokenRefreshInterval = pre.defaultProperty(config, 'tokenRefreshInterval', 60 * 60 * 1000);

  pre.notNull(hostGetter, "Must have a hostGetter");

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

  function withApiHost(errorCb, happyCb) {
    var hostSpec = hostGetter.get();
    if (hostSpec.length < 1) {
      return errorCb({ message: "No hosts available", statusCode: 503 });
    }
    happyCb(url.format(hostSpec[0]));
  }

  function getServerToken(cb)
  {
    withApiHost(cb, function(apiHost){
      var options = {
        url: apiHost + '/serverlogin',
        method: 'POST',
        headers: {
          'X-Tidepool-Server-Name': serverName,
          'X-Tidepool-Server-Secret': serverSecret
        }
      };

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
    });
  }

  function withServerToken(errorCb, happyCb) {
    if (serverToken != null) {
      return happyCb(serverToken);
    }

    if (callbacksWaiting.length > 0) {
      callbacksWaiting.push({ error: errorCb, happy: happyCb });
    }

    callbacksWaiting.push({ error: errorCb, happy: happyCb });
    return getServerToken(function(err, token){
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
      }, tokenRefreshInterval);

      cbs.forEach(function(cbObject){
        cbObject.happy(serverToken);
      });
    });
  }

  function withApiHostAndServerToken(errorCb, happyCb) {
    withServerToken(errorCb, function(serverToken) {
      withApiHost(errorCb, function(apiHost) {
        happyCb(apiHost, serverToken);
      })
    })
  }

  return {
    checkToken: function(token, cb) {
      withApiHostAndServerToken(cb, function(apiHost, serverToken) {
        var options = {
          url: apiHost + '/token/' + token,
          method: 'GET',
          headers: {
            'X-Tidepool-Session-Token': serverToken
          }
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

    createUser: function(userObj, cb) {
      pre.hasProperty(userObj, 'username');
      pre.hasProperty(userObj, 'password');
      pre.isType(pre.hasProperty(userObj, 'emails'), 'array');

      withApiHostAndServerToken(cb, function(apiHost, serverToken){
        var options = {
          url: apiHost + '/user',
          method: 'POST',
          headers: {
            'X-Tidepool-Session-Token': serverToken
          }
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

    login: function(username, password, cb) {
      withApiHost(cb, function(apiHost){
        var options = {
          url: apiHost + '/login',
          method: 'POST',
          headers: {
            'X-Tidepool-UserID': username,
            'X-Tidepool-Password': password
          }
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
    }
  }
}