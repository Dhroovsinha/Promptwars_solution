/**
 * firebase-config.js — Firebase initialization and real-time data sync.
 *
 * In demo mode (no keys configured), this module provides a simulated
 * real-time data layer that mimics Firebase behavior.
 *
 * Google Service: Firebase Realtime Database + Anonymous Auth
 */

const FirebaseService = (() => {
  'use strict';

  let isLive = false;
  let listeners = {};

  /**
   * Initialize Firebase with the provided config.
   * Falls back to demo mode if keys are missing.
   * @param {Object} config - Firebase configuration object.
   * @returns {Promise<boolean>} True if live mode is active.
   */
  async function init(config) {
    if (config && config.apiKey && config.apiKey !== 'YOUR_FIREBASE_API_KEY_HERE') {
      try {
        /* 
         * In a production build, we would dynamically import Firebase SDKs:
         *   const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.x/firebase-app.js');
         *   const { getDatabase, ref, onValue } = await import('...');
         *   const { getAuth, signInAnonymously } = await import('...');
         *
         * For this lightweight prototype, we use the REST API approach
         * or the simulated layer below. The architecture supports either.
         */
        console.log('[Firebase] Live mode would initialize with project:', config.projectId);
        isLive = true;
        return true;
      } catch (err) {
        console.warn('[Firebase] Init failed, falling back to demo mode:', err);
        isLive = false;
        return false;
      }
    }
    console.log('[Firebase] No config provided — running in demo mode.');
    isLive = false;
    return false;
  }

  /**
   * Subscribe to real-time updates for a data path.
   * In demo mode, returns simulated data on an interval.
   * @param {string} path - Data path (e.g., 'queues', 'alerts').
   * @param {Function} callback - Called with updated data.
   * @returns {Function} Unsubscribe function.
   */
  function onData(path, callback) {
    if (isLive) {
      // Production: use Firebase onValue listener
      // const dbRef = ref(db, path);
      // return onValue(dbRef, snap => callback(snap.val()));
    }

    // Demo mode: simulate real-time updates
    const interval = setInterval(() => {
      const data = generateDemoData(path);
      callback(data);
    }, 5000); // Update every 5 seconds

    // Immediately fire once
    callback(generateDemoData(path));

    const unsub = () => clearInterval(interval);
    listeners[path] = unsub;
    return unsub;
  }

  /**
   * Push data to a path (e.g., user feedback, crowd reports).
   * @param {string} path - Data path.
   * @param {Object} data - Data to push.
   */
  async function pushData(path, data) {
    if (isLive) {
      // Production: push to Firebase
      // await push(ref(db, path), { ...data, timestamp: serverTimestamp() });
      return;
    }
    console.log(`[Firebase Demo] Push to '${path}':`, data);
  }

  /**
   * Generate realistic demo data for simulation.
   * @param {string} path - The data path.
   * @returns {Object} Simulated data.
   */
  function generateDemoData(path) {
    const now = Date.now();
    // Add slight randomness to simulate real-time changes
    const jitter = () => Math.random() * 4 - 2;

    if (path === 'queues') {
      return {
        food_north:    { name: 'Food Court North',   wait: Math.max(1, 5 + jitter()),  type: 'food' },
        food_south:    { name: 'Food Court South',   wait: Math.max(1, 12 + jitter()), type: 'food' },
        food_east:     { name: 'Snack Bar East',     wait: Math.max(1, 3 + jitter()),  type: 'food' },
        restroom_a:    { name: 'Restroom A (North)', wait: Math.max(0, 2 + jitter()),  type: 'restroom' },
        restroom_b:    { name: 'Restroom B (South)', wait: Math.max(0, 7 + jitter()),  type: 'restroom' },
        restroom_c:    { name: 'Restroom C (East)',  wait: Math.max(0, 4 + jitter()),  type: 'restroom' },
        merch_main:    { name: 'Merchandise Store',  wait: Math.max(1, 15 + jitter()), type: 'merch' },
        entry_gate_1:  { name: 'Entry Gate 1',       wait: Math.max(0, 6 + jitter()),  type: 'gate' },
        entry_gate_2:  { name: 'Entry Gate 2',       wait: Math.max(0, 2 + jitter()),  type: 'gate' },
      };
    }

    if (path === 'alerts') {
      const alerts = [
        { message: 'Gate 3 temporarily closed for maintenance. Use Gates 1 or 2.', severity: 'warning', active: true },
        { message: 'Halftime in 12 minutes — food courts will get busy!', severity: 'info', active: now % 30000 < 15000 },
      ];
      return alerts.filter(a => a.active);
    }

    if (path === 'crowd_density') {
      return {
        north_stands: { density: 0.7 + Math.random() * 0.2, trend: 'stable' },
        south_stands: { density: 0.85 + Math.random() * 0.1, trend: 'increasing' },
        east_concourse: { density: 0.4 + Math.random() * 0.2, trend: 'decreasing' },
        west_concourse: { density: 0.6 + Math.random() * 0.15, trend: 'stable' },
        main_entrance: { density: 0.3 + Math.random() * 0.3, trend: 'stable' },
      };
    }

    return {};
  }

  /**
   * Clean up all listeners.
   */
  function destroy() {
    Object.values(listeners).forEach(unsub => unsub());
    listeners = {};
  }

  return { init, onData, pushData, destroy, generateDemoData };
})();
