// == BSD2 LICENSE ==

var salinity = require('salinity');
var expect = salinity.expect;
var sinon = salinity.sinon;

var clientFactory = require('../lib/client.js');
var httpClient = require('../lib/httpClient.js');

var hostGetter = {
  get: function () { return [{ protocol: 'http', host: 'billy:808080' }]; }
};
var apiHost = 'http://billy:808080';

describe('lib/client.js', function () {

  describe('methods on construction', function () {

    it('should have all methods when provided both serverName and serverSecret', function () {
      var client = clientFactory({ serverName: 'what\'s in a name?', serverSecret: 'wow!' }, hostGetter);
      var expectedMethods = ['getAnonymousPair', 'checkTokenForScopes', 'createUser',
        'getUserInfo', 'updateUser', 'getServerSecret'];
      expect(client).to.have.keys(expectedMethods);
      expectedMethods.forEach(function (methodName) {
        expect(client).to.respondTo(methodName);
      });
    });
  });

  describe('functionality', function () {
    var request;
    var client;

    var serverSecret = 'bob';

    beforeEach(function () {
      request = sinon.stub();
      client = clientFactory({ serverName: 'billy', serverSecret: serverSecret }, hostGetter, httpClient({}, request));
    });

    var internalScope = 'tidepool:internal';

    describe('getAnonymousPair', function () {
      it('should call back with error on error', function (done) {
        var theErr = { message: 'an error has occured' };
        request.callsArgWith(1, theErr);

        client.getAnonymousPair(function (err, pair) {
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

      it('should parse out a token when response exists', function (done) {
        var response = {
          statusCode: 200
        };
        request.callsArgWith(1, null, response, '{ "howdy": "hi" }');

        client.getAnonymousPair(function (err, pair) {
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

    describe('checkTokenForScopes', function () {
      it('should call back with error on error', function (done) {
        var theErr = { message: 'an error has occured' };
        request.onCall(0).callsArgWith(1, theErr);

        client.checkTokenForScopes(';lkj', internalScope, function (err, userData) {
          expect(err).to.deep.equal(theErr);
          expect(userData).to.not.exist;
          expect(request).to.have.been.calledOnce;
          expect(request.getCall(0).args[0]).to.deep.equals(
            {
              url: apiHost + '/token/;lkj/' + internalScope,
              method: 'GET',
              headers: {
                'x-tidepool-legacy-service-secret': serverSecret
              },
              rejectUnauthorized: false
            }
          );
          done();
        });
      });

      it('should call back with double null on non 200 response code', function (done) {
        request.onCall(0).callsArgWith(1, null, { statusCode: 201 }, '{ "howdy": "hi" }');

        client.checkTokenForScopes(';lkj', internalScope, function (err, userData) {
          expect(err).to.not.exist;
          expect(userData).to.not.exist;
          expect(request).to.have.been.calledOnce;
          expect(request.getCall(0).args[0]).to.deep.equals(
            {
              url: apiHost + '/token/;lkj/' + internalScope,
              method: 'GET',
              headers: {
                'x-tidepool-legacy-service-secret': serverSecret
              },
              rejectUnauthorized: false
            }
          );
          done();
        });
      });

      it('should call back with userdata on 200 response code', function (done) {
        request.onCall(0).callsArgWith(1, null, { statusCode: 200 }, '{ "howdy": "hi" }');

        client.checkTokenForScopes(';lkj', internalScope, function (err, userData) {
          expect(err).to.not.exist;
          expect(userData).deep.equals({ howdy: 'hi' });
          expect(request).to.have.been.calledOnce;
          expect(request.getCall(0).args[0]).to.deep.equals(
            {
              url: apiHost + '/token/;lkj/' + internalScope,
              method: 'GET',
              headers: {
                'x-tidepool-legacy-service-secret': serverSecret
              },
              rejectUnauthorized: false
            }
          );
          done();
        });
      });
    });

    describe('createUser', function () {
      it('should call back with error on error', function (done) {
        var theErr = { message: 'an error has occured' };
        request.onCall(0).callsArgWith(1, theErr, null);

        var user = { username: 'username', password: 'password', emails: ['username@password'] };

        client.createUser(user, function (err, userData) {
          expect(err).to.deep.equal(theErr);
          expect(userData).to.not.exist;
          expect(request).to.have.been.once;
          expect(request.getCall(0).args[0]).to.deep.equals(
            {
              url: apiHost + '/user',
              method: 'POST',
              headers: {
                'x-tidepool-legacy-service-secret': serverSecret
              },
              body: user,
              rejectUnauthorized: false
            }
          );
          done();
        });
      });

      it('should call back with double null on non 201 response code', function (done) {
        
        request.onCall(0).callsArgWith(1, null, { statusCode: 200 }, '{ "howdy": "hi" }');
        var user = { username: 'username', password: 'password', emails: ['username@password'] };

        client.createUser(user, function (err, userData) {
          expect(err).to.not.exist;
          expect(userData).to.not.exist;
          expect(request).to.have.been.calledOnce;
          expect(request.getCall(0).args[0]).to.deep.equals(
            {
              url: apiHost + '/user',
              method: 'POST',
              headers: {
                'x-tidepool-legacy-service-secret': serverSecret
              },
              body: user,
              rejectUnauthorized: false
            }
          );
          done();
        });
      });

      it('should call back with userdata on 201 response code', function (done) {
        request.onCall(0).callsArgWith(1, null, { statusCode: 201 }, '{ "howdy": "hi" }');
        var user = { username: 'username', password: 'password', emails: ['username@password'] };

        client.createUser(user, function (err, userData) {
          expect(err).to.not.exist;
          expect(userData).deep.equals({ howdy: 'hi' });
          expect(request).to.have.been.calledOnce;
          expect(request.getCall(0).args[0]).to.deep.equals(
            {
              url: apiHost + '/user',
              method: 'POST',
              headers: {
                'x-tidepool-legacy-service-secret': serverSecret
              },
              body: user,
              rejectUnauthorized: false
            }
          );
          done();
        });
      });
    });

    describe('getUserInfo', function () {
      it('should call back with error on error', function (done) {
        var theErr = { message: 'an error has occured' };
        request.onCall(0).callsArgWith(1, theErr);

        client.getUserInfo(';lkj', function (err, userData) {
          expect(err).to.deep.equal(theErr);
          expect(userData).to.not.exist;
          expect(request).to.have.been.calledOnce;
          expect(request.getCall(0).args[0]).to.deep.equals(
            {
              url: apiHost + '/user/;lkj',
              method: 'GET',
              headers: {
                'x-tidepool-legacy-service-secret': serverSecret
              },
              rejectUnauthorized: false
            }
          );
          done();
        });
      });

      it('should call back with double null on non 200 response code', function (done) {
        request.onCall(0).callsArgWith(1, null, { statusCode: 201 }, '{ "howdy": "hi" }');

        client.getUserInfo(';lkj', function (err, userData) {
          expect(err).to.not.exist;
          expect(userData).to.not.exist;
          expect(request).to.have.been.calledOnce;
          expect(request.getCall(0).args[0]).to.deep.equals(
            {
              url: apiHost + '/user/;lkj',
              method: 'GET',
              headers: {
                'x-tidepool-legacy-service-secret': serverSecret
              },
              rejectUnauthorized: false
            }
          );
          done();
        });
      });

      it('should call back with userdata on 200 response code', function (done) {
        request.onCall(0).callsArgWith(1, null, { statusCode: 200 }, '{ "howdy": "hi" }');

        client.getUserInfo(';lkj', function (err, userData) {
          expect(err).to.not.exist;
          expect(userData).deep.equals({ howdy: 'hi' });
          expect(request).to.have.been.calledOnce;
          expect(request.getCall(0).args[0]).to.deep.equals(
            {
              url: apiHost + '/user/;lkj',
              method: 'GET',
              headers: {
                'x-tidepool-legacy-service-secret': serverSecret
              },
              rejectUnauthorized: false
            }
          );
          done();
        });
      });
    });

    describe('updateUser', function () {
      it('should call back with userdata on 200 response code', function (done) {
        request.onCall(0).callsArgWith(1, null, { statusCode: 200 }, { "howdy": "hi" });

        client.updateUser(';lkj', { field: 'value' }, function (err, userData) {
          expect(err).to.not.exist;
          expect(request).to.have.been.calledOnce;
          expect(userData).deep.equals({ howdy: 'hi' });
          expect(request.getCall(0).args[0]).to.deep.equals(
            {
              url: apiHost + '/user/;lkj',
              method: 'PUT',
              headers: {
                'x-tidepool-legacy-service-secret': serverSecret
              },
              rejectUnauthorized: false,
              json: { updates: { field: 'value' } }
            }
          );
          done();
        });
      });
    });

  });
});
