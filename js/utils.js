/**
 * utils.js — Shared utility functions for VenueFlow.
 * Pure functions with no side effects for testability.
 */

const VenueUtils = (() => {
  'use strict';

  /**
   * Sanitize user input to prevent XSS.
   * @param {string} str - Raw user input.
   * @returns {string} Sanitized string safe for innerHTML.
   */
  function sanitize(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Format a wait time in minutes to a human-readable string.
   * @param {number} minutes - Wait time in minutes.
   * @returns {string} Formatted string like "~5 min" or "< 1 min".
   */
  function formatWaitTime(minutes) {
    if (minutes < 1) return '< 1 min';
    if (minutes < 60) return `~${Math.round(minutes)} min`;
    const hrs = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `~${hrs}h ${mins}m`;
  }

  /**
   * Classify queue congestion level.
   * @param {number} waitMinutes - Estimated wait in minutes.
   * @returns {'low'|'med'|'high'} Congestion level.
   */
  function getQueueLevel(waitMinutes) {
    if (waitMinutes <= 3) return 'low';
    if (waitMinutes <= 8) return 'med';
    return 'high';
  }

  /**
   * Generate a unique ID.
   * @returns {string} A short unique identifier.
   */
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /**
   * Debounce a function.
   * @param {Function} fn - Function to debounce.
   * @param {number} ms - Delay in milliseconds.
   * @returns {Function} Debounced function.
   */
  function debounce(fn, ms = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  }

  /**
   * Store and retrieve values from localStorage safely.
   */
  const storage = {
    get(key, fallback = null) {
      try {
        const val = localStorage.getItem(`venueflow_${key}`);
        return val ? JSON.parse(val) : fallback;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(`venueflow_${key}`, JSON.stringify(value));
      } catch {
        /* storage full — gracefully ignore */
      }
    },
    remove(key) {
      localStorage.removeItem(`venueflow_${key}`);
    }
  };

  /**
   * Get current timestamp in HH:MM format.
   * @returns {string}
   */
  function timeNow() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  /**
   * Simple markdown-like formatting for assistant messages.
   * Converts **bold**, *italic*, and \n to <br>.
   * @param {string} text - Raw text.
   * @returns {string} HTML-formatted text.
   */
  function formatMessage(text) {
    let safe = sanitize(text);
    safe = safe.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    safe = safe.replace(/\*(.+?)\*/g, '<em>$1</em>');
    safe = safe.replace(/\n/g, '<br>');
    return safe;
  }

  return {
    sanitize,
    formatWaitTime,
    getQueueLevel,
    uid,
    debounce,
    storage,
    timeNow,
    formatMessage
  };
})();
