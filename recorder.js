var fs = require('fs');
var httpProxy = require('http-proxy');
var zlib = require('zlib');
var path = require('path');

module.exports = function (proxies, opts) {
  var self = this;

  self.responses = {};
  self.toRespond = [];
  self.servers = [];

  proxies.forEach(function (proxyConfig) {

    var proxy = new httpProxy.createProxyServer({
      target: proxyConfig.hostTarget
    });
    proxy.target = proxyConfig.hostTarget;
    self.responses[proxy.target] = [];

    console.log('Proxy Started on', proxyConfig.proxyPort, 'for', proxyConfig.hostTarget);
    proxy.listen(proxyConfig.proxyPort);

//
// Listen for the `error` event on `proxy`.
    proxy.on('error', function (err, req, res) {
      res.writeHead(500, {
        'Content-Type': 'text/plain'
      });

      res.end('Something went wrong. And we are reporting a custom error message.');
    });

//
// Listen for the `proxyRes` event on `proxy`.
//
    proxy.on('proxyRes', function (res) {
      var chunks = [];

      res.on('data', function (chunk) {
        chunks.push(chunk);
      });

      res.on('end', function () {
        var buffer = Buffer.concat(chunks);

        if (res.headers['content-encoding'] && res.headers['content-encoding'].match(/(gzip|deflate)/)) {
          zlib.gunzip(buffer, function (err, body) {
            try {
              body = JSON.parse(body);
            } catch (e) {
            }

            self._collectResponse(res, body, proxy.target);
          });
        }
        // else no encoding
        else {
          var body = buffer;
          try {
            body = JSON.parse(buffer);
          } catch (e) {
          }

          self._collectResponse(res, body, proxy.target);

        }
      });

      //console.log('RAW Response from the target', JSON.stringify(res.headers, true, 2));
    });

  });

  self._collectResponse = function (res, body, target) {
    if (res.req.method !== 'OPTIONS') {
      console.log('saving', res.req.path);

      self.responses[target].push({
        request: {
          method: res.req.method,
          path: res.req.path
        },
        response: {
          headers: res.headers,
          body: body
        }
      });

    } else {
      console.log('Ignoring OPTIONS');
    }
  };

  self.mockResponses = function (suite) {
    var suiteName = suite.name.replace(/ /g, '_') + '.json';
    var filePath = path.join(opts.directory, suiteName);
    var exists = fs.existsSync(filePath);

    if (exists) {
      self.toRespond = JSON.parse(fs.readFileSync(filePath));
    } else {
      //throw new Error('mocks not found');
    }
  };

  self.recordMockStop = function (test) {
    try {
      Object.keys(self.responses).forEach(function (hostTarget) {
        console.log('Recording Mocks', self.responses);

        if (self.responses[hostTarget].length > 0) {
          var server = require('url').parse(hostTarget).host.replace(/:/g, '_').replace(/\./g, '_');
          var testName = server + '_' + test.name.replace(/ /g, '_') + '.json';
          var data = JSON.stringify(self.responses[hostTarget], null, 4);
          // TODO: might need to make a directory if doesn't exist.
          var mockSavePath = path.join(opts.directory, testName);
          console.log('Saving mock file:', mockSavePath);
          // TODO: this will hang if the directory does not exist.
          fs.writeFileSync(mockSavePath, data);

          // Clear responses for this server, next test starts from scratch.
          self.responses[hostTarget] = [];
        }
      });
    } catch (e) {
      throw e;
    }
  };

  self.close = function() {
    self.servers.forEach(function(server) {
      server.close();
    });
  };

};
