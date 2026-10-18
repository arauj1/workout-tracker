// db.js - IndexedDB Storage Layer for IronLog
const DB_NAME = 'IronLogDB';
const DB_VERSION = 1;

const DEFAULT_EXERCISES = [
    // Chest
    { id: 'ex_bench_press', name: 'Barbell Bench Press', category: 'Chest', equipment: 'Barbell' },
    { id: 'ex_incline_db_press', name: 'Incline Dumbbell Press', category: 'Chest', equipment: 'Dumbbell' },
    { id: 'ex_dips', name: 'Chest Dips', category: 'Chest', equipment: 'Bodyweight' },
    { id: 'ex_cable_fly', name: 'Cable Fly', category: 'Chest', equipment: 'Cable' },
    { id: 'ex_pushups', name: 'Push-Ups', category: 'Chest', equipment: 'Bodyweight' },

    // Back
    { id: 'ex_deadlift', name: 'Conventional Deadlift', category: 'Back', equipment: 'Barbell' },
    { id: 'ex_barbell_row', name: 'Barbell Bent-Over Row', category: 'Back', equipment: 'Barbell' },
    { id: 'ex_pullup', name: 'Pull-Up', category: 'Back', equipment: 'Bodyweight' },
    { id: 'ex_lat_pulldown', name: 'Lat Pulldown', category: 'Back', equipment: 'Cable' },
    { id: 'ex_seated_cable_row', name: 'Seated Cable Row', category: 'Back', equipment: 'Cable' },
    { id: 'ex_t_bar_row', name: 'T-Bar Row', category: 'Back', equipment: 'Barbell' },

    // Legs
    { id: 'ex_barbell_squat', name: 'Barbell Back Squat', category: 'Legs', equipment: 'Barbell' },
    { id: 'ex_front_squat', name: 'Front Squat', category: 'Legs', equipment: 'Barbell' },
    { id: 'ex_leg_press', name: 'Leg Press', category: 'Legs', equipment: 'Machine' },
    { id: 'ex_rdl', name: 'Romanian Deadlift (RDL)', category: 'Legs', equipment: 'Barbell' },
    { id: 'ex_leg_extension', name: 'Leg Extension', category: 'Legs', equipment: 'Machine' },
    { id: 'ex_hamstring_curl', name: 'Seated / Lying Leg Curl', category: 'Legs', equipment: 'Machine' },
    { id: 'ex_standing_calf_raise', name: 'Standing Calf Raise', category: 'Legs', equipment: 'Machine' },
    { id: 'ex_bulgarian_split_squat', name: 'Bulgarian Split Squat', category: 'Legs', equipment: 'Dumbbell' },

    // Shoulders
    { id: 'ex_overhead_press', name: 'Standing Overhead Press (OHP)', category: 'Shoulders', equipment: 'Barbell' },
    { id: 'ex_seated_db_press', name: 'Seated Dumbbell Shoulder Press', category: 'Shoulders', equipment: 'Dumbbell' },
    { id: 'ex_lateral_raise', name: 'Dumbbell Lateral Raise', category: 'Shoulders', equipment: 'Dumbbell' },
    { id: 'ex_cable_lateral_raise', name: 'Cable Lateral Raise', category: 'Shoulders', equipment: 'Cable' },
    { id: 'ex_face_pull', name: 'Face Pull', category: 'Shoulders', equipment: 'Cable' },
    { id: 'ex_rear_delt_fly', name: 'Rear Delt Reverse Fly', category: 'Shoulders', equipment: 'Dumbbell' },

    // Arms
    { id: 'ex_barbell_curl', name: 'Barbell Bicep Curl', category: 'Arms', equipment: 'Barbell' },
    { id: 'ex_dumbbell_curl', name: 'Incline Dumbbell Curl', category: 'Arms', equipment: 'Dumbbell' },
    { id: 'ex_hammer_curl', name: 'Hammer Curl', category: 'Arms', equipment: 'Dumbbell' },
    { id: 'ex_preacher_curl', name: 'Preacher Curl', category: 'Arms', equipment: 'Barbell' },
    { id: 'ex_skull_crushers', name: 'Lying Tricep Extension (Skull Crushers)', category: 'Arms', equipment: 'Barbell' },
    { id: 'ex_tricep_rope_pushdown', name: 'Tricep Rope Pushdown', category: 'Arms', equipment: 'Cable' },
    { id: 'ex_overhead_tricep_ext', name: 'Overhead Cable Tricep Extension', category: 'Arms', equipment: 'Cable' },

    // Core
    { id: 'ex_hanging_leg_raise', name: 'Hanging Leg Raise', category: 'Core', equipment: 'Bodyweight' },
    { id: 'ex_cable_crunch', name: 'Kneeling Cable Crunch', category: 'Core', equipment: 'Cable' },
    { id: 'ex_ab_wheel', name: 'Ab Wheel Rollout', category: 'Core', equipment: 'Bodyweight' },
    { id: 'ex_plank', name: 'Weighted Plank', category: 'Core', equipment: 'Bodyweight' }
];

let dbInstance = null;

function openDB() {
    return new Promise((resolve, reject) => {
        if (dbInstance) return resolve(dbInstance);

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            // 1. Workouts Store
            if (!db.objectStoreNames.contains('workouts')) {
                const workoutStore = db.createObjectStore('workouts', { keyPath: 'id' });
                workoutStore.createIndex('date', 'date', { unique: false });
                workoutStore.createIndex('isSynced', 'isSynced', { unique: false });
            }

            // 2. Exercises Store
            if (!db.objectStoreNames.contains('exercises')) {
                const exStore = db.createObjectStore('exercises', { keyPath: 'id' });
                exStore.createIndex('category', 'category', { unique: false });
                exStore.createIndex('name', 'name', { unique: false });

                // Seed default exercises
                DEFAULT_EXERCISES.forEach(ex => exStore.add(ex));
            }

            // 3. PR Store (Personal Records)
            if (!db.objectStoreNames.contains('prs')) {
                const prStore = db.createObjectStore('prs', { keyPath: 'exerciseId' });
                prStore.createIndex('updatedAt', 'updatedAt', { unique: false });
            }

            // 4. Settings Store
            if (!db.objectStoreNames.contains('settings')) {
                const settingsStore = db.createObjectStore('settings', { keyPath: 'key' });
                settingsStore.add({ key: 'weightUnit', value: 'lbs' });
                settingsStore.add({ key: 'defaultRestSeconds', value: 90 });
                settingsStore.add({ key: 'soundEnabled', value: true });
                settingsStore.add({ key: 'hapticsEnabled', value: true });
            }
        };

        request.onsuccess = (event) => {
            dbInstance = event.target.result;
            resolve(dbInstance);
        };

        request.onerror = (event) => {
            console.error('IndexedDB open error:', event.target.error);
            reject(event.target.error);
        };
    });
}

// --- WORKOUT OPERATIONS ---
async function saveWorkout(workout) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('workouts', 'readwrite');
        const store = tx.objectStore('workouts');
        if (!workout.id) {
            workout.id = 'w_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        }
        if (workout.isSynced === undefined) {
            workout.isSynced = false;
        }
        workout.updatedAt = new Date().toISOString();
        const req = store.put(workout);
        req.onsuccess = () => resolve(workout);
        req.onerror = () => reject(req.error);
    });
}

async function getAllWorkouts() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('workouts', 'readonly');
        const store = tx.objectStore('workouts');
        const req = store.getAll();
        req.onsuccess = () => {
            // Sort by date descending (newest first)
            const list = req.result.sort((a, b) => new Date(b.date || b.startTime) - new Date(a.date || a.startTime));
            resolve(list);
        };
        req.onerror = () => reject(req.error);
    });
}

async function getWorkout(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('workouts', 'readonly');
        const store = tx.objectStore('workouts');
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function deleteWorkout(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('workouts', 'readwrite');
        const store = tx.objectStore('workouts');
        const req = store.delete(id);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
    });
}

async function getUnsyncedWorkouts() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('workouts', 'readonly');
        const store = tx.objectStore('workouts');
        const index = store.index('isSynced');
        const req = index.getAll(false);
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
    });
}

async function markWorkoutSynced(id) {
    const db = await openDB();
    const workout = await getWorkout(id);
    if (!workout) return;
    workout.isSynced = true;
    return saveWorkout(workout);
}

// --- EXERCISE OPERATIONS ---
async function getAllExercises() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('exercises', 'readonly');
        const store = tx.objectStore('exercises');
        const req = store.getAll();
        req.onsuccess = () => {
            const list = req.result.sort((a, b) => a.name.localeCompare(b.name));
            resolve(list);
        };
        req.onerror = () => reject(req.error);
    });
}

async function addCustomExercise(name, category, equipment = 'Barbell') {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('exercises', 'readwrite');
        const store = tx.objectStore('exercises');
        const id = 'custom_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
        const exercise = { id, name: name.trim(), category, equipment, isCustom: true };
        const req = store.add(exercise);
        req.onsuccess = () => resolve(exercise);
        req.onerror = () => reject(req.error);
    });
}

// Find previous performance for progressive overload
async function getLastPerformance(exerciseId) {
    const workouts = await getAllWorkouts();
    for (const w of workouts) {
        if (!w.exercises) continue;
        const match = w.exercises.find(e => e.exerciseId === exerciseId);
        if (match && match.sets && match.sets.length > 0) {
            // Return completed sets
            const validSets = match.sets.filter(s => s.completed);
            if (validSets.length > 0) {
                return {
                    workoutDate: w.date || w.startTime,
                    sets: validSets
                };
            }
        }
    }
    return null;
}

// --- PR TRACKING ---
// Calculates Estimated 1RM via Epley Formula: Weight * (1 + Reps / 30)
function calculate1RM(weight, reps) {
    if (!weight || !reps || reps <= 0) return 0;
    if (reps === 1) return weight;
    return Math.round(weight * (1 + reps / 30));
}

async function getPR(exerciseId) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('prs', 'readonly');
        const store = tx.objectStore('prs');
        const req = store.get(exerciseId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
    });
}

async function getAllPRs() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('prs', 'readonly');
        const store = tx.objectStore('prs');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
    });
}

async function checkAndUpdatePR(exerciseId, exerciseName, weight, reps) {
    if (!weight || !reps || weight <= 0 || reps <= 0) return null;

    const est1RM = calculate1RM(weight, reps);
    const existing = await getPR(exerciseId);

    let isNewWeightPR = false;
    let isNew1RMPR = false;

    if (!existing) {
        isNewWeightPR = true;
        isNew1RMPR = true;
    } else {
        if (weight > (existing.maxWeight || 0)) isNewWeightPR = true;
        if (est1RM > (existing.est1RM || 0)) isNew1RMPR = true;
    }

    if (isNewWeightPR || isNew1RMPR) {
        const updated = {
            exerciseId,
            exerciseName,
            maxWeight: Math.max(weight, existing?.maxWeight || 0),
            maxWeightReps: isNewWeightPR ? reps : existing?.maxWeightReps,
            est1RM: Math.max(est1RM, existing?.est1RM || 0),
            bestSet: `${weight} × ${reps}`,
            updatedAt: new Date().toISOString()
        };

        const db = await openDB();
        await new Promise((resolve, reject) => {
            const tx = db.transaction('prs', 'readwrite');
            const store = tx.objectStore('prs');
            const req = store.put(updated);
            req.onsuccess = () => resolve(updated);
            req.onerror = () => reject(req.error);
        });

        return { isPR: true, isNewWeightPR, isNew1RMPR, est1RM, maxWeight: updated.maxWeight };
    }

    return { isPR: false, est1RM };
}

// --- SETTINGS ---
async function getSetting(key, defaultValue = null) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('settings', 'readonly');
        const store = tx.objectStore('settings');
        const req = store.get(key);
        req.onsuccess = () => {
            resolve(req.result ? req.result.value : defaultValue);
        };
        req.onerror = () => resolve(defaultValue);
    });
}

async function setSetting(key, value) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('settings', 'readwrite');
        const store = tx.objectStore('settings');
        const req = store.put({ key, value });
        req.onsuccess = () => resolve(value);
        req.onerror = () => reject(req.error);
    });
}

// Export functions to global scope
window.IronDB = {
    openDB,
    saveWorkout,
    getAllWorkouts,
    getWorkout,
    deleteWorkout,
    getUnsyncedWorkouts,
    markWorkoutSynced,
    getAllExercises,
    addCustomExercise,
    getLastPerformance,
    calculate1RM,
    getPR,
    getAllPRs,
    checkAndUpdatePR,
    getSetting,
    setSetting
};
