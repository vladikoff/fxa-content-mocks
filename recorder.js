var fs = require('fs');
var httpProxy = require('http-proxy');
var http = require('http');
var zlib = require('zlib');
var path = require('path');

module.exports = function (proxies, opts) {
  var self = this;

  self.responses = {};
  self.servers = [];

  proxies.forEach(function (proxyConfig) {

    var proxy = new httpProxy.createProxyServer({});
    proxy.target = proxyConfig.hostTarget;
    self.responses[proxy.target] = [];

    http.createServer(function (req, res) {
      // This simulate an operation that take 500ms in execute
      setTimeout(function () {
        proxy.web(req, res, {
          target: proxyConfig.hostTarget
        });
      }, 400);
    }).listen(proxyConfig.proxyPort);

    console.log('Proxy Started on', proxyConfig.proxyPort, 'for', proxyConfig.hostTarget);

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
    //if (res.req.method !== 'OPTIONS') {
      console.log('saving', res.req.path);
      console.log(target);

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
  };

  self.recordMockStop = function (test) {
    try {
      Object.keys(self.responses).forEach(function (hostTarget) {

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
