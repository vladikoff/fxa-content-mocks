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
      var responderMocks = responses[responder.host];

      if (req.method === 'OPTIONS') {
        res.setHeader('access-control-allow-origin', '*');
        res.setHeader('access-control-max-age', '86400');
        res.setHeader('access-control-allow-methods', 'GET, HEAD, POST, PUT, DELETE, OPTIONS');
        res.setHeader('access-control-allow-headers', 'Authorization, Content-Type, If-None-Match');
        res.setHeader('access-control-expose-headers', 'WWW-Authenticate, Server-Authorization, Timestamp, Accept-Language');
        res.writeHead(200);
        res.end();
      } else {
        // use a fake response one by one.
        var fakeResponse = responderMocks.shift();
        fakeResponse.response.headers['content-encoding'] = 'identity';

        res.writeHead(200, fakeResponse.response.headers);
        res.end(JSON.stringify(fakeResponse.response.body));

      }
    }).listen(port);

    servers.push(server);
  });

  return {
    respond: function (suite) {
      // load JSON mocks for each server
      // File format: 127_0_0_1_9000_complete_sign_up.json
      responders.forEach(function(responder) {
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
    close: function() {
      servers.forEach(function(server) {
        server.close();
      });
    }
  }
};
