// timer.js - Gym Rest Timer Controller with Audio & Haptics

let timerInterval = null;
let remainingSeconds = 0;
let totalDurationSeconds = 90;
let isRunning = false;
let onTickCallback = null;
let onCompleteCallback = null;

function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function startTimer(durationSeconds) {
    if (durationSeconds !== undefined) {
        totalDurationSeconds = durationSeconds;
        remainingSeconds = durationSeconds;
    }

    if (remainingSeconds <= 0) {
        remainingSeconds = totalDurationSeconds;
    }

    if (timerInterval) {
        clearInterval(timerInterval);
    }

    isRunning = true;
    updateUI();

    timerInterval = setInterval(() => {
        if (remainingSeconds > 0) {
            remainingSeconds--;
            updateUI();
        } else {
            stopTimer();
            // Fire sound and haptics
            IronAudio.playTimerDoneSound();
            IronAudio.triggerHaptic([100, 80, 100, 80, 200]);

            if (typeof onCompleteCallback === 'function') {
                onCompleteCallback();
            }
        }
    }, 1000);
}

function pauseTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    isRunning = false;
    updateUI();
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    isRunning = false;
    remainingSeconds = 0;
    updateUI();
}

function adjustTime(deltaSeconds) {
    remainingSeconds = Math.max(0, remainingSeconds + deltaSeconds);
    totalDurationSeconds = Math.max(remainingSeconds, totalDurationSeconds);
    updateUI();
    IronAudio.triggerHaptic(30);
}

function setCallbacks(onTick, onComplete) {
    onTickCallback = onTick;
    onCompleteCallback = onComplete;
}

function updateUI() {
    const timerBar = document.getElementById('floatingTimerBar');
    const timerText = document.getElementById('timerCountdown');
    const timerToggleBtn = document.getElementById('timerToggleBtn');

    if (!timerBar || !timerText) return;

    if (remainingSeconds > 0 || isRunning) {
        timerBar.classList.remove('hidden');
        timerText.textContent = formatTime(remainingSeconds);
        if (timerToggleBtn) {
            timerToggleBtn.textContent = isRunning ? '⏸' : '▶';
        }
    } else {
        timerBar.classList.add('hidden');
    }

    if (typeof onTickCallback === 'function') {
        onTickCallback({ remainingSeconds, isRunning, formatted: formatTime(remainingSeconds) });
    }
}

window.IronTimer = {
    start: startTimer,
    pause: pauseTimer,
    stop: stopTimer,
    adjust: adjustTime,
    formatTime,
    setCallbacks,
    getState: () => ({ remainingSeconds, totalDurationSeconds, isRunning })
};
