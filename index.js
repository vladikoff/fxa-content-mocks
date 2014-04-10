// Start up a basic applciation
var express = require('express');
var eightTrack = require('eight-track');
var request = require('request');

express().use(function (req, res) {
  console.log('Pinged!');
  res.send('Hello World!');
}).listen(1337);

// Create a server using a `eight-track` middleware to the original
express().use(eightTrack({
  url: 'http://127.0.0.1:8000',
  fixtureDir: 'fixtures'
})).listen(9000);
