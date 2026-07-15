
let roomCode = window.location.pathname.replace(/^\/|\/$/g, '');
let localStream;
let peerConnection;

let offer = null;
let offerReceived = false;
let answer = null;
let answerReceived = false;

peerConnection = new RTCPeerConnection({
    iceServers: [{urls: "stun:stun.l.google.com:19302"}]
});

async function start() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });

        document.getElementById('localVideo').srcObject = localStream;

        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        peerConnection.ontrack = event => {
            document.getElementById('remoteVideo').srcObject = event.streams[0];
        };

        peerConnection.onicecandidate = event => {
            if (event.candidate) {
                console.log("ICE candidate:", event.candidate);
            }
        };

        peerConnection.oniceconnectionstatechange = () => {
            console.log("ICE state:", peerConnection.iceConnectionState);
        };

    } catch (error) {
        console.error('Camera/mic error:', error);
    }
}

async function getRoom() {
    try {
        const response = await fetch('/getroom/?code=' + roomCode, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                offer: JSON.stringify(offer),
                answer: JSON.stringify(answer)
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }

        const data = await response.json();
        const room = data.room;

        if (room.participants > 1) {
            if (room.me.role === "offerer") {
                if (!offer) {
                    console.log("I should create the offer");
                    offer = await createOffer();
                } else {
                    const otherUserId = Object.keys(room.others)[0];

                    if (!answerReceived && room.others[otherUserId].answer) {
                        console.log("answer found, I should initialise connection now")
                        answer = room.others[otherUserId].answer;
                        answerReceived = true;

                        await peerConnection.setRemoteDescription(answer);
                    } else {
                        console.log("I should wait for the answer")
                    }
                }
            } else {
                if (!answer) {
                    console.log("I should check for an offer");

                    const otherUserId = Object.keys(room.others)[0];
                    offer = room.others[otherUserId].offer;
                }

                if (!offerReceived) {
                    const otherUserId = Object.keys(room.others)[0];
                    offer = room.others[otherUserId].offer;

                    if (offer) {
                        offerReceived = true;

                        console.log("offer found! I should send an answer");

                        await peerConnection.setRemoteDescription(offer);

                        answer = await peerConnection.createAnswer();

                        await peerConnection.setLocalDescription(answer);
                    }
                }
            }

        }

        return room;
    } catch (error) {
        console.error('Failed to load API data:', error);
    }
}

async function createOffer() {
    if (!peerConnection) return alert("Start camera first.");

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    // Wait for ICE gathering to complete
    await new Promise(resolve => {
        peerConnection.onicecandidate = event => {
            if (!event.candidate) resolve();
        };
    });

    return peerConnection.localDescription;
}

start().then(() => {
    getRoom();
    setInterval(getRoom, 1000);
});
