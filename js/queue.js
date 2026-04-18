/**
 * queue.js — Real-time queue monitoring and recommendation engine.
 *
 * Subscribes to Firebase data and provides smart recommendations
 * for shortest queues, best timing, and crowd avoidance.
 */

const QueueManager = (() => {
  'use strict';

  let currentQueues = {};
  let currentAlerts = [];
  let updateCallbacks = [];

  /**
   * Initialize queue monitoring — subscribes to Firebase data.
   */
  function init() {
    FirebaseService.onData('queues', (data) => {
      currentQueues = data || {};
      renderQueueOverlay();
      notifyUpdate();
    });

    FirebaseService.onData('alerts', (data) => {
      currentAlerts = data || [];
      renderAlerts();
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
   * Get all active alerts.
   * @returns {Array} Active alert objects.
   */
  function getAlerts() {
    return [...currentAlerts];
  }

  /**
   * Find the best option for a given type (food, restroom, etc.).
   * @param {string} type - Queue type to filter by.
   * @returns {Object|null} Best queue option with name and wait time.
   */
  function findBest(type) {
    const filtered = Object.entries(currentQueues)
      .filter(([_, q]) => q.type === type)
      .sort((a, b) => a[1].wait - b[1].wait);

    if (filtered.length === 0) return null;

    const [id, queue] = filtered[0];
    return {
      id,
      name: queue.name,
      wait: queue.wait,
      level: VenueUtils.getQueueLevel(queue.wait),
      formatted: VenueUtils.formatWaitTime(queue.wait)
    };
  }

  /**
   * Get a summary of all queues for the AI assistant context.
   * @returns {string} Human-readable queue summary.
   */
  function getSummaryForAssistant() {
    const lines = Object.entries(currentQueues).map(([id, q]) => {
      const level = VenueUtils.getQueueLevel(q.wait);
      const emoji = level === 'low' ? '🟢' : level === 'med' ? '🟡' : '🔴';
      return `${emoji} ${q.name}: ~${Math.round(q.wait)} min wait (${q.type})`;
    });

    let summary = '**Current Queue Status:**\n' + lines.join('\n');

    if (currentAlerts.length > 0) {
      summary += '\n\n**Active Alerts:**\n' +
        currentAlerts.map(a => `⚠ ${a.message}`).join('\n');
    }

    return summary;
  }

  /**
   * Render queue items into the overlay panel.
   */
  function renderQueueOverlay() {
    const container = document.getElementById('queue-list');
    if (!container) return;

    container.innerHTML = Object.entries(currentQueues)
      .sort((a, b) => a[1].wait - b[1].wait)
      .slice(0, 6) // Show top 6
      .map(([id, q]) => {
        const level = VenueUtils.getQueueLevel(q.wait);
        const levelLabel = level === 'low' ? 'Short' : level === 'med' ? 'Medium' : 'Long';
        return `
          <div class="queue-item" data-queue-id="${id}">
            <span class="queue-item__name">${VenueUtils.sanitize(q.name)}</span>
            <span class="queue-item__badge queue-item__badge--${level}" title="${VenueUtils.formatWaitTime(q.wait)} wait">
              ${levelLabel}
            </span>
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

  return { init, onUpdate, getQueues, getAlerts, findBest, getSummaryForAssistant };
})();
