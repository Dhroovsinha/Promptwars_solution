/**
 * queue.js — Real-time queue monitoring and recommendation engine.
 *
 * Subscribes to Firebase data, feeds snapshots into the DecisionEngine,
 * and renders an upgraded overlay with badges, trends, and predictions.
 */

const QueueManager = (() => {
  'use strict';

  let currentQueues = {};
  let currentAlerts = [];
  let currentCrowdDensity = {};
  let currentPhase = { phase: 'unknown', phaseLabel: 'Loading...' };
  let updateCallbacks = [];

  /**
   * Initialize queue monitoring — subscribes to Firebase data.
   */
  function init() {
    FirebaseService.onData('queues', (data) => {
      currentQueues = data || {};
      DecisionEngine.recordSnapshot(currentQueues);
      renderQueueOverlay();
      notifyUpdate();
    });

    FirebaseService.onData('alerts', (data) => {
      currentAlerts = data || [];
      renderAlerts();
    });

    // NEW: subscribe to crowd density for decision engine
    FirebaseService.onData('crowd_density', (data) => {
      currentCrowdDensity = data || {};
    });

    // NEW: subscribe to event phase for contextual UI
    FirebaseService.onData('event_phase', (data) => {
      if (data) currentPhase = data;
      renderPhaseIndicator();
    });
  }

  /**
   * Register a callback for queue data updates.
   * @param {Function} cb - Callback receiving current queue state.
   */
  function onUpdate(cb) {
    updateCallbacks.push(cb);
  }

  function notifyUpdate() {
    updateCallbacks.forEach(cb => cb(currentQueues));
  }

  /**
   * Get the current queue data.
   * @returns {Object} Current queue states.
   */
  function getQueues() {
    return { ...currentQueues };
  }

  /**
   * Get current crowd density data.
   * @returns {Object}
   */
  function getCrowdDensity() {
    return { ...currentCrowdDensity };
  }

  /**
   * Get the current event phase.
   * @returns {Object}
   */
  function getPhase() {
    return { ...currentPhase };
  }

  /**
   * Get all active alerts.
   * @returns {Array} Active alert objects.
   */
  function getAlerts() {
    return [...currentAlerts];
  }

  /**
   * Find the best option using the Decision Engine (multi-factor scoring).
   * @param {string} type - Queue type to filter by.
   * @returns {Object|null} Best option with score, reasoning, and badge.
   */
  function findBest(type) {
    const best = DecisionEngine.recommend(type, currentQueues, currentCrowdDensity);
    if (!best) return null;
    return best;
  }

  /**
   * Get ranked options for a type using the Decision Engine.
   * @param {string} type - Facility type.
   * @returns {Object[]} Ranked and scored options.
   */
  function getRanked(type) {
    return DecisionEngine.rankOptions(type, currentQueues, currentCrowdDensity);
  }

  /**
   * Get a comprehensive summary for the AI assistant, powered by the Decision Engine.
   * @returns {string} Human-readable intelligence report.
   */
  function getSummaryForAssistant() {
    let summary = DecisionEngine.generateSitReport(currentQueues, currentCrowdDensity);

    // Add event phase context
    const phase = FirebaseService.getCurrentPhase();
    summary += `\n\n**Event Phase:** ${phase.phaseLabel}`;

    if (currentAlerts.length > 0) {
      summary += '\n\n**Active Alerts:**\n' +
        currentAlerts.map(a => `⚠ ${a.message}`).join('\n');
    }

    return summary;
  }

  /**
   * Render the upgraded queue overlay with badges, trends, and wait times.
   */
  function renderQueueOverlay() {
    const container = document.getElementById('queue-list');
    if (!container) return;

    // Get ranked options across all types for display
    const allRanked = [];
    ['food', 'restroom', 'gate', 'merch'].forEach(type => {
      const ranked = DecisionEngine.rankOptions(type, currentQueues, currentCrowdDensity);
      allRanked.push(...ranked);
    });

    // Sort by score (best first) and show top 7
    allRanked.sort((a, b) => b.score - a.score);

    container.innerHTML = allRanked.slice(0, 7).map(opt => {
      const trendIcon = opt.trend.direction === 'increasing' ? '📈' :
                        opt.trend.direction === 'decreasing' ? '📉' : '';
      const badgeHtml = opt.badge
        ? `<span class="queue-item__tag">${opt.badge}</span>`
        : '';
      const predWarn = opt.prediction.warning
        ? `<div class="queue-item__prediction">${opt.prediction.warning}</div>`
        : '';

      return `
        <div class="queue-item ${opt.badge ? 'queue-item--highlighted' : ''}" data-queue-id="${opt.id}" title="Score: ${opt.score}/100 — ${opt.reasoning}">
          <div class="queue-item__left">
            <span class="queue-item__name">${VenueUtils.sanitize(opt.name)}</span>
            ${badgeHtml}
            ${predWarn}
          </div>
          <div class="queue-item__right">
            <span class="queue-item__wait">${trendIcon} ${VenueUtils.formatWaitTime(opt.wait)}</span>
            <span class="queue-item__badge queue-item__badge--${opt.level}">
              ${opt.level === 'low' ? 'Short' : opt.level === 'med' ? 'Medium' : 'Long'}
            </span>
          </div>
        </div>`;
    }).join('');
  }

  /**
   * Render active alerts in the alerts bar.
   */
  function renderAlerts() {
    const bar = document.getElementById('alerts-bar');
    const text = document.getElementById('alert-text');
    if (!bar || !text) return;

    if (currentAlerts.length > 0) {
      text.textContent = currentAlerts[0].message;
      bar.classList.remove('hidden');
    } else {
      bar.classList.add('hidden');
    }
  }

  /**
   * Render the event phase indicator in the queue overlay.
   */
  function renderPhaseIndicator() {
    const overlay = document.getElementById('queue-overlay');
    if (!overlay) return;

    let phaseEl = document.getElementById('phase-indicator');
    if (!phaseEl) {
      phaseEl = document.createElement('div');
      phaseEl.id = 'phase-indicator';
      phaseEl.className = 'phase-indicator';
      // Insert after the title
      const title = overlay.querySelector('.queue-overlay__title');
      if (title) title.after(phaseEl);
    }

    const phase = FirebaseService.getCurrentPhase();
    const phaseColors = {
      pre_event: '#fbbc04',
      first_half: '#34a853',
      halftime: '#ea4335',
      second_half: '#34a853',
      post_match: '#fbbc04',
      cooldown: '#4285f4',
    };
    const color = phaseColors[phase.phase] || '#8892a8';
    phaseEl.innerHTML = `<span class="phase-dot" style="background:${color}"></span> ${phase.phaseLabel}`;
  }

  return {
    init, onUpdate, getQueues, getCrowdDensity, getPhase,
    getAlerts, findBest, getRanked, getSummaryForAssistant
  };
})();
