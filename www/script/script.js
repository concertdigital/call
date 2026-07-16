
let roomCode = window.location.pathname.replace(/^\/|\/$/g, '');
let localStream;
let peerConnection;

let offer = null;
let offerReceived = false;
let answer = null;
let answerReceived = false;

let polling = false;

async function start() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });

        document.getElementById('localVideo').srcObject = localStream;

        peerConnection = new RTCPeerConnection({
            iceServers: [{urls: "stun:stun.l.google.com:19302"}]
        });

        peerConnection.oniceconnectionstatechange = () => {
            console.log("ICE connection:", peerConnection.iceConnectionState);
        };

        peerConnection.onconnectionstatechange = () => {
            console.log("Connection:", peerConnection.connectionState);
        };

        peerConnection.onicegatheringstatechange = () => {
            console.log("Gathering:", peerConnection.iceGatheringState);
        };

        peerConnection.onsignalingstatechange = () => {
            console.log("Signalling:", peerConnection.signalingState);
        };

        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        peerConnection.ontrack = event => {
            document.getElementById('remoteVideo').srcObject = event.streams[0];
        };

        peerConnection.onicecandidate = event => {
            if (event.candidate) {
                console.log(
                        "ICE",
                        event.candidate.type,
                        event.candidate.candidate
                );
            } else {
                console.log("ICE gathering complete");
            }
        };

    } catch (error) {
        console.error('Camera/mic error:', error);
    }
}

async function getRoom() {
    if (polling) {
        return;
    }

    polling = true;

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

                        try {
                            await peerConnection.setRemoteDescription(answer);
                            console.log("Remote answer description OK");
                        } catch (e) {
                            console.error("setRemoteDescription answer failed", e);
                        }
                        console.log("Remote answer set");
                        console.log(answer.sdp);
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

                        try {
                            await peerConnection.setRemoteDescription(offer);
                            console.log("Remote offer description OK");
                        } catch (e) {
                            console.error("setRemoteDescription offer failed", e);
                        }

                        answer = await peerConnection.createAnswer();

                        const iceComplete = new Promise(resolve => {
                            const checkIce = () => {
                                if (peerConnection.iceGatheringState === "complete") {
                                    resolve();
                                }
                            };

                            peerConnection.addEventListener(
                                    "icegatheringstatechange",
                                    checkIce
                            );

                            checkIce();
                        });

                        await peerConnection.setLocalDescription(answer);

                        await iceComplete;
                        console.log(peerConnection.localDescription.sdp);

                        answer = peerConnection.localDescription;
                    }
                }
            }

        }

        return room;
    } catch (error) {
        console.error('Failed to load API data:', error);
    } finally {
        polling = false;
    }
}

async function createOffer() {
    if (!peerConnection) return alert("Start camera first.");

    const offer = await peerConnection.createOffer();

    const iceComplete = new Promise(resolve => {
        peerConnection.onicecandidate = event => {
            if (!event.candidate) resolve();
        };
    })
    await peerConnection.setLocalDescription(offer);
    await iceComplete;
    console.log(peerConnection.localDescription.sdp);

    return peerConnection.localDescription;
}

start().then(() => {
    getRoom();
    setInterval(getRoom, 1000);
});
