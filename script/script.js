
let roomCode = window.location.pathname.replace(/^\/|\/$/g, '');
let localStream;
let screenStream;
let sharingScreen = false;
let peerConnection;

let offer = null;
let answer = null;

let polling = false;

let peers = {};

async function start() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });

        document.getElementById('localVideo').srcObject = localStream;
    } catch (error) {
        console.error('Camera/mic error:', error);
    }
}

window.addEventListener('pagehide', () => {
    navigator.sendBeacon(
        '/leave',
        JSON.stringify({
            code: roomCode
        })
    );
});

function createRemoteVideo(userId) {

    const template = document.getElementById("remoteVideo");

    const video = template.cloneNode(true);

    video.id = "remote-" + userId;
    video.style.display = "";
    video.autoplay = true;
    video.playsInline = true;
    video.hidden = false;

    document.getElementById("videosContainer").appendChild(video);

    return video;
}

function createPeer(userId) {
    const peerConnection = new RTCPeerConnection({
        iceServers: [
            {
                urls: "stun:stun.l.google.com:19302"
            }
        ]
    });

    peerConnection.onconnectionstatechange = async () => {
        console.log(
            userId,
            peerConnection.connectionState
        );

        if (peerConnection.connectionState === "connected") {

            console.log("Connected to", userId);
            peers[userId].connected = true;

            await sendNegotiation(
                userId,
                "connected",
                true
            );
        }


        if (
            peerConnection.connectionState === "disconnected" ||
            peerConnection.connectionState === "failed" ||
            peerConnection.connectionState === "closed"
        ) {
            cleanupPeer(userId);
        }
    };

    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    const video = createRemoteVideo(userId);

    peerConnection.ontrack = event => {
        video.srcObject = event.streams[0];
    };

    peers[userId] = {
        peerConnection,
        offer: null,
        offerReceived: false,
        answer: null,
        answerReceived: false,
        connected: false
    };

    return peers[userId];
}

function cleanupPeer(userId) {

    const peer = peers[userId];
    if (!peer) return;

    peer.peerConnection.close();

    document
        .getElementById("remote-" + userId)
        ?.remove();

    delete peers[userId];
}

async function sendNegotiation(toUserId, type, data) {

    const response = await fetch('/negotiation/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            roomCode: roomCode,
            toUserId: toUserId,
            type: type,
            data: JSON.stringify(data)
        })
    });

    if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
    }

}

async function getRoom() {
    if (polling) {
        return;
    }

    polling = true;

    try {
        const response = await fetch('/getroom/?code=' + roomCode, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }

        const data = await response.json();
        const room = data.room;

        // Remove peers that no longer exist in the room
        for (const userId of Object.keys(peers)) {
            if (!room.others[userId]) {
                console.log("User left:", userId);
                cleanupPeer(userId);
            }
        }

        if (room.participants > 1) {
            for (const userId of Object.keys(room.others)) {

                if (!peers[userId]) {
                    console.log("New peer detected", userId);

                    createPeer(userId);
                }

                await handlePeer(userId, room);
            }

            async function handlePeer(userId, room) {

                const peer = peers[userId];

                if (room.me.peers[userId].role === "offerer") {
                    if (!peer.offer) {

                        console.log("Creating offer for", userId);
                        peer.offer = await createOffer(peer);
                        await sendNegotiation(userId, 'offer', peer.offer);

                    } else if (!peer.answerReceived && room.others[userId].answer) {

                        console.log("Answer recieved from", userId);
                        peer.answer = JSON.parse(room.others[userId].answer);

                        await peer.peerConnection.setRemoteDescription(
                            peer.answer
                        );

                        peer.answerReceived = true;
                    }
                } else {
                    const offer = room.others[userId].offer
                        ? JSON.parse(room.others[userId].offer)
                        : null;

                    if (offer && !peer.offerReceived) {

                        console.log("Offer recieved from", userId, offer);
                        console.log(typeof offer);
                        await peer.peerConnection.setRemoteDescription(
                            offer
                        );

                        const answer =
                            await peer.peerConnection.createAnswer();

                        console.log("Setting answer for", userId);
                        await peer.peerConnection.setLocalDescription(answer);

                        peer.answer =
                            peer.peerConnection.localDescription;

                        await sendNegotiation(userId, 'answer', peer.answer);

                        peer.offerReceived = true;
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

async function createOffer(peer) {

    const pc = peer.peerConnection;
    const offer = await pc.createOffer();

    const iceComplete = new Promise(resolve => {
        const checkIce = () => {
            if (pc.iceGatheringState === "complete") {
                resolve();
            }
        };

        pc.addEventListener(
            "icegatheringstatechange",
            checkIce
        );

        checkIce();
    });

    await pc.setLocalDescription(offer);
    await iceComplete;

    return pc.localDescription;
}

window.toggleMic = () => {

    const track = localStream?.getAudioTracks()[0];
    if (!track) return;

    track.enabled = !track.enabled;

    const btn = document.getElementById("micBtn");
    if (btn) btn.classList.toggle("active", track.enabled);
};

window.copyRoomLink = () => {

    const url = window.location.origin + "/" + roomCode;
    navigator.clipboard.writeText(url).then(() => {
        const btn = document.getElementById("copyLinkBtn");
        if (btn) {
            btn.classList.add("active");
            setTimeout(() => btn.classList.remove("active"), 2000);
        }
    });
};

window.endCall = async () => {
    window.location.href = 'https://concertdigital.co.uk';
};

async function toggleScreenShare() {
    if (!sharingScreen) {
        try {
            screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: true
            });

            const screenTrack = screenStream.getVideoTracks()[0];

            for (const userId in peers) {

                const pc = peers[userId].peerConnection;

                const sender = pc
                    .getSenders()
                    .find(sender =>
                        sender.track &&
                        sender.track.kind === "video"
                    );

                if (sender) {
                    await sender.replaceTrack(screenTrack);
                }
            }

            // Show screen locally
            document.getElementById('localVideo').srcObject = screenStream;

            sharingScreen = true;
            document.getElementById('screenBtn').classList.add("active");

            // If user clicks browser "Stop sharing"
            screenTrack.onended = () => {
                stopScreenShare();
            };

        } catch (error) {
            console.error("Screen share failed:", error);
        }

    } else {
        stopScreenShare();
    }
}

async function stopScreenShare() {
    if (!screenStream) return;

    const cameraTrack = localStream.getVideoTracks()[0];

    for (const userId in peers) {
        const pc = peers[userId].peerConnection;

        const sender = pc
            .getSenders()
            .find(sender =>
                sender.track &&
                sender.track.kind === "video"
            );

        if (sender) {
            await sender.replaceTrack(cameraTrack);
        }
    }

    screenStream.getTracks().forEach(track => track.stop());

    document.getElementById('localVideo').srcObject = localStream;

    screenStream = null;
    sharingScreen = false;
    document.getElementById('screenBtn').classList.remove("active");
}

start().then(() => {
    getRoom();
    setInterval(getRoom, 1000);
});
