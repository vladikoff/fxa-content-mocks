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

    proxies.forEach(function(proxyConfig) {

      var proxy = new httpProxy.createProxyServer({
        target: proxyConfig.hostTarget
      });

      http.createServer(function (req, res) {
        if(self.toRespond && self.toRespond.length > 0) {
          var fakeResponse = self.toRespond.shift();
          fakeResponse.response.headers['content-encoding'] = 'identity';
          res.writeHead(200, fakeResponse.response.headers);

          res.end(JSON.stringify(fakeResponse.response.body));
        } else {
          proxy.web(req, res);
        }
      }).listen(proxyConfig.proxyPort);


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
              } catch (e) { }

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
            } catch (e) { }

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


      self.mockResponses = function(test) {
        var filePath = path.join(opts.directory, test.name);
        var exists = fs.existsSync(filePath);

        if (exists) {
          self.toRespond = JSON.parse(fs.readFileSync(filePath));
        } else {
          throw new Error('mocks not found');
        }

        // test.name -> name of the test
        // send a request to proxy

      };

      self.recordMockStop = function(test) {
        // TODO: might need to make a directory if doesn't exist.
        fs.writeFileSync(path.join(opts.directory, test.name), JSON.stringify(self.responses, null, 4));
        // clear responses
        self.responses = [];
      };




    // end for each
    });

  };

  module.exports = ProxyManager;
})();
