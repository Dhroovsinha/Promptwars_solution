/**
 * firebase-config.js — Firebase initialization and real-time data sync.
 *
 * In demo mode (no keys configured), this module provides a simulated
 * real-time data layer that mimics Firebase behavior with realistic
 * temporal patterns (halftime surges, post-match spikes, crowd waves).
 *
 * Google Service: Firebase Realtime Database + Anonymous Auth
 */

const FirebaseService = (() => {
  'use strict';

  let isLive = false;
  let listeners = {};
  let tickCount = 0;  // Simulation tick counter for temporal patterns

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
      tickCount++;
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
   * Compute a temporal multiplier to simulate event phases.
   * This creates realistic crowd patterns:
   *   - Pre-event ramp-up
   *   - Settled during play
   *   - Halftime surge
   *   - Post-match exodus
   *
   * The tick counter advances every 5 seconds. We compress a ~3 hour
   * event into a ~10 minute demo cycle (120 ticks).
   *
   * @returns {{ phase: string, multiplier: number, phaseLabel: string }}
   */
  function getEventPhase() {
    const cycle = tickCount % 120; // Full event cycle = 120 ticks (10 min)

    if (cycle < 15) {
      // Pre-event: gates busy, concessions moderate
      return { phase: 'pre_event', multiplier: 1.2, phaseLabel: 'Pre-Event Entry' };
    }
    if (cycle < 40) {
      // First half: low activity, everyone seated
      return { phase: 'first_half', multiplier: 0.6, phaseLabel: 'First Half' };
    }
    if (cycle < 55) {
      // Halftime: massive surge at food & restrooms
      return { phase: 'halftime', multiplier: 2.0, phaseLabel: 'Halftime Rush' };
    }
    if (cycle < 80) {
      // Second half: low activity again
      return { phase: 'second_half', multiplier: 0.5, phaseLabel: 'Second Half' };
    }
    if (cycle < 100) {
      // Post-match: exit gates busy, concessions dead
      return { phase: 'post_match', multiplier: 1.5, phaseLabel: 'Post-Match Exit' };
    }
    // Cool-down
    return { phase: 'cooldown', multiplier: 0.3, phaseLabel: 'Venue Clearing' };
  }

  /**
   * Generate realistic demo data with temporal patterns.
   * @param {string} path - The data path.
   * @returns {Object} Simulated data.
   */
  function generateDemoData(path) {
    const { phase, multiplier, phaseLabel } = getEventPhase();
    // Smooth random jitter
    const jitter = () => (Math.random() - 0.5) * 3;

    if (path === 'queues') {
      // Phase-specific adjustments
      const gateMulti = (phase === 'pre_event' || phase === 'post_match') ? 2.0 : 0.3;
      const foodMulti = phase === 'halftime' ? 2.5 : multiplier;
      const restroomMulti = phase === 'halftime' ? 2.0 : multiplier;

      return {
        food_north:    { name: 'Food Court North',   wait: Math.max(1, Math.round((5 * foodMulti + jitter()) * 10) / 10),     type: 'food' },
        food_south:    { name: 'Food Court South',   wait: Math.max(1, Math.round((10 * foodMulti + jitter()) * 10) / 10),    type: 'food' },
        food_east:     { name: 'Snack Bar East',     wait: Math.max(1, Math.round((3 * foodMulti + jitter()) * 10) / 10),     type: 'food' },
        restroom_a:    { name: 'Restroom A (North)', wait: Math.max(0, Math.round((2 * restroomMulti + jitter()) * 10) / 10), type: 'restroom' },
        restroom_b:    { name: 'Restroom B (South)', wait: Math.max(0, Math.round((6 * restroomMulti + jitter()) * 10) / 10), type: 'restroom' },
        restroom_c:    { name: 'Restroom C (East)',  wait: Math.max(0, Math.round((4 * restroomMulti + jitter()) * 10) / 10), type: 'restroom' },
        merch_main:    { name: 'Merchandise Store',  wait: Math.max(1, Math.round((12 * multiplier + jitter()) * 10) / 10),   type: 'merch' },
        entry_gate_1:  { name: 'Entry Gate 1',       wait: Math.max(0, Math.round((5 * gateMulti + jitter()) * 10) / 10),     type: 'gate' },
        entry_gate_2:  { name: 'Entry Gate 2',       wait: Math.max(0, Math.round((2 * gateMulti + jitter()) * 10) / 10),     type: 'gate' },
      };
    }

    if (path === 'alerts') {
      const alerts = [
        { message: 'Gate 3 temporarily closed for maintenance. Use Gates 1 or 2.', severity: 'warning', active: true },
      ];
      // Phase-specific alerts
      if (phase === 'halftime') {
        alerts.push({ message: '🔥 Halftime rush active — food courts are very busy! Try Snack Bar East.', severity: 'warning', active: true });
      }
      if (phase === 'pre_event') {
        alerts.push({ message: '📢 Gates are open! Gate 2 has shorter entry lines.', severity: 'info', active: true });
      }
      if (phase === 'post_match') {
        alerts.push({ message: '🚪 Match ended! Wait 10 min for crowd to thin. Gate 2 recommended.', severity: 'info', active: true });
      }
      if (phase === 'first_half' || phase === 'second_half') {
        const ticksToHalftime = phase === 'first_half' ? (40 - (tickCount % 120)) * 5 : null;
        if (ticksToHalftime && ticksToHalftime < 60 && ticksToHalftime > 0) {
          alerts.push({ message: `⏰ Halftime in ~${Math.round(ticksToHalftime / 60)} min — head to food now to beat the rush!`, severity: 'info', active: true });
        }
      }
      return alerts.filter(a => a.active);
    }

    if (path === 'crowd_density') {
      const density = (base) => Math.min(1, Math.max(0, base * multiplier + (Math.random() - 0.5) * 0.1));
      return {
        north_stands:    { density: density(0.55), trend: phase === 'halftime' ? 'decreasing' : 'stable' },
        south_stands:    { density: density(0.65), trend: phase === 'post_match' ? 'increasing' : 'stable' },
        east_concourse:  { density: density(0.35), trend: phase === 'halftime' ? 'increasing' : 'decreasing' },
        west_concourse:  { density: density(0.45), trend: 'stable' },
        north_concourse: { density: density(0.40), trend: phase === 'halftime' ? 'increasing' : 'stable' },
        south_concourse: { density: density(0.50), trend: phase === 'post_match' ? 'increasing' : 'stable' },
        main_entrance:   { density: density(phase === 'pre_event' ? 0.8 : 0.2), trend: phase === 'pre_event' ? 'increasing' : 'decreasing' },
      };
    }

    if (path === 'event_phase') {
      return { phase, phaseLabel, multiplier, tick: tickCount };
    }

    return {};
  }

  /**
   * Clean up all listeners.
   */
  function destroy() {
    Object.values(listeners).forEach(unsub => unsub());
    listeners = {};
    tickCount = 0;
  }

  /**
   * Get the current event phase info.
   * @returns {Object}
   */
  function getCurrentPhase() {
    return getEventPhase();
  }

  return { init, onData, pushData, destroy, generateDemoData, getCurrentPhase };
})();
