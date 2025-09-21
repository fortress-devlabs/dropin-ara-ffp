// File: dropin_manager.js
// Role: UI controller only (delegates media & networking to ffp_client.js)

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM References ---
    const localVideo = document.getElementById('local-video');
    const localVideoContainer = document.getElementById('local-video-container');
    const participantVideoGrid = document.getElementById('participant-video-grid');
    const screenShareDisplay = document.getElementById('screen-share-display');
    const frameStatsSpan = document.getElementById('frame-stats');

    // Control buttons
    const micToggleBtn = document.getElementById('mic-toggle');
    const camToggleBtn = document.getElementById('cam-toggle');
    const screenShareToggleBtn = document.getElementById('screen-share-toggle');
    const endCallBtn = document.getElementById('end-call-btn');

    // --- State flags ---
    let micEnabled = true;
    let camEnabled = true;
    let screenSharing = false;

    // --- Initialize ARA FFP client ---
    FFPClient.init({
        localVideo,
        participantVideoGrid,
        screenShareDisplay,
        statsCallback: (stats) => {
            // Update stats UI from ffp_client.js
            frameStatsSpan.textContent = stats;
        }
    });

    // --- Button Event Listeners ---

    // Toggle microphone
    micToggleBtn.addEventListener('click', () => {
        micEnabled = !micEnabled;
        FFPClient.toggleMic(micEnabled);
        micToggleBtn.classList.toggle('active', micEnabled);
        micToggleBtn.querySelector('i').className = micEnabled
            ? 'fas fa-microphone-alt'
            : 'fas fa-microphone-alt-slash';
    });

    // Toggle camera
    camToggleBtn.addEventListener('click', () => {
        camEnabled = !camEnabled;
        FFPClient.toggleCam(camEnabled);
        camToggleBtn.classList.toggle('active', camEnabled);
        camToggleBtn.querySelector('i').className = camEnabled
            ? 'fas fa-video'
            : 'fas fa-video-slash';
    });

    // Screen share toggle
    screenShareToggleBtn.addEventListener('click', () => {
        if (!screenSharing) {
            FFPClient.startScreenShare();
            screenShareToggleBtn.classList.add('active');
            localVideoContainer.classList.add('hidden');
        } else {
            FFPClient.stopScreenShare();
            screenShareToggleBtn.classList.remove('active');
            localVideoContainer.classList.remove('hidden');
        }
        screenSharing = !screenSharing;
    });

    // End call
    endCallBtn.addEventListener('click', () => {
        FFPClient.disconnect();
        // UI cleanup
        participantVideoGrid.querySelectorAll('.video-tile:not(.local-user)').forEach(tile => tile.remove());
        localVideo.srcObject = null;
        localVideo.poster = '';
        frameStatsSpan.textContent = "0 Keps, 0fps";
    });
});
