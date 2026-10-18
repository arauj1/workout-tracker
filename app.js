// app.js - Main Application Controller for IronLog
let activeWorkout = null;
let workoutTimerInterval = null;
let currentWeightUnit = 'lbs';
let defaultRestSeconds = 90;
let soundEnabled = true;
let hapticsEnabled = true;

// Active new PRs collected during the current workout
let sessionPRs = [];

// Auth & Cloud Sync State
let currentUser = null;
let isSyncing = false;

// Screen Wake Lock & Preferences
let keepScreenAwake = true;
let screenWakeLock = null;
let autoRestTimer = false;

// Routine Templates for quick start
const ROUTINE_TEMPLATES = {
    'Push Day (Chest, Shoulders, Triceps)': [
        { id: 'ex_bench_press', name: 'Barbell Bench Press', category: 'Chest' },
        { id: 'ex_incline_db_press', name: 'Incline Dumbbell Press', category: 'Chest' },
        { id: 'ex_overhead_press', name: 'Standing Overhead Press (OHP)', category: 'Shoulders' },
        { id: 'ex_lateral_raise', name: 'Dumbbell Lateral Raise', category: 'Shoulders' },
        { id: 'ex_tricep_rope_pushdown', name: 'Tricep Rope Pushdown', category: 'Arms' }
    ],
    'Pull Day (Back & Biceps)': [
        { id: 'ex_deadlift', name: 'Conventional Deadlift', category: 'Back' },
        { id: 'ex_barbell_row', name: 'Barbell Bent-Over Row', category: 'Back' },
        { id: 'ex_lat_pulldown', name: 'Lat Pulldown', category: 'Back' },
        { id: 'ex_face_pull', name: 'Face Pull', category: 'Shoulders' },
        { id: 'ex_barbell_curl', name: 'Barbell Bicep Curl', category: 'Arms' },
        { id: 'ex_hammer_curl', name: 'Hammer Curl', category: 'Arms' }
    ],
    'Leg Day (Quads & Hamstrings)': [
        { id: 'ex_barbell_squat', name: 'Barbell Back Squat', category: 'Legs' },
        { id: 'ex_rdl', name: 'Romanian Deadlift (RDL)', category: 'Legs' },
        { id: 'ex_leg_press', name: 'Leg Press', category: 'Legs' },
        { id: 'ex_leg_extension', name: 'Leg Extension', category: 'Legs' },
        { id: 'ex_standing_calf_raise', name: 'Standing Calf Raise', category: 'Legs' }
    ],
    'Full Body Workout': [
        { id: 'ex_barbell_squat', name: 'Barbell Back Squat', category: 'Legs' },
        { id: 'ex_bench_press', name: 'Barbell Bench Press', category: 'Chest' },
        { id: 'ex_barbell_row', name: 'Barbell Bent-Over Row', category: 'Back' },
        { id: 'ex_overhead_press', name: 'Standing Overhead Press (OHP)', category: 'Shoulders' },
        { id: 'ex_cable_crunch', name: 'Kneeling Cable Crunch', category: 'Core' }
    ]
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    await IronDB.openDB();
    await loadSettings();
    initNavigation();
    initRestTimerControls();
    initModalEvents();
    initSettingsEvents();
    checkRecoverActiveWorkout();
    renderLibraryView();
    checkAuthStatus();

    // Register Service Worker for offline PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(err => {
            console.warn('ServiceWorker registration failed:', err);
        });
    }
});

// --- SETTINGS MANAGEMENT ---
async function loadSettings() {
    currentWeightUnit = await IronDB.getSetting('weightUnit', 'lbs');
    defaultRestSeconds = await IronDB.getSetting('defaultRestSeconds', 90);
    soundEnabled = await IronDB.getSetting('soundEnabled', true);
    hapticsEnabled = await IronDB.getSetting('hapticsEnabled', true);
    keepScreenAwake = await IronDB.getSetting('keepScreenAwake', true);
    autoRestTimer = await IronDB.getSetting('autoRestTimer', false);

    // Sync Settings UI
    if (currentWeightUnit === 'kg') {
        document.getElementById('unitKgBtn').classList.add('active');
        document.getElementById('unitLbsBtn').classList.remove('active');
    } else {
        document.getElementById('unitLbsBtn').classList.add('active');
        document.getElementById('unitKgBtn').classList.remove('active');
    }

    const soundChk = document.getElementById('soundToggle');
    if (soundChk) soundChk.checked = soundEnabled;

    const wakeLockChk = document.getElementById('wakeLockToggle');
    if (wakeLockChk) wakeLockChk.checked = keepScreenAwake;

    const autoRestChk = document.getElementById('autoRestTimerToggle');
    if (autoRestChk) autoRestChk.checked = autoRestTimer;

    if (keepScreenAwake) {
        requestWakeLock();
    }
    updateWakeLockUI();
}

function initSettingsEvents() {
    document.getElementById('unitLbsBtn').addEventListener('click', async () => {
        currentWeightUnit = 'lbs';
        await IronDB.setSetting('weightUnit', 'lbs');
        document.getElementById('unitLbsBtn').classList.add('active');
        document.getElementById('unitKgBtn').classList.remove('active');
        renderActiveWorkoutExercises();
    });

    document.getElementById('unitKgBtn').addEventListener('click', async () => {
        currentWeightUnit = 'kg';
        await IronDB.setSetting('weightUnit', 'kg');
        document.getElementById('unitKgBtn').classList.add('active');
        document.getElementById('unitLbsBtn').classList.remove('active');
        renderActiveWorkoutExercises();
    });

    document.getElementById('soundToggle').addEventListener('change', async (e) => {
        soundEnabled = e.target.checked;
        await IronDB.setSetting('soundEnabled', soundEnabled);
    });

    const wakeLockChk = document.getElementById('wakeLockToggle');
    if (wakeLockChk) {
        wakeLockChk.addEventListener('change', async (e) => {
            keepScreenAwake = e.target.checked;
            await IronDB.setSetting('keepScreenAwake', keepScreenAwake);
            if (keepScreenAwake) {
                await requestWakeLock();
            } else {
                await releaseWakeLock();
            }
            updateWakeLockUI();
        });
    }

    const autoRestChk = document.getElementById('autoRestTimerToggle');
    if (autoRestChk) {
        autoRestChk.addEventListener('change', async (e) => {
            autoRestTimer = e.target.checked;
            await IronDB.setSetting('autoRestTimer', autoRestTimer);
        });
    }

    const activeWakeBtn = document.getElementById('activeWakeLockBtn');
    if (activeWakeBtn) {
        activeWakeBtn.addEventListener('click', toggleScreenWakeLock);
    }

    document.getElementById('backupJsonBtn').addEventListener('click', exportBackupJSON);
    document.getElementById('restoreJsonBtn').addEventListener('click', () => {
        document.getElementById('restoreFileInput').click();
    });
    document.getElementById('restoreFileInput').addEventListener('change', handleImportBackup);

    const syncBtn = document.getElementById('syncNowBtn');
    if (syncBtn) syncBtn.addEventListener('click', () => syncToCloud(true));

    const restoreBtn = document.getElementById('restoreCloudBtn');
    if (restoreBtn) restoreBtn.addEventListener('click', restoreFromCloud);
}

// --- SCREEN WAKE LOCK CONTROLS ---
async function requestWakeLock() {
    if (!keepScreenAwake) return;
    if ('wakeLock' in navigator) {
        try {
            screenWakeLock = await navigator.wakeLock.request('screen');
            screenWakeLock.addEventListener('release', () => {
                screenWakeLock = null;
                updateWakeLockUI();
            });
            updateWakeLockUI();
        } catch (err) {
            console.log('Screen Wake Lock request:', err.message);
        }
    }
}

async function releaseWakeLock() {
    if (screenWakeLock !== null) {
        try {
            await screenWakeLock.release();
            screenWakeLock = null;
        } catch (e) {
            console.log('Error releasing wake lock:', e);
        }
    }
    updateWakeLockUI();
}

function updateWakeLockUI() {
    const btn = document.getElementById('activeWakeLockBtn');
    if (btn) {
        if (keepScreenAwake) {
            btn.textContent = '☀️ Screen: Awake';
            btn.style.color = 'var(--accent-emerald)';
            btn.style.borderColor = 'var(--accent-emerald)';
        } else {
            btn.textContent = '🌙 Screen: Normal';
            btn.style.color = 'var(--text-muted)';
            btn.style.borderColor = 'var(--border-subtle)';
        }
    }
}

async function toggleScreenWakeLock() {
    keepScreenAwake = !keepScreenAwake;
    await IronDB.setSetting('keepScreenAwake', keepScreenAwake);
    const toggle = document.getElementById('wakeLockToggle');
    if (toggle) toggle.checked = keepScreenAwake;
    if (keepScreenAwake) {
        await requestWakeLock();
    } else {
        await releaseWakeLock();
    }
    updateWakeLockUI();
}

document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && keepScreenAwake) {
        await requestWakeLock();
    }
});

// --- NAVIGATION & TABS ---
function initNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetViewId = btn.dataset.view;
            switchView(targetViewId);
        });
    });
}

function switchView(viewId) {
    document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

    const targetSec = document.getElementById(viewId);
    if (targetSec) targetSec.classList.add('active');

    const matchingNavBtn = document.querySelector(`.nav-btn[data-view="${viewId}"]`);
    if (matchingNavBtn) matchingNavBtn.classList.add('active');

    // Trigger view-specific renders
    if (viewId === 'viewExercises') renderLibraryView();
    if (viewId === 'viewPRs') renderPRsView();
    if (viewId === 'viewHistory') renderHistoryView();
    if (viewId === 'viewSettings') updateSettingsStats();
}

// --- REST TIMER CONTROLS ---
function initRestTimerControls() {
    document.getElementById('timerMinus30Btn').addEventListener('click', () => IronTimer.adjust(-30));
    document.getElementById('timerPlus30Btn').addEventListener('click', () => IronTimer.adjust(30));
    document.getElementById('timerToggleBtn').addEventListener('click', () => {
        const state = IronTimer.getState();
        if (state.isRunning) {
            IronTimer.pause();
        } else {
            IronTimer.start();
        }
    });
    document.getElementById('timerStopBtn').addEventListener('click', () => IronTimer.stop());
}

// --- ACTIVE WORKOUT LOGIC ---
function checkRecoverActiveWorkout() {
    const saved = localStorage.getItem('ironlog_active_workout');
    if (saved) {
        try {
            activeWorkout = JSON.parse(saved);
            resumeActiveWorkout();
        } catch (e) {
            localStorage.removeItem('ironlog_active_workout');
        }
    }
}

function persistActiveWorkout() {
    if (activeWorkout) {
        localStorage.setItem('ironlog_active_workout', JSON.stringify(activeWorkout));
    } else {
        localStorage.removeItem('ironlog_active_workout');
    }
}

// Start Blank Workout
document.getElementById('startEmptyWorkoutBtn').addEventListener('click', () => {
    startWorkoutSession("Workout Session");
});

// Quick Routine Starters
document.querySelectorAll('.routine-quick-start').forEach(btn => {
    btn.addEventListener('click', () => {
        const routineName = btn.dataset.routine;
        const template = ROUTINE_TEMPLATES[routineName] || [];
        startWorkoutSession(routineName, template);
    });
});

async function startWorkoutSession(title, initialExercises = []) {
    sessionPRs = [];
    activeWorkout = {
        id: 'w_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        title,
        startTime: Date.now(),
        date: new Date().toISOString(),
        durationSeconds: 0,
        isSynced: false,
        exercises: []
    };

    // Pre-populate template exercises with 3 blank sets each
    for (const ex of initialExercises) {
        const prev = await IronDB.getLastPerformance(ex.id);
        activeWorkout.exercises.push({
            exerciseId: ex.id,
            name: ex.name,
            category: ex.category,
            prevData: prev,
            sets: [
                { setNum: 1, weight: '', reps: '', completed: false },
                { setNum: 2, weight: '', reps: '', completed: false },
                { setNum: 3, weight: '', reps: '', completed: false }
            ]
        });
    }

    persistActiveWorkout();
    resumeActiveWorkout();
}

function resumeActiveWorkout() {
    document.getElementById('idleWorkoutView').classList.add('hidden');
    document.getElementById('activeWorkoutView').classList.remove('hidden');

    const titleInput = document.getElementById('workoutTitleInput');
    titleInput.value = activeWorkout.title || 'Workout Session';
    titleInput.oninput = () => {
        activeWorkout.title = titleInput.value.trim() || 'Workout Session';
        persistActiveWorkout();
    };

    // Keep screen awake during active workout if enabled
    if (keepScreenAwake) {
        requestWakeLock();
    }
    updateWakeLockUI();

    // Start elapsed session timer
    if (workoutTimerInterval) clearInterval(workoutTimerInterval);
    workoutTimerInterval = setInterval(() => {
        if (!activeWorkout) return;
        activeWorkout.durationSeconds = Math.floor((Date.now() - activeWorkout.startTime) / 1000);
        const formatted = IronTimer.formatTime(activeWorkout.durationSeconds);
        document.getElementById('sessionTimerDisplay').textContent = `⏱ Elapsed: ${formatted}`;
        persistActiveWorkout();
    }, 1000);

    renderActiveWorkoutExercises();
}

// Render exercises in active workout
async function renderActiveWorkoutExercises() {
    const list = document.getElementById('activeExercisesList');
    list.innerHTML = '';

    if (!activeWorkout || !activeWorkout.exercises || activeWorkout.exercises.length === 0) {
        list.innerHTML = `
            <div class="card" style="text-align: center; color: var(--text-muted); padding: 24px 16px;">
                <p style="font-size: 13px;">No exercises added yet.</p>
                <p style="font-size: 11px; margin-top: 4px;">Tap <b>+ Add Exercise</b> below to pick your lifts.</p>
            </div>
        `;
        updateTotalVolume();
        return;
    }

    for (let exIndex = 0; exIndex < activeWorkout.exercises.length; exIndex++) {
        const item = activeWorkout.exercises[exIndex];

        // Ensure previous performance is loaded for hint
        if (!item.prevData) {
            item.prevData = await IronDB.getLastPerformance(item.exerciseId);
        }

        let prevHintText = 'First time tracking this lift';
        if (item.prevData && item.prevData.sets && item.prevData.sets.length > 0) {
            const best = item.prevData.sets.reduce((max, s) => (s.weight > (max.weight || 0) ? s : max), item.prevData.sets[0]);
            prevHintText = `Last session best: <span>${best.weight} ${currentWeightUnit} × ${best.reps} reps</span>`;
        }

        const card = document.createElement('div');
        card.className = 'exercise-card';
        card.innerHTML = `
            <div class="exercise-header">
                <div>
                    <div class="exercise-title">${item.name}</div>
                    <div class="prev-perf-hint">${prevHintText}</div>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="badge-tag">${item.category}</span>
                    <button class="btn-remove-set" onclick="removeExerciseFromWorkout(${exIndex})" title="Remove Exercise">✕</button>
                </div>
            </div>

            <div class="sets-grid">
                <div class="set-row-header">
                    <span>SET</span>
                    <span>PREV</span>
                    <span>${currentWeightUnit.toUpperCase()}</span>
                    <span>REPS</span>
                    <span>✓</span>
                </div>
                <div id="setsContainer_${exIndex}">
                    <!-- Sets rendered below -->
                </div>
            </div>

            <button class="btn btn-secondary btn-full btn-sm" onclick="addSetToExercise(${exIndex})" style="margin-top: 8px;">
                + Add Set
            </button>
        `;

        const setsContainer = card.querySelector(`#setsContainer_${exIndex}`);
        item.sets.forEach((set, setIndex) => {
            const prevSet = item.prevData?.sets?.[setIndex];
            const prevText = prevSet ? `${prevSet.weight}×${prevSet.reps}` : '—';
            const isDone = set.completed;
            const prBadgeHtml = set.isPR ? `<span class="pr-badge">🔥 PR</span>` : '';

            const row = document.createElement('div');
            row.className = `set-row ${isDone ? 'completed' : ''}`;
            row.innerHTML = `
                <div class="set-num">${set.setNum}</div>
                <div style="font-size: 11px; font-family: var(--font-mono); color: var(--text-muted); text-align: center;">${prevText}</div>
                <div>
                    <input type="number" inputmode="decimal" class="set-input set-weight" 
                           placeholder="0" value="${set.weight || ''}" 
                           oninput="updateSetField(${exIndex}, ${setIndex}, 'weight', this.value)" />
                </div>
                <div>
                    <input type="number" inputmode="numeric" class="set-input set-reps" 
                           placeholder="0" value="${set.reps || ''}" 
                           oninput="updateSetField(${exIndex}, ${setIndex}, 'reps', this.value)" />
                </div>
                <button class="btn-check-set" onclick="toggleSetComplete(${exIndex}, ${setIndex})">
                    ${isDone ? '✓' : ''}
                </button>
            `;
            setsContainer.appendChild(row);
        });

        list.appendChild(card);
    }

    updateTotalVolume();
}

function updateSetField(exIndex, setIndex, field, value) {
    if (!activeWorkout) return;
    const set = activeWorkout.exercises[exIndex].sets[setIndex];
    set[field] = value ? parseFloat(value) : '';
    persistActiveWorkout();
    updateTotalVolume();
}

async function toggleSetComplete(exIndex, setIndex) {
    if (!activeWorkout) return;
    const exercise = activeWorkout.exercises[exIndex];
    const set = exercise.sets[setIndex];

    set.completed = !set.completed;

    if (set.completed) {
        IronAudio.triggerHaptic(40);

        // Check and track Personal Record (PR)
        const weight = parseFloat(set.weight) || 0;
        const reps = parseInt(set.reps, 10) || 0;

        if (weight > 0 && reps > 0) {
            const prResult = await IronDB.checkAndUpdatePR(exercise.exerciseId, exercise.name, weight, reps);
            if (prResult && prResult.isPR) {
                set.isPR = true;
                sessionPRs.push({
                    exerciseName: exercise.name,
                    weight,
                    reps,
                    est1RM: prResult.est1RM
                });
                IronAudio.playPRCelebration();
                IronAudio.triggerHaptic([60, 40, 100]);
            }
        }

        // Auto-start rest timer only if opted-in in settings (default: false)
        if (autoRestTimer) {
            IronTimer.start(defaultRestSeconds);
        }
    } else {
        set.isPR = false;
    }

    persistActiveWorkout();
    renderActiveWorkoutExercises();
}

function addSetToExercise(exIndex) {
    if (!activeWorkout) return;
    const ex = activeWorkout.exercises[exIndex];
    const lastSet = ex.sets[ex.sets.length - 1];
    const newSetNum = ex.sets.length + 1;
    // Copy weight and reps from previous set as convenient starting point
    ex.sets.push({
        setNum: newSetNum,
        weight: lastSet ? lastSet.weight : '',
        reps: lastSet ? lastSet.reps : '',
        completed: false
    });
    persistActiveWorkout();
    renderActiveWorkoutExercises();
    IronAudio.triggerHaptic(25);
}

function removeExerciseFromWorkout(exIndex) {
    if (!activeWorkout) return;
    const exName = activeWorkout.exercises[exIndex].name;
    if (confirm(`Remove ${exName} from current workout?`)) {
        activeWorkout.exercises.splice(exIndex, 1);
        persistActiveWorkout();
        renderActiveWorkoutExercises();
    }
}

function updateTotalVolume() {
    if (!activeWorkout) return;
    let totalVolume = 0;
    activeWorkout.exercises.forEach(ex => {
        ex.sets.forEach(s => {
            if (s.completed && s.weight && s.reps) {
                totalVolume += (s.weight * s.reps);
            }
        });
    });
    document.getElementById('sessionVolumeDisplay').textContent = `${totalVolume.toLocaleString()} ${currentWeightUnit} Volume`;
}

// Finish & Save Workout
document.getElementById('finishWorkoutBtn').addEventListener('click', finishActiveWorkout);

async function finishActiveWorkout() {
    if (!activeWorkout) return;

    // Check completed sets count
    let completedSetsCount = 0;
    let totalVolume = 0;
    activeWorkout.exercises.forEach(ex => {
        ex.sets.forEach(s => {
            if (s.completed) {
                completedSetsCount++;
                if (s.weight && s.reps) totalVolume += (s.weight * s.reps);
            }
        });
    });

    if (completedSetsCount === 0) {
        if (!confirm("No completed sets logged yet. Finish anyway?")) return;
    }

    // Stop timers
    if (workoutTimerInterval) clearInterval(workoutTimerInterval);
    IronTimer.stop();

    activeWorkout.completedAt = new Date().toISOString();
    activeWorkout.totalVolume = totalVolume;
    activeWorkout.totalSets = completedSetsCount;
    activeWorkout.isSynced = false;

    // Save to IndexedDB
    await IronDB.saveWorkout(activeWorkout);

    // Auto-sync in background if logged in and online
    if (currentUser && navigator.onLine) {
        syncToCloud(false).catch(err => console.log('Background sync deferred:', err));
    }

    // Show Workout Summary Modal
    document.getElementById('summaryWorkoutTitle').textContent = activeWorkout.title;
    document.getElementById('summaryDuration').textContent = IronTimer.formatTime(activeWorkout.durationSeconds);
    document.getElementById('summaryVolume').textContent = `${totalVolume.toLocaleString()} ${currentWeightUnit}`;

    const prsSection = document.getElementById('summaryPRsSection');
    const prsList = document.getElementById('summaryPRsList');
    if (sessionPRs.length > 0) {
        prsSection.classList.remove('hidden');
        prsList.innerHTML = sessionPRs.map(pr => `<div><b>${pr.exerciseName}</b>: ${pr.weight} ${currentWeightUnit} × ${pr.reps} (1RM: ~${pr.est1RM})</div>`).join('');
    } else {
        prsSection.classList.add('hidden');
    }

    document.getElementById('workoutSummaryModal').classList.remove('hidden');
    IronAudio.playPRCelebration();

    // Clear active session
    activeWorkout = null;
    sessionPRs = [];
    localStorage.removeItem('ironlog_active_workout');

    // Reset View
    document.getElementById('activeWorkoutView').classList.add('hidden');
    document.getElementById('idleWorkoutView').classList.remove('hidden');
}

document.getElementById('closeSummaryBtn').addEventListener('click', () => {
    document.getElementById('workoutSummaryModal').classList.add('hidden');
    switchView('viewHistory');
});

// Cancel Workout
document.getElementById('cancelWorkoutBtn').addEventListener('click', () => {
    if (confirm("Discard this active workout session? Logged sets will not be saved.")) {
        if (workoutTimerInterval) clearInterval(workoutTimerInterval);
        IronTimer.stop();
        activeWorkout = null;
        localStorage.removeItem('ironlog_active_workout');

        document.getElementById('activeWorkoutView').classList.add('hidden');
        document.getElementById('idleWorkoutView').classList.remove('hidden');
    }
});

// --- EXERCISE PICKER MODAL ---
document.getElementById('addExerciseToWorkoutBtn').addEventListener('click', openExercisePicker);
document.getElementById('closePickerBtn').addEventListener('click', () => {
    document.getElementById('exercisePickerModal').classList.add('hidden');
});

async function openExercisePicker() {
    const modal = document.getElementById('exercisePickerModal');
    modal.classList.remove('hidden');
    renderPickerExercises('All', '');
}

async function renderPickerExercises(category = 'All', searchQuery = '') {
    const list = document.getElementById('pickerExercisesList');
    list.innerHTML = '';
    const all = await IronDB.getAllExercises();

    const filtered = all.filter(ex => {
        const matchesCategory = category === 'All' || ex.category.toLowerCase() === category.toLowerCase();
        const matchesSearch = !searchQuery || ex.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    if (filtered.length === 0) {
        list.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 20px;">No exercises found.</div>`;
        return;
    }

    filtered.forEach(ex => {
        const item = document.createElement('div');
        item.className = 'card';
        item.style.marginBottom = '6px';
        item.style.padding = '12px 14px';
        item.style.cursor = 'pointer';
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';

        item.innerHTML = `
            <div>
                <div style="font-size: 14px; font-weight: 700; color: #fff;">${ex.name}</div>
                <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">${ex.equipment || 'Barbell'}</div>
            </div>
            <span class="badge-tag">${ex.category}</span>
        `;

        item.addEventListener('click', async () => {
            if (!activeWorkout) return;
            const prev = await IronDB.getLastPerformance(ex.id);
            activeWorkout.exercises.push({
                exerciseId: ex.id,
                name: ex.name,
                category: ex.category,
                prevData: prev,
                sets: [
                    { setNum: 1, weight: '', reps: '', completed: false },
                    { setNum: 2, weight: '', reps: '', completed: false },
                    { setNum: 3, weight: '', reps: '', completed: false }
                ]
            });
            persistActiveWorkout();
            document.getElementById('exercisePickerModal').classList.add('hidden');
            renderActiveWorkoutExercises();
            IronAudio.triggerHaptic(30);
        });

        list.appendChild(item);
    });
}

// Picker category pills
document.querySelectorAll('#pickerFilterPills .filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
        document.querySelectorAll('#pickerFilterPills .filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const cat = pill.dataset.category;
        const query = document.getElementById('pickerSearchInput').value.trim();
        renderPickerExercises(cat, query);
    });
});

document.getElementById('pickerSearchInput').addEventListener('input', (e) => {
    const activePill = document.querySelector('#pickerFilterPills .filter-pill.active');
    const cat = activePill ? activePill.dataset.category : 'All';
    renderPickerExercises(cat, e.target.value.trim());
});

// --- EXERCISE LIBRARY VIEW ---
async function renderLibraryView(category = 'All', searchQuery = '') {
    const list = document.getElementById('exerciseLibraryList');
    if (!list) return;
    list.innerHTML = '';
    const all = await IronDB.getAllExercises();

    const filtered = all.filter(ex => {
        const matchesCategory = category === 'All' || ex.category.toLowerCase() === category.toLowerCase();
        const matchesSearch = !searchQuery || ex.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    for (const ex of filtered) {
        const pr = await IronDB.getPR(ex.id);
        const card = document.createElement('div');
        card.className = 'card';
        card.style.marginBottom = '6px';
        card.style.padding = '12px 14px';

        const prText = pr ? `🏆 PR: <b>${pr.maxWeight} ${currentWeightUnit}</b> (1RM: ~${pr.est1RM})` : 'No logs yet';

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                    <div style="font-size: 15px; font-weight: 700; color: #fff;">${ex.name}</div>
                    <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                        ${ex.equipment} • ${prText}
                    </div>
                </div>
                <span class="badge-tag">${ex.category}</span>
            </div>
        `;
        list.appendChild(card);
    }
}

// Library category pills
document.querySelectorAll('#muscleFilterPills .filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
        document.querySelectorAll('#muscleFilterPills .filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const cat = pill.dataset.category;
        const query = document.getElementById('exerciseSearchInput').value.trim();
        renderLibraryView(cat, query);
    });
});

document.getElementById('exerciseSearchInput').addEventListener('input', (e) => {
    const activePill = document.querySelector('#muscleFilterPills .filter-pill.active');
    const cat = activePill ? activePill.dataset.category : 'All';
    renderLibraryView(cat, e.target.value.trim());
});

// Custom Exercise Modal
document.getElementById('openCustomExerciseModalBtn').addEventListener('click', () => {
    document.getElementById('customExNameInput').value = '';
    document.getElementById('customExerciseModal').classList.remove('hidden');
    setTimeout(() => document.getElementById('customExNameInput').focus(), 50);
});

document.getElementById('closeCustomExBtn').addEventListener('click', () => {
    document.getElementById('customExerciseModal').classList.add('hidden');
});

document.getElementById('saveCustomExBtn').addEventListener('click', async () => {
    const name = document.getElementById('customExNameInput').value.trim();
    const category = document.getElementById('customExCategorySelect').value;
    const equipment = document.getElementById('customExEquipmentSelect').value;

    if (!name) return alert("Please enter an exercise name.");

    await IronDB.addCustomExercise(name, category, equipment);
    document.getElementById('customExerciseModal').classList.add('hidden');
    renderLibraryView();
    IronAudio.triggerHaptic(40);
});

// --- PRs LEADERBOARD VIEW ---
async function renderPRsView() {
    const list = document.getElementById('prsList');
    list.innerHTML = '';
    const prs = await IronDB.getAllPRs();

    if (prs.length === 0) {
        list.innerHTML = `
            <div class="card" style="text-align: center; color: var(--text-muted); padding: 32px 16px;">
                <div style="font-size: 32px; margin-bottom: 8px;">🏆</div>
                <p style="font-size: 14px; font-weight: 700; color: #fff;">No Records Yet</p>
                <p style="font-size: 12px; margin-top: 4px;">Complete sets during a workout and your personal records will appear here.</p>
            </div>
        `;
        return;
    }

    // Sort by heaviest weight
    prs.sort((a, b) => (b.maxWeight || 0) - (a.maxWeight || 0));

    prs.forEach(pr => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                    <div style="font-size: 16px; font-weight: 800; color: #fff;">${pr.exerciseName}</div>
                    <div style="font-size: 12px; color: var(--text-muted); margin-top: 3px;">
                        Best Set: <b style="color: #fff;">${pr.bestSet} ${currentWeightUnit}</b>
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 18px; font-weight: 900; color: var(--accent-amber); font-family: var(--font-mono);">
                        ${pr.maxWeight} <span style="font-size: 11px;">${currentWeightUnit}</span>
                    </div>
                    <div style="font-size: 11px; color: var(--accent-emerald); font-weight: 700;">
                        1RM: ~${pr.est1RM} ${currentWeightUnit}
                    </div>
                </div>
            </div>
        `;
        list.appendChild(card);
    });
}

// --- HISTORY VIEW ---
async function renderHistoryView() {
    const list = document.getElementById('historyList');
    list.innerHTML = '';
    const workouts = await IronDB.getAllWorkouts();

    if (workouts.length === 0) {
        list.innerHTML = `
            <div class="card" style="text-align: center; color: var(--text-muted); padding: 32px 16px;">
                <div style="font-size: 32px; margin-bottom: 8px;">📜</div>
                <p style="font-size: 14px; font-weight: 700; color: #fff;">No Workouts Logged</p>
                <p style="font-size: 12px; margin-top: 4px;">Start a workout from the Workout tab to log your history.</p>
            </div>
        `;
        return;
    }

    workouts.forEach(w => {
        const dateStr = new Date(w.date || w.startTime).toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });

        const syncBadge = w.isSynced
            ? `<span class="sync-badge sync-done">✓ Synced</span>`
            : `<span class="sync-badge sync-pending">☁️ Local</span>`;

        const card = document.createElement('div');
        card.className = 'history-card';
        card.innerHTML = `
            <div class="history-header">
                <div>
                    <div class="history-title">${w.title}</div>
                    <div class="history-date">${dateStr}</div>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    ${syncBadge}
                    <button class="btn-remove-set" onclick="deleteHistoryWorkout('${w.id}')" title="Delete">✕</button>
                </div>
            </div>
            <div class="history-stats">
                <span>⏱ <b>${IronTimer.formatTime(w.durationSeconds || 0)}</b></span>
                <span>💪 <b>${(w.totalVolume || 0).toLocaleString()} ${currentWeightUnit}</b></span>
                <span>🏋️ <b>${(w.exercises || []).length} Exercises</b></span>
            </div>
            <div style="margin-top: 8px; font-size: 11px; color: var(--text-muted); line-height: 1.4;">
                ${(w.exercises || []).map(e => e.name).join(' • ')}
            </div>
        `;
        list.appendChild(card);
    });
}

window.deleteHistoryWorkout = async function(id) {
    if (confirm("Delete this workout from history?")) {
        await IronDB.deleteWorkout(id);
        renderHistoryView();
    }
};

// --- DATA BACKUP & RESTORE ---
async function exportBackupJSON() {
    const workouts = await IronDB.getAllWorkouts();
    const prs = await IronDB.getAllPRs();
    const exercises = await IronDB.getAllExercises();

    const data = {
        app: 'IronLog',
        version: 1,
        exportedAt: new Date().toISOString(),
        workouts,
        prs,
        exercises
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `IronLog_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

document.getElementById('exportHistoryBtn').addEventListener('click', exportBackupJSON);

async function handleImportBackup(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (Array.isArray(data.workouts)) {
            for (const w of data.workouts) {
                await IronDB.saveWorkout(w);
            }
        }

        alert("Backup imported successfully!");
        renderHistoryView();
        renderLibraryView();
        renderPRsView();
    } catch (err) {
        alert("Invalid backup file: " + err.message);
    }
}

// Update settings stats
async function updateSettingsStats() {
    const workouts = await IronDB.getAllWorkouts();
    const unsynced = await IronDB.getUnsyncedWorkouts();

    const localCountElem = document.getElementById('localWorkoutsCount');
    const unsyncedElem = document.getElementById('unsyncedCount');

    if (localCountElem) localCountElem.textContent = workouts.length;
    if (unsyncedElem) {
        if (unsynced.length === 0) {
            unsyncedElem.innerHTML = `<span style="color: var(--accent-emerald);">0 (All Synced ☁️)</span>`;
        } else {
            unsyncedElem.innerHTML = `<span style="color: var(--accent-amber);">${unsynced.length} pending sync</span>`;
        }
    }
}

// --- AUTHENTICATION & CLOUD SYNC ---
async function checkAuthStatus() {
    // 1. Immediately load cached user from localStorage for instant offline recognition
    const cached = localStorage.getItem('ironlog_cached_user');
    if (cached) {
        try {
            currentUser = JSON.parse(cached);
            updateAuthUI(currentUser);
        } catch (e) {
            localStorage.removeItem('ironlog_cached_user');
        }
    }

    // 2. Verify with SWA auth endpoint if online
    if (navigator.onLine) {
        try {
            const res = await fetch('/.auth/me');
            if (res.ok) {
                const data = await res.json();
                const principal = data.clientPrincipal;
                if (principal && principal.userId) {
                    currentUser = principal;
                    localStorage.setItem('ironlog_cached_user', JSON.stringify(principal));
                    updateAuthUI(currentUser);
                    return currentUser;
                } else {
                    // Explicitly logged out on server
                    currentUser = null;
                    localStorage.removeItem('ironlog_cached_user');
                    updateAuthUI(null);
                    return null;
                }
            }
        } catch (e) {
            console.log('Running offline or auth endpoint unavailable, keeping local state:', e);
        }
    }

    return currentUser;
}

function updateAuthUI(user) {
    const loginBtn = document.getElementById('headerLoginBtn');
    const profileDiv = document.getElementById('headerUserProfile');
    const userNameSpan = document.getElementById('headerUserName');
    const unauthPrompt = document.getElementById('unauthPrompt');
    const authUserInfo = document.getElementById('authUserInfo');
    const userEmailDisplay = document.getElementById('userEmailDisplay');
    const syncStatusBadge = document.getElementById('syncStatusBadge');

    if (user) {
        if (loginBtn) loginBtn.classList.add('hidden');
        if (profileDiv) profileDiv.classList.remove('hidden');
        if (userNameSpan) userNameSpan.textContent = user.userDetails || 'Signed In';
        if (unauthPrompt) unauthPrompt.classList.add('hidden');
        if (authUserInfo) authUserInfo.classList.remove('hidden');
        if (userEmailDisplay) userEmailDisplay.textContent = user.userDetails || 'Family Member';
        if (syncStatusBadge) {
            syncStatusBadge.className = 'sync-badge sync-done';
            syncStatusBadge.textContent = '✓ Cloud Connected';
        }
    } else {
        if (loginBtn) loginBtn.classList.remove('hidden');
        if (profileDiv) profileDiv.classList.add('hidden');
        if (unauthPrompt) unauthPrompt.classList.remove('hidden');
        if (authUserInfo) authUserInfo.classList.add('hidden');
        if (syncStatusBadge) {
            syncStatusBadge.className = 'sync-badge sync-pending';
            syncStatusBadge.textContent = 'Local Only';
        }
    }
}

async function syncToCloud(interactive = true) {
    if (isSyncing) return;

    if (!currentUser) {
        if (interactive) {
            if (confirm("You are not signed in. Sign in with your Microsoft Account to sync your workouts to your personal cloud storage?")) {
                window.location.href = '/.auth/login/aad?post_login_redirect_uri=/';
            }
        }
        return;
    }

    const unsynced = await IronDB.getUnsyncedWorkouts();
    if (unsynced.length === 0) {
        if (interactive) alert("All workouts are already backed up to the cloud!");
        updateSettingsStats();
        return;
    }

    const syncBtn = document.getElementById('syncNowBtn');
    if (syncBtn) {
        syncBtn.disabled = true;
        syncBtn.textContent = '⏳ Syncing...';
    }
    isSyncing = true;

    try {
        const response = await fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workouts: unsynced })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.message || `Server error (${response.status})`);
        }

        const result = await response.json();

        // Mark as synced locally in IndexedDB
        for (const w of unsynced) {
            await IronDB.markWorkoutSynced(w.id);
        }

        await updateSettingsStats();
        renderHistoryView();

        if (interactive) {
            alert(`🎉 Cloud Sync Complete! Successfully backed up ${result.syncedCount || unsynced.length} workout(s) to Azure Cosmos DB.`);
        }
    } catch (err) {
        console.error('Cloud sync error:', err);
        if (interactive) {
            alert(`Cloud sync could not be completed: ${err.message}`);
        }
    } finally {
        isSyncing = false;
        if (syncBtn) {
            syncBtn.disabled = false;
            syncBtn.textContent = '☁️ Sync to Cloud';
        }
    }
}

async function restoreFromCloud() {
    if (!currentUser) {
        if (confirm("Please sign in with your Microsoft Account to restore your workouts from the cloud. Sign in now?")) {
            window.location.href = '/.auth/login/aad?post_login_redirect_uri=/';
        }
        return;
    }

    if (!confirm("Download and restore your workouts from Azure Cosmos DB? Workouts from your cloud account will be added to this device.")) {
        return;
    }

    const restoreBtn = document.getElementById('restoreCloudBtn');
    if (restoreBtn) {
        restoreBtn.disabled = true;
        restoreBtn.textContent = '⏳ Restoring...';
    }

    try {
        const response = await fetch('/api/sync', {
            method: 'GET'
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.message || `Server error (${response.status})`);
        }

        const data = await response.json();
        const cloudWorkouts = data.workouts || [];

        if (cloudWorkouts.length === 0) {
            alert("No cloud workouts found for your account.");
            return;
        }

        let restoredCount = 0;
        for (const w of cloudWorkouts) {
            w.isSynced = true;
            await IronDB.saveWorkout(w);
            restoredCount++;
        }

        await updateSettingsStats();
        renderHistoryView();
        renderPRsView();

        alert(`✅ Restored ${restoredCount} workout(s) from Azure Cosmos DB!`);
    } catch (err) {
        console.error('Cloud restore error:', err);
        alert(`Failed to restore from cloud: ${err.message}`);
    } finally {
        if (restoreBtn) {
            restoreBtn.disabled = false;
            restoreBtn.textContent = '📥 Restore from Cloud';
        }
    }
}

// Modals generic overlay click to close
function initModalEvents() {
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.add('hidden');
        });
    });
}
