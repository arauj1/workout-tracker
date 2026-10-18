// audio.js - Web Audio API Sound Synthesizer & Haptic Controller
// 100% Offline with zero external asset dependencies

let audioCtx = null;

function getAudioContext() {
    if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
            audioCtx = new AudioContext();
        }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

// Ensure audio context is unlocked on first user touch
document.addEventListener('touchstart', () => getAudioContext(), { once: true });
document.addEventListener('click', () => getAudioContext(), { once: true });

function playTone(freq, durationMs, type = 'sine', startTimeOffset = 0) {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime + startTimeOffset);

        gain.gain.setValueAtTime(0.2, ctx.currentTime + startTimeOffset);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTimeOffset + (durationMs / 1000));

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + startTimeOffset);
        osc.stop(ctx.currentTime + startTimeOffset + (durationMs / 1000));
    } catch (err) {
        console.warn('Audio tone error:', err);
    }
}

// Gym Rest Timer Alert (Crisp double beep)
function playTimerDoneSound() {
    playTone(880, 180, 'sine', 0);        // A5
    playTone(1760, 250, 'triangle', 0.22); // A6
}

// Personal Record (PR) celebratory chime
function playPRCelebration() {
    playTone(523.25, 120, 'sine', 0);     // C5
    playTone(659.25, 120, 'sine', 0.12);  // E5
    playTone(783.99, 300, 'triangle', 0.24); // G5
}

// Haptic feedback with vibration patterns
function triggerHaptic(pattern = 50) {
    if ('vibrate' in navigator) {
        try {
            navigator.vibrate(pattern);
        } catch (e) {
            // Silently ignore if permission denied
        }
    }
}

window.IronAudio = {
    playTimerDoneSound,
    playPRCelebration,
    triggerHaptic
};
