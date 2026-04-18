/**
 * decisionEngine.js — Multi-factor scoring engine for VenueFlow.
 *
 * Replaces simple "sort by wait time" with a weighted scoring model
 * that evaluates options across multiple dimensions:
 *   - Wait time
 *   - Crowd density / congestion
 *   - Distance from user's current zone
 *   - Trend direction (getting busier vs clearing out)
 *   - Predicted future state
 *
 * Every recommendation includes human-readable reasoning so the
 * attendee understands WHY an option was chosen.
 */

const DecisionEngine = (() => {
  'use strict';

  // --- Scoring Weights (tuned for attendee experience) ---
  const WEIGHTS = {
    waitTime:   0.40,  // Current wait is the strongest signal
    crowdLevel: 0.25,  // Crowd density around the facility
    distance:   0.20,  // How far the user has to walk
    trend:      0.15,  // Is it getting better or worse?
  };

  // User's current zone (updated via map interaction or assistant context)
  let userZone = 'north';

  // Historical snapshots for trend analysis (ring buffer, last 6 readings)
  const history = {};
  const MAX_HISTORY = 6;

  // Zone distances — approximate walk time in minutes between zones
  const ZONE_DISTANCES = {
    north: { north: 0, south: 5, east: 3, west: 3 },
    south: { north: 5, south: 0, east: 3, west: 3 },
    east:  { north: 3, south: 3, east: 0, west: 5 },
    west:  { north: 3, south: 3, east: 5, west: 0 },
  };

  // Facility-to-zone mapping
  const FACILITY_ZONES = {
    food_north:   'north',
    food_south:   'south',
    food_east:    'east',
    restroom_a:   'north',
    restroom_b:   'south',
    restroom_c:   'east',
    merch_main:   'west',
    entry_gate_1: 'north',
    entry_gate_2: 'south',
  };

  /**
   * Record a queue data snapshot for trend analysis.
   * Called every time Firebase pushes new data.
   * @param {Object} queues - Current queue data from Firebase.
   */
  function recordSnapshot(queues) {
    const timestamp = Date.now();
    Object.entries(queues).forEach(([id, q]) => {
      if (!history[id]) history[id] = [];
      history[id].push({ wait: q.wait, time: timestamp });
      if (history[id].length > MAX_HISTORY) {
        history[id].shift();
      }
    });
  }

  /**
   * Calculate the trend for a facility: is it getting busier or clearing out?
   * @param {string} facilityId - Facility identifier.
   * @returns {{ direction: 'increasing'|'decreasing'|'stable', rate: number, label: string }}
   */
  function getTrend(facilityId) {
    const snaps = history[facilityId];
    if (!snaps || snaps.length < 2) {
      return { direction: 'stable', rate: 0, label: 'Stable' };
    }

    // Linear regression slope over recent snapshots
    const n = snaps.length;
    const recent = snaps.slice(-Math.min(n, 4));
    const first = recent[0].wait;
    const last = recent[recent.length - 1].wait;
    const delta = last - first;
    const rate = delta / recent.length; // change per reading

    if (rate > 0.5) {
      return { direction: 'increasing', rate, label: '📈 Getting busier' };
    }
    if (rate < -0.5) {
      return { direction: 'decreasing', rate, label: '📉 Clearing out' };
    }
    return { direction: 'stable', rate, label: '➡️ Stable' };
  }

  /**
   * Predict the wait time N minutes from now based on trend.
   * @param {string} facilityId - Facility identifier.
   * @param {number} currentWait - Current wait in minutes.
   * @param {number} minutesAhead - How far to predict (default: 10).
   * @returns {{ predicted: number, confidence: 'high'|'medium'|'low', warning: string|null }}
   */
  function predictWait(facilityId, currentWait, minutesAhead = 10) {
    const trend = getTrend(facilityId);
    const snapCount = (history[facilityId] || []).length;

    // Each snapshot is ~5 seconds apart, predict based on rate
    const predictedChange = trend.rate * (minutesAhead / 0.5); // extrapolate
    const predicted = Math.max(0, currentWait + predictedChange);
    const confidence = snapCount >= 4 ? 'high' : snapCount >= 2 ? 'medium' : 'low';

    let warning = null;
    if (predicted > currentWait * 1.5 && predicted > 5) {
      warning = `⚠️ This area may become crowded in ~${minutesAhead} minutes`;
    }
    if (predicted < currentWait * 0.6 && currentWait > 5) {
      warning = `💡 Wait time likely to drop in ~${minutesAhead} minutes`;
    }

    return { predicted: Math.round(predicted * 10) / 10, confidence, warning };
  }

  /**
   * Score a single facility option on a 0-100 scale (higher = better).
   * @param {string} id - Facility ID.
   * @param {Object} queue - Queue data { name, wait, type }.
   * @param {Object} crowdData - Crowd density data for the facility's zone.
   * @returns {Object} Scored option with reasoning.
   */
  function scoreOption(id, queue, crowdData) {
    const zone = FACILITY_ZONES[id] || 'north';
    const distanceMinutes = (ZONE_DISTANCES[userZone] || {})[zone] || 3;
    const trend = getTrend(id);
    const prediction = predictWait(id, queue.wait, 10);

    // Normalize each factor to 0-1 (1 = best)
    const waitScore = Math.max(0, 1 - (queue.wait / 20));        // 0 min = 1.0, 20+ min = 0
    const crowdScore = crowdData ? (1 - crowdData.density) : 0.5; // Low density = high score
    const distScore = Math.max(0, 1 - (distanceMinutes / 8));     // Close = high score
    const trendScore = trend.direction === 'decreasing' ? 0.9 :
                       trend.direction === 'stable' ? 0.5 : 0.1;  // Clearing out = good

    // Weighted composite score (0-100)
    const composite = (
      waitScore   * WEIGHTS.waitTime +
      crowdScore  * WEIGHTS.crowdLevel +
      distScore   * WEIGHTS.distance +
      trendScore  * WEIGHTS.trend
    ) * 100;

    // Build human-readable reasoning
    const reasons = [];
    if (waitScore > 0.7)  reasons.push(`short wait (~${Math.round(queue.wait)} min)`);
    if (waitScore <= 0.3) reasons.push(`long wait (~${Math.round(queue.wait)} min)`);
    if (crowdScore > 0.6) reasons.push('low crowd density');
    if (crowdScore <= 0.3) reasons.push('high crowd area');
    if (distScore > 0.7)  reasons.push('close to you');
    if (distScore <= 0.3) reasons.push('far from your location');
    if (trend.direction === 'decreasing') reasons.push('queue is clearing');
    if (trend.direction === 'increasing') reasons.push('queue is growing');

    return {
      id,
      name: queue.name,
      type: queue.type,
      zone,
      score: Math.round(composite * 10) / 10,
      wait: queue.wait,
      waitFormatted: VenueUtils.formatWaitTime(queue.wait),
      level: VenueUtils.getQueueLevel(queue.wait),
      distance: distanceMinutes,
      trend: trend,
      prediction: prediction,
      reasons: reasons,
      reasoning: reasons.length > 0
        ? `Recommended due to ${reasons.join(' and ')}`
        : 'Average option',
      badge: null, // Set by rankOptions
    };
  }

  /**
   * Rank all options of a given type and assign badges.
   * This is the core decision-making function.
   *
   * @param {string} type - Facility type ('food', 'restroom', 'gate', 'merch').
   * @param {Object} queues - All current queue data.
   * @param {Object} crowdDensity - Current crowd density by zone.
   * @returns {Object[]} Ranked options with scores, badges, and reasoning.
   */
  function rankOptions(type, queues, crowdDensity) {
    const options = Object.entries(queues)
      .filter(([_, q]) => q.type === type)
      .map(([id, q]) => {
        const zone = FACILITY_ZONES[id] || 'north';
        const crowd = crowdDensity ? crowdDensity[`${zone}_concourse`] || crowdDensity[`${zone}_stands`] : null;
        return scoreOption(id, q, crowd);
      })
      .sort((a, b) => b.score - a.score);

    // Assign badges to top options
    if (options.length > 0) {
      options[0].badge = '⭐ Best Option';
    }

    // Find fastest (lowest raw wait, ignoring other factors)
    const fastest = [...options].sort((a, b) => a.wait - b.wait);
    if (fastest.length > 0 && fastest[0].id !== options[0]?.id) {
      fastest[0].badge = fastest[0].badge || '⚡ Fastest';
    }

    // Find lowest crowd option
    const leastCrowded = [...options].sort((a, b) => {
      const aCrowd = crowdDensity ? (crowdDensity[`${a.zone}_concourse`] || crowdDensity[`${a.zone}_stands`] || {}).density || 0.5 : 0.5;
      const bCrowd = crowdDensity ? (crowdDensity[`${b.zone}_concourse`] || crowdDensity[`${b.zone}_stands`] || {}).density || 0.5 : 0.5;
      return aCrowd - bCrowd;
    });
    if (leastCrowded.length > 0 && !leastCrowded[0].badge) {
      leastCrowded[0].badge = '🟢 Low Crowd';
    }

    return options;
  }

  /**
   * Get the single best recommendation with full context.
   * @param {string} type - Facility type.
   * @param {Object} queues - Queue data.
   * @param {Object} crowdDensity - Crowd data.
   * @returns {Object|null} Best option with reasoning.
   */
  function recommend(type, queues, crowdDensity) {
    const ranked = rankOptions(type, queues, crowdDensity);
    return ranked.length > 0 ? ranked[0] : null;
  }

  /**
   * Generate a comprehensive situation report for the AI assistant.
   * Includes current state, predictions, and proactive warnings.
   * @param {Object} queues - Queue data.
   * @param {Object} crowdDensity - Crowd density data.
   * @returns {string} Formatted situation report.
   */
  function generateSitReport(queues, crowdDensity) {
    const lines = [];
    lines.push('**📊 Live Venue Intelligence Report:**');
    lines.push(`🧭 Your location: ${userZone.charAt(0).toUpperCase() + userZone.slice(1)} zone\n`);

    // Ranked recommendations by type
    ['food', 'restroom', 'gate'].forEach(type => {
      const ranked = rankOptions(type, queues, crowdDensity);
      if (ranked.length === 0) return;

      const label = type === 'food' ? '🍔 Food' : type === 'restroom' ? '🚻 Restrooms' : '🚪 Gates';
      lines.push(`**${label}:**`);
      ranked.forEach((opt, i) => {
        const badge = opt.badge ? ` ${opt.badge}` : '';
        const trendIcon = opt.trend.direction === 'increasing' ? '📈' :
                          opt.trend.direction === 'decreasing' ? '📉' : '➡️';
        lines.push(`${i + 1}. ${opt.name}: ~${Math.round(opt.wait)} min ${trendIcon}${badge} (score: ${opt.score})`);
      });
      lines.push('');
    });

    // Predictions & warnings
    const warnings = [];
    Object.entries(queues).forEach(([id, q]) => {
      const pred = predictWait(id, q.wait, 10);
      if (pred.warning) {
        warnings.push(`${pred.warning} — ${q.name}`);
      }
    });

    if (warnings.length > 0) {
      lines.push('**⚠️ Predictions:**');
      warnings.forEach(w => lines.push(w));
    }

    return lines.join('\n');
  }

  /**
   * Set the user's current zone for distance calculations.
   * @param {string} zone - One of 'north', 'south', 'east', 'west'.
   */
  function setUserZone(zone) {
    if (ZONE_DISTANCES[zone]) {
      userZone = zone;
    }
  }

  /**
   * Get the user's current zone.
   * @returns {string}
   */
  function getUserZone() {
    return userZone;
  }

  return {
    recordSnapshot,
    getTrend,
    predictWait,
    scoreOption,
    rankOptions,
    recommend,
    generateSitReport,
    setUserZone,
    getUserZone,
    WEIGHTS,
    FACILITY_ZONES,
    ZONE_DISTANCES,
  };
})();
