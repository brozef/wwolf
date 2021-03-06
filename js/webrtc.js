var cfg = {
    'iceServers': [{'url': 'stun:23.21.150.121'}]
};

var con = { 
    'optional': [{'DtlsSrtpKeyAgreement': true}] 
};

/* THE CALLER/SENDER */

var pc1 = new RTCPeerConnection(cfg, con);
var dc1 = null;
var tn1 = null;

// Since the same JS file contains code for both sides of the connection,
// activedc tracks which of the two possible datachannel variables we're using.
var activedc;

var pc1icedone = false;

var sdpConstraints = {
    optional: [],
    mandatory: {
        OfferToReceiveAudio: true,
        OfferToReceiveVideo: true
    }
};

function join() {
    navigator.getUserMedia = navigator.getUserMedia ||
                           navigator.webkitGetUserMedia ||
                           navigator.mozGetUserMedia ||
                           navigator.msGetUserMedia;

    navigator.getUserMedia({video: true, audio: true}, function (stream) {
        var video = document.getElementById('localVideo');
        video.src = window.URL.createObjectURL(stream);
        video.play();
        pc2.addStream(stream);
    }, function (error) {
        console.log('Error adding stream to pc2: ' + error);
    });
}

function receiveOffer(offer) {
    var offerDesc = new RTCSessionDescription(JSON.parse(offer));
    console.log('Received remote offer', offerDesc);
    handleOfferFromPC1(offerDesc);
};

function receiveAnswer(answer) {
    var answerDesc = new RTCSessionDescription(JSON.parse(answer));
    handleAnswerFromPC2(answerDesc);
}

function fileSent (file) {
    console.log(file + ' sent');
}

function fileProgress (file) {
    console.log(file + ' progress');
}

function sendFile (data) {
    if (data.size) {
        FileSender.send({
            file: data,
            onFileSent: fileSent,
            onFileProgress: fileProgress,
        });
    }
}

function sendMessage (message) {
    var channel = new RTCMultiSession();
    channel.send({message});
}

function setupDC1 () {
    try {
        var fileReceiver1 = new FileReceiver();
        dc1 = pc1.createDataChannel('test', {reliable: true});
        activedc = dc1;
        console.log('Created datachannel (pc1)');
        dc1.onopen = function (e) {
            console.log('data channel connect');
        };
        dc1.onmessage = function (e) {
            console.log('Got message (pc1)', e.data);
            if (e.data.size) {
                fileReceiver1.receive(e.data, {})
            } else {
                if (e.data.charCodeAt(0) == 2) {
                    // The first message we get from Firefox (but not Chrome)
                    // is literal ASCII 2 and I don't understand why -- if we
                    // leave it in, JSON.parse() will barf.
                    return
                }
                console.log(e);
                var data = JSON.parse(e.data);
                if (data.type === 'file') {
                    fileReceiver1.receive(e.data, {});
                } else {
                    //writeToChatLog(data.message, 'text-info')
                }
            }
        };
    } catch (e) { 
        console.warn('No data channel (pc1)', e); 
    }
}

function createLocalOffer () {
    console.log('video1');
    navigator.getUserMedia = navigator.getUserMedia ||
                           navigator.webkitGetUserMedia ||
                           navigator.mediaDevices.getUserMedia ||
                           navigator.msGetUserMedia;

    navigator.getUserMedia({video: true, audio: true}, function (stream) {
        var video = document.getElementById('localVideo');
        video.src = window.URL.createObjectURL(stream);
        video.play();
        pc1.addStream(stream);
        console.log(stream);
        console.log('adding stream to pc1');
        setupDC1();
        pc1.createOffer(function (desc) {
            pc1.setLocalDescription(desc, function () {}, function () {});
            console.log('created local offer', desc);
        },
        function () { 
            console.warn("Couldn't create offer");
        }, sdpConstraints);
    }, function (error) {
        console.log('Error adding stream to pc1: ' + error);
    })
}

pc1.onicecandidate = function (e) {
    console.log('ICE candidate (pc1)', e);
    if (e.candidate == null) {
        //$('#localOffer').html(JSON.stringify(pc1.localDescription))
    }
}

function handleOnaddstream (e) {
    console.log('Got remote stream', e.stream);
    //var el = document.getElementById('remoteVideo')
    //el.autoplay = true
    //attachMediaStream(el, e.stream)
}

pc1.onaddstream = handleOnaddstream;

function handleOnconnection () {
    console.log('Datachannel connected');
}

pc1.onconnection = handleOnconnection;

function onsignalingstatechange (state) {
    console.info('signaling state change:', state);
}

function oniceconnectionstatechange (state) {
    console.info('ice connection state change:', state);
}

function onicegatheringstatechange (state) {
    console.info('ice gathering state change:', state);
}

pc1.onsignalingstatechange = onsignalingstatechange;
pc1.oniceconnectionstatechange = oniceconnectionstatechange;
pc1.onicegatheringstatechange = onicegatheringstatechange;

function handleAnswerFromPC2 (answerDesc) {
    console.log('Received remote answer: ', answerDesc);
    pc1.setRemoteDescription(answerDesc);
}

function handleCandidateFromPC2 (iceCandidate) {
    pc1.addIceCandidate(iceCandidate);
}

/* THE ANSWERER/RECEIVER */

var pc2 = new RTCPeerConnection(cfg, con);
var dc2 = null;
var pc2icedone = false;

pc2.ondatachannel = function (e) {
    var fileReceiver2 = new FileReceiver();
    var datachannel = e.channel || e; // Chrome sends event, FF sends raw channel
    console.log('Received datachannel (pc2)', arguments);
    dc2 = datachannel;
    activedc = dc2;
    dc2.onopen = function (e) {
        console.log('data channel connect');
    };

    dc2.onmessage = function (e) {
        console.log('Got message (pc2)', e.data);
        if (e.data.size) {
            fileReceiver2.receive(e.data, {});
        } else {
            var data = JSON.parse(e.data);
            if (data.type === 'file') {
                fileReceiver2.receive(e.data, {});
            } else {
                //writeToChatLog(data.message, 'text-info')
            }
        }
    };
}

function handleOfferFromPC1 (offerDesc) {
    pc2.setRemoteDescription(offerDesc);
    pc2.createAnswer(function (answerDesc) {
        writeToChatLog('Created local answer', 'text-success');
        console.log('Created local answer: ', answerDesc);
        pc2.setLocalDescription(answerDesc);
    }, function () { 
        console.warn("Couldn't create offer");
    }, sdpConstraints);
}

pc2.onicecandidate = function (e) {
    console.log('ICE candidate (pc2)', e)
    if (e.candidate == null) {
        //$('#localAnswer').html(JSON.stringify(pc2.localDescription))
    }
}

pc2.onsignalingstatechange = onsignalingstatechange;
pc2.oniceconnectionstatechange = oniceconnectionstatechange;
pc2.onicegatheringstatechange = onicegatheringstatechange;

function handleCandidateFromPC1 (iceCandidate) {
    pc2.addIceCandidate(iceCandidate);
}

pc2.onaddstream = handleOnaddstream;
pc2.onconnection = handleOnconnection;

function getTimestamp () {
    var totalSec = new Date().getTime() / 1000;
    var hours = parseInt(totalSec / 3600) % 24;
    var minutes = parseInt(totalSec / 60) % 60;
    var seconds = parseInt(totalSec % 60);

    var result = (hours < 10 ? '0' + hours : hours) + ':' + (minutes < 10 ? '0' + minutes : minutes) + ':' + (seconds < 10 ? '0' + seconds : seconds);

    return result;
}