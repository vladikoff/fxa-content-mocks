/**
 * http-proxy tester file
 */

var httpProxy = require('http-proxy');
// Error example
//
// Http Proxy Server with bad target
//
var proxy = httpProxy.createServer({
  target: 'http://127.0.0.1:9000',
  xfwd: true
});

proxy.listen(10500);

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
  console.log('RAW Response from the target', JSON.stringify(res.headers, true, 2));
});

var mailerProxy = httpProxy.createServer({
  target: 'http://127.0.0.1:9001',
  xfwd: true
});

mailerProxy.listen(10501);

//
// Listen for the `error` event on `proxy`.
mailerProxy.on('error', function (err, req, res) {
  res.writeHead(500, {
    'Content-Type': 'text/plain'
  });

  res.end('Something went wrong. And we are reporting a custom error message.');
});

//
// Listen for the `proxyRes` event on `proxy`.
//
mailerProxy.on('proxyRes', function (res) {
  console.log('RAW Response from the target', JSON.stringify(res.headers, true, 2));
});
