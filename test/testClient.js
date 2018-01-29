// == BSD2 LICENSE ==

var salinity = require('salinity');
var expect = salinity.expect;
var sinon = salinity.sinon;

var clientFactory = require('../lib/client.js');
var httpClient = require('../lib/httpClient.js');

var hostGetter = {
  get: function(){ return [{ protocol: 'http', host: 'billy:808080' }];}
};
var apiHost = 'http://billy:808080';

describe('lib/client.js', function(){

  describe('methods on construction', function(){
    it('should only have methods that don\'t require a serverToken when no serverName passed in config', function(){
      var client = clientFactory({ serverSecret: 'wow!' }, hostGetter);
      var expectedMethods = ['login', 'getAnonymousPair'];
      expect(client).to.have.keys(expectedMethods);
      expectedMethods.forEach(function(methodName){
        expect(client).to.respondTo(methodName);
      });
    });

    it('should only have methods that don\'t require a serverToken when no serverSecret passed in config', function(){
      var client = clientFactory({ serverName: 'what\'s in a name?' }, hostGetter);
      var expectedMethods = ['login', 'getAnonymousPair'];
      expect(client).to.have.keys(expectedMethods);
      expectedMethods.forEach(function(methodName){
        expect(client).to.respondTo(methodName);
      });
    });

    it('should have all methods when provided both serverName and serverSecret', function(){
      var client = clientFactory({ serverName: 'what\'s in a name?', serverSecret: 'wow!' }, hostGetter);
      var expectedMethods = ['login', 'getAnonymousPair', 'checkToken', 'checkTokenForScopes', 'createUser',
        'getUserInfo', 'updateUser', 'withServerToken'];
      expect(client).to.have.keys(expectedMethods);
      expectedMethods.forEach(function(methodName){
        expect(client).to.respondTo(methodName);
      });
    });
  });

  describe('functionality', function(){
    var request;
    var client;

    beforeEach(function(){
      request = sinon.stub();
      client = clientFactory({ serverName: 'billy', serverSecret:'bob' }, hostGetter, httpClient({}, request));
    });

    var serverToken = 'xyz';
    function setupServerTokenCall(callNum) {
      request.onCall(callNum).callsArgWith(1, null, { statusCode: 200, headers: {'x-tidepool-session-token': serverToken } });
    }

    function expectServerTokenCall(callNum) {
      expect(request.getCall(callNum).args[0]).to.deep.equals(
        {
          url: apiHost + '/serverlogin',
          method: 'POST',
          headers: {
            'x-tidepool-server-name': 'billy',
            'x-tidepool-server-secret': 'bob'
          },
          rejectUnauthorized: false
        }
      );
    }

    describe('login', function(){
      it('should call back with error on error', function(done){
        var theErr = { message: 'an error has occured' };
        request.callsArgWith(1, theErr);

        client.login('username', 'password', function(err, token, userData){
          expect(err).to.deep.equal(theErr);
          expect(token).to.not.exist;
          expect(userData).to.not.exist;
          expect(request).to.have.been.calledOnce;
          expect(request).to.have.been.calledWith(
            {
              url: apiHost + '/login',
              method: 'POST',
              headers: {},
              auth: { user: 'username', pass: 'password' },
              rejectUnauthorized: false
            },
            sinon.match.func
          );
          done();
        });
      });

      it('should call back with double null when response not 200', function(done){
        request.callsArgWith(1, null, { statusCode: 201 }, '{ "howdy": "hi" }');

        client.login('username', 'password', function(err, token, userData){
          expect(err).to.not.exist;
          expect(token).to.not.exist;
          expect(userData).to.not.exist;
          expect(request).to.have.been.calledOnce;
          expect(request).to.have.been.calledWith(
            {
              url: apiHost + '/login',
              method: 'POST',
              headers: {},
              auth: { user: 'username', pass: 'password' },
              rejectUnauthorized: false
            },
            sinon.match.func
          );
          done();
        });
      });

      it('should call back with a token when response 200', function(done){
        var response = {
          statusCode: 200,
          headers: { 'x-tidepool-session-token': 'abcd' }
        };
        request.callsArgWith(1, null, response, '{ "howdy": "hi" }');

        client.login('username', 'password', function(err, token, userData){
          expect(err).to.not.exist;
          expect(token).to.equals('abcd');
          expect(userData).to.deep.equals({ howdy: 'hi' });
          expect(request).to.have.been.calledOnce;
          expect(request).to.have.been.calledWith(
            {
              url: apiHost + '/login',
              method: 'POST',
              headers: {},
              auth: { user: 'username', pass: 'password' },
              rejectUnauthorized: false
            },
            sinon.match.func
          );
          done();
        });
      });
    });

    describe('getAnonymousPair', function(){
      it('should call back with error on error', function(done){
        var theErr = { message: 'an error has occured' };
        request.callsArgWith(1, theErr);

        client.getAnonymousPair(function(err, pair){
          expect(err).to.deep.equal(theErr);
          expect(pair).to.not.exist;
          expect(request).to.have.been.calledOnce;
          expect(request).to.have.been.calledWith(
            {
              url: apiHost + '/private',
              method: 'GET',
              headers: {},
              rejectUnauthorized: false
            },
            sinon.match.func
          );
          done();
        });
      });

      it('should parse out a token when response exists', function(done){
        var response = {
          statusCode: 200
        };
        request.callsArgWith(1, null, response, '{ "howdy": "hi" }');

        client.getAnonymousPair(function(err, pair){
          expect(err).to.not.exist;
          expect(pair).to.deep.equals({ howdy: 'hi' });
          expect(request).to.have.been.calledOnce;
          expect(request).to.have.been.calledWith(
            {
              url: apiHost + '/private',
              method: 'GET',
              headers: {},
              rejectUnauthorized: false
            },
            sinon.match.func
          );
          done();
        });
      });
    });

    describe('checkToken', function(){
      it('should call back with error on error', function(done){
        var theErr = { message: 'an error has occured' };
        setupServerTokenCall(0);
        request.onCall(1).callsArgWith(1, theErr);

        client.checkToken(';lkj', function(err, userData){
          expect(err).to.deep.equal(theErr);
          expect(userData).to.not.exist;
          expect(request).to.have.been.calledTwice;
          expect(request.getCall(1).args[0]).to.deep.equals(
            {
              url: apiHost + '/token/;lkj',
              method: 'GET',
              headers: {
                'x-tidepool-session-token': serverToken
              },
              rejectUnauthorized: false
            }
          );
          expectServerTokenCall(0);
          done();
        });
      });

      it('should call back with double null on non 200 response code', function(done){
        setupServerTokenCall(0);
        request.onCall(1).callsArgWith(1, null, {statusCode: 201}, '{ "howdy": "hi" }');

        client.checkToken(';lkj', function(err, userData) {
          expect(err).to.not.exist;
          expect(userData).to.not.exist;
          expect(request).to.have.been.calledTwice;
          expect(request.getCall(1).args[0]).to.deep.equals(
            {
              url: apiHost + '/token/;lkj',
              method: 'GET',
              headers: {
                'x-tidepool-session-token': serverToken
              },
              rejectUnauthorized: false
            }
          );
          expectServerTokenCall(0);
          done();
        });
      });

      it('should call back with userdata on 200 response code', function(done){
        setupServerTokenCall(0);
        request.onCall(1).callsArgWith(1, null, {statusCode: 200}, '{ "howdy": "hi" }');

        client.checkToken(';lkj', function(err, userData) {
          expect(err).to.not.exist;
          expect(userData).deep.equals({ howdy: 'hi' });
          expect(request).to.have.been.calledTwice;
          expect(request.getCall(1).args[0]).to.deep.equals(
            {
              url: apiHost + '/token/;lkj',
              method: 'GET',
              headers: {
                'x-tidepool-session-token': serverToken
              },
              rejectUnauthorized: false
            }
          );
          expectServerTokenCall(0);
          done();
        });
      });
    });

    describe('createUser', function(){
      it('should call back with error on error', function(done){
        var theErr = { message: 'an error has occured' };
        setupServerTokenCall(0);
        request.onCall(1).callsArgWith(1, theErr);

        var user = { username: 'username', password: 'password', emails: ['username@password']};

        client.createUser(user, function(err, userData){
          expect(err).to.deep.equal(theErr);
          expect(userData).to.not.exist;
          expect(request).to.have.been.calledTwice;
          expect(request.getCall(1).args[0]).to.deep.equals(
            {
              url: apiHost + '/user',
              method: 'POST',
              headers: {
                'x-tidepool-session-token': serverToken
              },
              body: user,
              rejectUnauthorized: false
            }
          );
          expectServerTokenCall(0);
          done();
        });
      });

      it('should call back with double null on non 201 response code', function(done){
        setupServerTokenCall(0);
        request.onCall(1).callsArgWith(1, null, {statusCode: 200}, '{ "howdy": "hi" }');

        var user = { username: 'username', password: 'password', emails: ['username@password']};

        client.createUser(user, function(err, userData) {
          expect(err).to.not.exist;
          expect(userData).to.not.exist;
          expect(request).to.have.been.calledTwice;
          expect(request.getCall(1).args[0]).to.deep.equals(
            {
              url: apiHost + '/user',
              method: 'POST',
              headers: {
                'x-tidepool-session-token': serverToken
              },
              body: user,
              rejectUnauthorized: false
            }
          );
          expectServerTokenCall(0);
          done();
        });
      });

      it('should call back with userdata on 201 response code', function(done){
        setupServerTokenCall(0);
        request.onCall(1).callsArgWith(1, null, {statusCode: 201}, '{ "howdy": "hi" }');

        var user = { username: 'username', password: 'password', emails: ['username@password']};

        client.createUser(user, function(err, userData) {
          expect(err).to.not.exist;
          expect(userData).deep.equals({ howdy: 'hi' });
          expect(request).to.have.been.calledTwice;
          expect(request.getCall(1).args[0]).to.deep.equals(
            {
              url: apiHost + '/user',
              method: 'POST',
              headers: {
                'x-tidepool-session-token': serverToken
              },
              body: user,
              rejectUnauthorized: false
            }
          );
          expectServerTokenCall(0);
          done();
        });
      });
    });

    describe('getUserInfo', function(){
      it('should call back with error on error', function(done){
        var theErr = { message: 'an error has occured' };
        setupServerTokenCall(0);
        request.onCall(1).callsArgWith(1, theErr);

        client.getUserInfo(';lkj', function(err, userData){
          expect(err).to.deep.equal(theErr);
          expect(userData).to.not.exist;
          expect(request).to.have.been.calledTwice;
          expect(request.getCall(1).args[0]).to.deep.equals(
            {
              url: apiHost + '/user/;lkj',
              method: 'GET',
              headers: {
                'x-tidepool-session-token': serverToken
              },
              rejectUnauthorized: false
            }
          );
          expectServerTokenCall(0);
          done();
        });
      });

      it('should call back with double null on non 200 response code', function(done){
        setupServerTokenCall(0);
        request.onCall(1).callsArgWith(1, null, {statusCode: 201}, '{ "howdy": "hi" }');

        client.getUserInfo(';lkj', function(err, userData) {
          expect(err).to.not.exist;
          expect(userData).to.not.exist;
          expect(request).to.have.been.calledTwice;
          expect(request.getCall(1).args[0]).to.deep.equals(
            {
              url: apiHost + '/user/;lkj',
              method: 'GET',
              headers: {
                'x-tidepool-session-token': serverToken
              },
              rejectUnauthorized: false
            }
          );
          expectServerTokenCall(0);
          done();
        });
      });

      it('should call back with userdata on 200 response code', function(done){
        setupServerTokenCall(0);
        request.onCall(1).callsArgWith(1, null, {statusCode: 200}, '{ "howdy": "hi" }');

        client.getUserInfo(';lkj', function(err, userData) {
          expect(err).to.not.exist;
          expect(userData).deep.equals({ howdy: 'hi' });
          expect(request).to.have.been.calledTwice;
          expect(request.getCall(1).args[0]).to.deep.equals(
            {
              url: apiHost + '/user/;lkj',
              method: 'GET',
              headers: {
                'x-tidepool-session-token': serverToken
              },
              rejectUnauthorized: false
            }
          );
          expectServerTokenCall(0);
          done();
        });
      });
    });

    describe('updateUser', function(){
      it('should call back with userdata on 200 response code', function(done){
        setupServerTokenCall(0);
        request.onCall(1).callsArgWith(1, null, {statusCode: 200}, { "howdy": "hi" });

        client.updateUser(';lkj', {field: 'value'}, function(err, userData) {
          expect(err).to.not.exist;
          expect(userData).deep.equals({ howdy: 'hi' });
          expect(request).to.have.been.calledTwice;
          expect(request.getCall(1).args[0]).to.deep.equals(
            {
              url: apiHost + '/user/;lkj',
              method: 'PUT',
              headers: {
                'x-tidepool-session-token': serverToken
              },
              rejectUnauthorized: false,
              json: {updates: {field: 'value'}}
            }
          );
          expectServerTokenCall(0);
          done();
        });
      });
    });

    describe('withServerToken', function(){
      it('should call back with error on error', function(done){
        var theErr = { message: 'an error has occured' };
        request.callsArgWith(1, theErr);

        client.withServerToken(function(err, token){
          expect(err).to.deep.equal(theErr);
          expect(token).to.not.exist;
          expect(request).to.have.been.calledOnce;
          expect(request).to.have.been.calledWith(
            {
              url: apiHost + '/serverlogin',
              method: 'POST',
              headers: {
                'x-tidepool-server-name': 'billy',
                'x-tidepool-server-secret': 'bob'
              },
              rejectUnauthorized: false
            }
          );
          done();
        });
      });

      it('should call back with error on non 200 response code', function(done){
        request.callsArgWith(1, null, {statusCode: 201, headers: {'x-tidepool-session-token': serverToken}}, '{ "howdy": "hi" }');

        client.withServerToken(function(err, userData) {
          expect(err).to.have.property('statusCode').that.equals(503);
          expect(err).to.have.property('message');
          expect(userData).to.not.exist;
          expect(request).to.have.been.calledOnce;
          expect(request).to.have.been.calledWith(
            {
              url: apiHost + '/serverlogin',
              method: 'POST',
              headers: {
                'x-tidepool-server-name': 'billy',
                'x-tidepool-server-secret': 'bob'
              },
              rejectUnauthorized: false
            }
          );
          done();
        });
      });

      it('should call back with error on 200 response code and no token header', function(done){
        request.callsArgWith(1, null, {statusCode: 200, headers: {}}, '{ "howdy": "hi" }');

        client.withServerToken(function(err, userData) {
          expect(err).to.have.property('statusCode').that.equals(503);
          expect(err).to.have.property('message');
          expect(userData).to.not.exist;
          expect(request).to.have.been.calledOnce;
          expect(request).to.have.been.calledWith(
            {
              url: apiHost + '/serverlogin',
              method: 'POST',
              headers: {
                'x-tidepool-server-name': 'billy',
                'x-tidepool-server-secret': 'bob'
              },
              rejectUnauthorized: false
            }
          );
          done();
        });
      });

      it('should call back with serverToken on 200 response code', function(done){
        setupServerTokenCall(0);
        client.withServerToken(function(err, userData) {
          expect(err).to.not.exist;
          expect(userData).deep.equals(serverToken);
          expectServerTokenCall(0);
          done();
        });
      });
    });

  });
});
