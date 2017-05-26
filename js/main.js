'use strict';

var startButton = window.document.querySelector("#startButton");
var stopButton = window.document.querySelector("#stopButton");

startButton.onclick = onStartButtonClicked;
stopButton.onclick = onStopButtonClicked;

startButton.disabled = false;
stopButton.disabled = true;


var remoteVideoElement = window.document.querySelector("#remoteVideo");
var remoteAudioElement = window.document.querySelector("#remoteAudio");

var localStream;
var remoteVideoStream;
var remoteAudioStream;

var localEndpoint;

var connectionInitiator = false;
var remoteSideReady = false;
var shouldSendOffer = false;

// Handling events from signalling server
function onCreated(room) {
	console.log('Client has created room: ' + room);
	connectionInitiator = true;
}

function onJoined(room) {
	console.log('Client has joined to room: ' + room);
}

function onPeerReady(msg) {
	console.log('Remote peer is ready to start communication');
	remoteSideReady = true;
	if(connectionInitiator && shouldSendOffer) {
		// Creating sdp offer
		var offerDescription = {offerToreceiveVideo: 1};
		localEndpoint.createOffer(offerDescription).then(onOfferCreated);
	}
}

function onStart(msg) {
	console.log(msg);
	startCall();
}

function onBye() {
	console.log('Remote peer has close socket');
	alert('Remote peer has ended this call');
}

function onMessage(msg) {
	console.log('Client received message: ' + msg);
	if(msg) {

		if(msg.type === 'candidate') {

			console.log('Candidate received');

			localEndpoint.addIceCandidate(new RTCIceCandidate(msg.candidate));

		} else if(msg.type === 'offer') {

			console.log('Offer received');

			localEndpoint.setRemoteDescription(msg.offer).then(function() {
				console.log('setRemoteDescription success');
				// Creating sdp answer
				localEndpoint.createAnswer().then(onAnswerCreated);
			},
			function(e) {
				console.error('setRemoteDescription error: ', e);
			});

		} else if(msg.type === 'answer') {

			console.log('Answer received');

			localEndpoint.setRemoteDescription(msg.answer).then(function() {
				console.log('setRemoteDescription success');
			},
			function(e) {
				console.error('setRemoteDescription error: ', e);
			});
		}

	}
}

// Handlig web socket logic
var socket;

function onStartButtonClicked() {
	console.log('onStartButtonClicked');
	socket = io();
	socket.on('created', onCreated);
	socket.on('joined', onJoined);
	socket.on('peerReady', onPeerReady);
	socket.on('start', onStart);
	socket.on('bye', onBye);
	socket.on('message', onMessage);
	joinRoom();
}

function startCall() {
	var constraints = {audio: true, video: true};
	window.navigator.mediaDevices.getUserMedia(constraints).then(onLocalUserMediaFetched);
}

function joinRoom() {
	socket.emit('join', 'defaultRoom');
}

function sendMessage(msg) {
	socket.emit('message', msg);
}

function onLocalUserMediaFetched(media) {
	console.log('onLocalUserMediaFetched');
	localStream = media;
	startButton.disabled = true;
	stopButton.disabled = false;

	// After fetching local media stream, try to connect to remote endpoint
	createConnection();
}

function createConnection() {
	console.log('createConnection');

	// Creating peer connection objects
	localEndpoint = new RTCPeerConnection();

	// Handling ice candidate objects
	localEndpoint.onicecandidate = function(iceCandidateEvent) {
		if(iceCandidateEvent.candidate) {
			var message = {type: 'candidate', candidate: iceCandidateEvent.candidate};
			sendMessage(message);
		} else {
			console.log("localEndpoint.onicecandidate - empty candidate");
		}
		
	}

	// Handling adding media streams
	localEndpoint.addStream(localStream);
	localEndpoint.ontrack = onTrackAdded;

	// Signalling to other side that peer is ready to start negotiation
	socket.emit('peerReady');

	if(connectionInitiator) {
		if(!remoteSideReady) {
			shouldSendOffer = true;
		} else {
			// Creating sdp offer
			var offerDescription = {offerToreceiveVideo: 1};
			localEndpoint.createOffer(offerDescription).then(onOfferCreated);
		}
	}
	
}

function onTrackAdded(e) {
	console.log('onTrackAdded');
	if(e.track.kind === "audio") {
		remoteAudioStream = e.streams[0];
		remoteAudioElement.srcObject = remoteAudioStream;
	} else if (e.track.kind === "video") {
		remoteVideoStream = e.streams[0];
		remoteVideoElement.srcObject = remoteVideoStream;
	}
}

function onOfferCreated(description) {
	console.log('onOfferCreated');

	// Setting description to local endpoint
	localEndpoint.setLocalDescription(description).then(function(){
		console.log('setLocalDescription success');
		// Signalling description to remote endpoint
		var message = {type: 'offer', offer: description};
		sendMessage(message);

	},
	function(e) {
		console.error('setLocalDescription error: ', e);
	});

}

function onAnswerCreated(description) {
	
	localEndpoint.setLocalDescription(description).then(function() {
		console.log('setLocalDescription success');
		var message = {type: 'answer', answer: description};
		sendMessage(message);
	},
	function(e) {
		console.error('setLocalDescription error: ', e);
	});
	

}


function onStopButtonClicked() {
	console.log('onStopButtonClicked');
	stopCall();
}


function stopCall() {
	console.log('Call stopping');
	localStream.getVideoTracks()[0].stop();
	localStream.getAudioTracks()[0].stop();
	localEndpoint.close();
	localEndpoint = null;
	connectionInitiator = false;
	remoteSideReady = false;
	shouldSendOffer = false;
	socket.close();
	startButton.disabled = false;
	stopButton.disabled = true;
}