var fs = require('fs');
var http = require('http');
var path = require('path');
var url = require('url');

module.exports = function (responders, options) {
  options = options || {};
  var directory = options.directory || path.join(process.cwd(), 'mocks');
  var responses = [];
  var servers = [];

  responders.forEach(function (responder) {
    var port = url.parse(responder.host).port;

    var server = http.createServer(function (req, res) {
      setTimeout(function () {
        var responderMocks = responses[responder.host];

          // use a fake response one by one.
          var fakeResponse = responderMocks.shift();
          fakeResponse.response.headers['content-encoding'] = 'identity';

          res.writeHead(200, fakeResponse.response.headers);
          res.end(JSON.stringify(fakeResponse.response.body));
      }, 200);
    }).listen(port);

    servers.push(server);
  });

  return {
    respond: function (suite) {
      // load JSON mocks for each server
      // File format: 127_0_0_1_9000_complete_sign_up.json
      responders.forEach(function (responder) {
        var host = responder.host;
        var port = url.parse(host).port;
        var hostname = url.parse(host).hostname.replace(/\./g, '_');
        var suiteName = suite.name.replace(/ /g, '_');
        var mockFileName = [hostname, port, suiteName].join('_') + '.json';
        var mockFilePath = path.join(directory, mockFileName);

        var exists = fs.existsSync(mockFilePath);

        if (exists) {
          console.log('Responding to', suite.name, 'with', mockFilePath);
          responses[host] = JSON.parse(fs.readFileSync(mockFilePath));
        } else {
        }
      });
    },
    close: function () {
      servers.forEach(function (server) {
        server.close();
      });
    }
  }
};
