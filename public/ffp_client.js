// File: ffp_client.js
// Role: ARA Full Frame Protocol (FFP) engine
// Handles media capture, encoding, Socket.IO comms, and rendering frames.

const FFPClient = (() => {
    let socket;
    let localVideoEl;
    let participantVideoGrid;
    let screenShareDisplay;
    let statsCallback;

    let localStream;
    let localAudioTrack;
    let localVideoTrack;
    let animationFrameId;
    let lastFrameData = null;

    const FRAME_DIFFERENCE_THRESHOLD = 5000;
    const SEND_FPS = 15;
    const FRAME_INTERVAL = 1000 / SEND_FPS;
    let lastSendTime = 0;

    let framesSent = 0;
    let lastStatsUpdateTime = 0;

    // --- Setup ---
    function init({ localVideo, participantVideoGrid: grid, screenShareDisplay: shareDisplay, statsCallback: statsFn }) {
        localVideoEl = localVideo;
        participantVideoGrid = grid;
        screenShareDisplay = shareDisplay;
        statsCallback = statsFn;

        socket = io();
      socket.on('connect', () => {
    console.log("FFP connected with ID:", socket.id);
    socket.emit('join', 'default-room'); // <--- add this line
    startLocalMedia();
});


        socket.on('disconnect', () => {
            console.log("Disconnected from server");
            stopSendingFrames();
            if (localStream) localStream.getTracks().forEach(track => track.stop());
        });

        socket.on('frame', ({ senderId, data, type }) => {
            if (senderId === socket.id) return;
            renderRemoteFrame(senderId, data, type);
        });

        socket.on('participant-left', (id) => {
            const el = document.getElementById(`container-${id}`);
            if (el) el.remove();
        });
    }

    // --- Local media ---
   async function startLocalMedia() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideoTrack = localStream.getVideoTracks()[0];
        localAudioTrack = localStream.getAudioTracks()[0];
        localVideoEl.srcObject = localStream;

        // Force play on mobile (iOS/Android needs this wrapped in a try)
        localVideoEl.muted = true; // Required on some browsers
        const playPromise = localVideoEl.play();
        if (playPromise !== undefined) {
            playPromise.catch(err => {
                console.warn("Autoplay blocked, waiting for user gesture:", err);
            });
        }

        startSendingFrames();
    } catch (err) {
        console.error("Media error:", err);
    }
}


    // --- Frame sending ---
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    function calcDiff(f1, f2) {
        if (!f1 || !f2 || f1.length !== f2.length) return Infinity;
        let diff = 0;
        for (let i = 0; i < f1.length; i += 4) {
            diff += Math.abs(f1[i] - f2[i]) +
                    Math.abs(f1[i+1] - f2[i+1]) +
                    Math.abs(f1[i+2] - f2[i+2]);
        }
        return diff;
    }

    function sendFrame() {
        if (!localVideoEl || localVideoEl.readyState < 2) {
            animationFrameId = requestAnimationFrame(sendFrame);
            return;
        }

        const now = performance.now();
        if (now - lastSendTime < FRAME_INTERVAL) {
            animationFrameId = requestAnimationFrame(sendFrame);
            return;
        }

        canvas.width = localVideoEl.videoWidth;
        canvas.height = localVideoEl.videoHeight;
        ctx.drawImage(localVideoEl, 0, 0, canvas.width, canvas.height);

        const curr = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        if (!lastFrameData || calcDiff(curr, lastFrameData) > FRAME_DIFFERENCE_THRESHOLD) {
            const jpeg = canvas.toDataURL('image/jpeg', 0.7);
            socket.emit('frame', { data: jpeg, type: 'video' });
            framesSent++;
            lastFrameData = curr;
            lastSendTime = now;
        }

        if (now - lastStatsUpdateTime > 1000) {
            const keps = (framesSent / (now - lastStatsUpdateTime) * 1000).toFixed(1);
            if (statsCallback) statsCallback(`${keps} Keps, ${SEND_FPS}fps`);
            framesSent = 0;
            lastStatsUpdateTime = now;
        }

        animationFrameId = requestAnimationFrame(sendFrame);
    }

    function startSendingFrames() {
        if (!animationFrameId) {
            lastSendTime = performance.now();
            lastStatsUpdateTime = performance.now();
            animationFrameId = requestAnimationFrame(sendFrame);
        }
    }

    function stopSendingFrames() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    }

    // --- Remote rendering ---
    function renderRemoteFrame(senderId, data, type) {
        let imgEl = document.getElementById(`video-${senderId}`);
        if (!imgEl) {
            const container = document.createElement('div');
            container.id = `container-${senderId}`;
            container.className = 'video-tile';

            imgEl = document.createElement('img');
            imgEl.id = `video-${senderId}`;
            container.appendChild(imgEl);

            const name = document.createElement('span');
            name.className = 'participant-name';
            name.textContent = senderId.substring(0, 8);
            container.appendChild(name);

            participantVideoGrid.appendChild(container);
        }
        imgEl.src = data;
    }

    // --- API for UI ---
    function toggleMic(enabled) {
        if (localAudioTrack) localAudioTrack.enabled = enabled;
    }

    function toggleCam(enabled) {
        if (localVideoTrack) {
            localVideoTrack.enabled = enabled;
            if (enabled) {
                localVideoEl.play();
                startSendingFrames();
            } else {
                stopSendingFrames();
            }
        }
    }

    async function startScreenShare() {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            const track = stream.getVideoTracks()[0];
            const tempVideo = document.createElement('video');
            tempVideo.srcObject = stream;
            tempVideo.play();

            function sendScreen() {
                canvas.width = tempVideo.videoWidth;
                canvas.height = tempVideo.videoHeight;
                ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
                const jpeg = canvas.toDataURL('image/jpeg', 0.7);
                socket.emit('frame', { data: jpeg, type: 'screen' });
                requestAnimationFrame(sendScreen);
            }
            requestAnimationFrame(sendScreen);

            track.onended = () => stopScreenShare();
        } catch (err) {
            console.error("Screen share error:", err);
        }
    }

    function stopScreenShare() {
        socket.emit('stop-screen-share');
    }

    function disconnect() {
        stopSendingFrames();
        if (localStream) localStream.getTracks().forEach(track => track.stop());
        socket.disconnect();
    }

    return {
        init,
        toggleMic,
        toggleCam,
        startScreenShare,
        stopScreenShare,
        disconnect
    };
})();
