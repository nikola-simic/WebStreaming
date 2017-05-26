var express = require('express');
var express_server = require('express')();
var https = require('https');
var fs = require('fs');
var options = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
};
var https_server = https.createServer(options, express_server);
var io = require('socket.io')(https_server);
var path = require('path');

var numOfPeers = 0;
var peer2room = {};

express_server.get('/', function(req, res) {
	console.log('GET /');
	res.sendFile(__dirname + '/index.html');
});

express_server.use(express.static('.'));


io.on('connect', function(socket) {
	console.log('connection event received');

	// Handling received message
	socket.on('message', function(msg) {
		console.log('message event received');
		socket.broadcast.emit('message', msg);
	});

	// Handling joining the room
	socket.on('join', function(room) {
		console.log('join event received');
		if(numOfPeers === 0) {
			socket.join(room);
			numOfPeers = 1;
			peer2room[socket] = room;
			socket.emit('created', room);
		} else if(numOfPeers === 1) {
			socket.join(room);
			numOfPeers = 2;
			peer2room[socket] = room;
			socket.emit('joined', room);
			io.to(room).emit('start', 'Streaming sould be started!');
		} else {
			socket.emit('full', 'Room: ' + room + ' is full!');
		}
	});

	// Handling client ready
	socket.on('peerReady', function() {
		console.log('clientReady event received');
		socket.broadcast.emit('peerReady');
	});

	// Handling client leaving the room
	socket.on('disconnect', function() {
		console.log('disconnect event received');
		numOfPeers = numOfPeers - 1;
		socket.leave(peer2room[socket]);
		peer2room[socket] = '';
		socket.broadcast.emit('bye');
	});

});

https_server.listen(5000, function() {
	console.log('https server listening on port 5000');
});