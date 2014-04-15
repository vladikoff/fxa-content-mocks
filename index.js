/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var http = require('http');
var fs = require('fs');
var httpProxy = require('http-proxy');
var zlib = require('zlib');
var path = require('path');

(function (exports) {
  var ProxyManager = function (proxies, opts) {
    if (!(this instanceof ProxyManager)) return new ProxyManager(proxies, opts);

    var self = this;

    self.responses = [];
    self.toRespond = [];
    self.servers = [];

    proxies.forEach(function (proxyConfig) {

      var proxy = new httpProxy.createProxyServer({
        target: proxyConfig.hostTarget
      });

      var server = http.createServer(function (req, res) {
        if (self.toRespond && self.toRespond.length > 0) {
          var fakeResponse = self.toRespond.shift();
          fakeResponse.response.headers['content-encoding'] = 'identity';
          res.writeHead(200, fakeResponse.response.headers);

          res.end(JSON.stringify(fakeResponse.response.body));
        } else {
          proxy.web(req, res);
        }
      }).listen(proxyConfig.proxyPort);

      self.servers.push(server);

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

              self.responses.push({
                request: {
                  method: res.req.method,
                  path: res.req.path
                },
                response: {
                  headers: res.headers,
                  body: body
                }
              });
            });
          }
          // else no encoding
          else {
            var body = buffer;
            try {
              body = JSON.parse(buffer);
            } catch (e) {
            }

            self.responses.push({
              request: {
                method: res.req.method,
                path: res.req.path
              },
              response: {
                headers: res.headers,
                body: body
              }
            });
          }
        });
      });


      self.mockResponses = function (test, enable) {
        if (enable) {
          var testName = test.name.replace(/ /g, '_') + '.json';
          var filePath = path.join(opts.directory, testName);
          var exists = fs.existsSync(filePath);

          if (exists) {
            self.toRespond = JSON.parse(fs.readFileSync(filePath));
          } else {
            throw new Error('mocks not found');
          }
        }
      };

      self.recordMockStop = function (test, enable) {
        if (enable && self.responses.length > 0) {
          var testName = test.name.replace(/ /g, '_') + '.json';
          // TODO: might need to make a directory if doesn't exist.
          fs.writeFileSync(path.join(opts.directory, testName), JSON.stringify(self.responses, null, 4));
          // clear responses
          self.responses = [];
        }
      };

      self.close = function() {
        self.servers.forEach(function(server) {
          server.close();
        });
      };
      // end for each
    });

  };

  module.exports = ProxyManager;
})();
