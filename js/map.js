/**
 * map.js — Google Maps integration for venue visualization.
 *
 * Google Service: Google Maps JavaScript API
 *
 * In demo mode (no API key), renders an interactive SVG venue map
 * with markers for key locations (gates, food, restrooms, seats).
 */

const VenueMap = (() => {
  'use strict';

  let map = null;
  let markers = [];

  // Venue layout coordinates (simulated stadium)
  const VENUE_CENTER = { lat: 28.6129, lng: 77.2295 }; // Example: New Delhi
  const VENUE_LOCATIONS = {
    gate_1:      { lat: 28.6140, lng: 77.2280, label: '🚪 Gate 1',           type: 'gate' },
    gate_2:      { lat: 28.6118, lng: 77.2310, label: '🚪 Gate 2',           type: 'gate' },
    food_north:  { lat: 28.6138, lng: 77.2298, label: '🍔 Food Court North', type: 'food' },
    food_south:  { lat: 28.6120, lng: 77.2292, label: '🍔 Food Court South', type: 'food' },
    food_east:   { lat: 28.6130, lng: 77.2312, label: '🍿 Snack Bar East',   type: 'food' },
    restroom_a:  { lat: 28.6136, lng: 77.2286, label: '🚻 Restroom A',       type: 'restroom' },
    restroom_b:  { lat: 28.6122, lng: 77.2300, label: '🚻 Restroom B',       type: 'restroom' },
    restroom_c:  { lat: 28.6132, lng: 77.2314, label: '🚻 Restroom C',       type: 'restroom' },
    merch:       { lat: 28.6126, lng: 77.2278, label: '🛍 Merchandise',       type: 'merch' },
    section_a:   { lat: 28.6133, lng: 77.2295, label: '💺 Section A',        type: 'seat' },
    section_b:   { lat: 28.6127, lng: 77.2295, label: '💺 Section B',        type: 'seat' },
    medical:     { lat: 28.6125, lng: 77.2282, label: '🏥 First Aid',        type: 'medical' },
  };

  /**
   * Initialize the map.
   * @param {string|null} apiKey - Google Maps API key.
   */
  async function init(apiKey) {
    const container = document.getElementById('venue-map');
    if (!container) return;

    if (apiKey && apiKey !== 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
      try {
        await loadGoogleMaps(apiKey);
        initGoogleMap(container);
        return;
      } catch (err) {
        console.warn('[Map] Google Maps failed, using SVG fallback:', err);
      }
    }

    // Fallback: interactive SVG venue map
    renderSVGMap(container);
  }

  /**
   * Load Google Maps script dynamically.
   * @param {string} key - API key.
   */
  function loadGoogleMaps(key) {
    return new Promise((resolve, reject) => {
      if (window.google && window.google.maps) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  /**
   * Initialize a real Google Map with venue markers.
   * @param {HTMLElement} container - Map container element.
   */
  function initGoogleMap(container) {
    map = new google.maps.Map(container, {
      center: VENUE_CENTER,
      zoom: 17,
      mapTypeId: 'satellite',
      disableDefaultUI: true,
      zoomControl: true,
      styles: [
        { featureType: 'all', stylers: [{ saturation: -20 }] },
        { featureType: 'poi', stylers: [{ visibility: 'off' }] },
      ]
    });

    // Add markers for venue locations
    Object.entries(VENUE_LOCATIONS).forEach(([id, loc]) => {
      const marker = new google.maps.Marker({
        position: { lat: loc.lat, lng: loc.lng },
        map: map,
        title: loc.label,
        label: { text: loc.label.split(' ')[0], fontSize: '16px' },
      });

      const infoWindow = new google.maps.InfoWindow({
        content: `<div style="color:#333;font-family:Inter,sans-serif;padding:4px;">
          <strong>${loc.label}</strong><br>
          <span>Type: ${loc.type}</span>
        </div>`
      });

      marker.addListener('click', () => infoWindow.open(map, marker));
      markers.push(marker);
    });
  }

  /**
   * Render an interactive SVG venue map as fallback.
   * @param {HTMLElement} container - Map container element.
   */
  function renderSVGMap(container) {
    container.innerHTML = `
      <svg viewBox="0 0 600 500" xmlns="http://www.w3.org/2000/svg"
           style="width:100%;height:100%;background:#131a2e;"
           role="img" aria-label="Venue map showing stadium layout">
        <defs>
          <radialGradient id="field-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#1b5e20" />
            <stop offset="100%" stop-color="#0d3010" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        <!-- Stadium outline -->
        <ellipse cx="300" cy="250" rx="260" ry="200" fill="none" stroke="#2a3a5c" stroke-width="3" />
        <ellipse cx="300" cy="250" rx="230" ry="175" fill="none" stroke="#1a2a4c" stroke-width="1.5" stroke-dasharray="8 4" />

        <!-- Playing field -->
        <ellipse cx="300" cy="250" rx="140" ry="100" fill="url(#field-grad)" stroke="#2e7d32" stroke-width="2" />
        <line x1="300" y1="150" x2="300" y2="350" stroke="#388e3c" stroke-width="1" opacity="0.5" />
        <ellipse cx="300" cy="250" rx="30" ry="22" fill="none" stroke="#388e3c" stroke-width="1" opacity="0.5" />

        <!-- Section Labels -->
        <text x="300" y="80" text-anchor="middle" fill="#8892a8" font-size="12" font-family="Inter,sans-serif">NORTH STAND</text>
        <text x="300" y="440" text-anchor="middle" fill="#8892a8" font-size="12" font-family="Inter,sans-serif">SOUTH STAND</text>
        <text x="60" y="255" text-anchor="middle" fill="#8892a8" font-size="12" font-family="Inter,sans-serif" transform="rotate(-90,60,255)">WEST</text>
        <text x="540" y="255" text-anchor="middle" fill="#8892a8" font-size="12" font-family="Inter,sans-serif" transform="rotate(90,540,255)">EAST</text>

        <!-- Gates -->
        ${mapIcon(120, 95,  '🚪', 'Gate 1', 'gate_1')}
        ${mapIcon(480, 405, '🚪', 'Gate 2', 'gate_2')}

        <!-- Food -->
        ${mapIcon(210, 85,  '🍔', 'Food North', 'food_north')}
        ${mapIcon(200, 400, '🍔', 'Food South', 'food_south')}
        ${mapIcon(500, 250, '🍿', 'Snack East', 'food_east')}

        <!-- Restrooms -->
        ${mapIcon(100, 180, '🚻', 'Restroom A', 'restroom_a')}
        ${mapIcon(350, 420, '🚻', 'Restroom B', 'restroom_b')}
        ${mapIcon(520, 180, '🚻', 'Restroom C', 'restroom_c')}

        <!-- Seats -->
        ${mapIcon(300, 145, '💺', 'Section A', 'section_a')}
        ${mapIcon(300, 355, '💺', 'Section B', 'section_b')}

        <!-- Merch & Medical -->
        ${mapIcon(80, 340,  '🛍', 'Merch', 'merch')}
        ${mapIcon(140, 400, '🏥', 'First Aid', 'medical')}

        <!-- Legend -->
        <rect x="15" y="455" width="180" height="35" rx="6" fill="rgba(19,26,46,0.9)" stroke="#2a3a5c" stroke-width="1" />
        <text x="25" y="477" fill="#8892a8" font-size="10" font-family="Inter,sans-serif">🟢 Short  🟡 Medium  🔴 Long wait</text>
      </svg>`;

    // Wire up click handlers on markers
    container.querySelectorAll('[data-loc-id]').forEach(el => {
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-loc-id');
        highlightLocation(id);
      });
    });
  }

  /**
   * Generate SVG for a map icon/marker.
   */
  function mapIcon(x, y, emoji, label, id) {
    return `
      <g data-loc-id="${id}" filter="url(#glow)">
        <circle cx="${x}" cy="${y}" r="16" fill="rgba(19,26,46,0.85)" stroke="#4285f4" stroke-width="1.5" />
        <text x="${x}" y="${y + 5}" text-anchor="middle" font-size="14">${emoji}</text>
        <text x="${x}" y="${y + 30}" text-anchor="middle" fill="#ccc" font-size="9" font-family="Inter,sans-serif">${label}</text>
      </g>`;
  }

  /**
   * Highlight a location on the map (visual feedback).
   * @param {string} locationId - The location identifier.
   */
  function highlightLocation(locationId) {
    const el = document.querySelector(`[data-loc-id="${locationId}"] circle`);
    if (!el) return;

    el.setAttribute('stroke', '#34a853');
    el.setAttribute('stroke-width', '3');
    setTimeout(() => {
      el.setAttribute('stroke', '#4285f4');
      el.setAttribute('stroke-width', '1.5');
    }, 2000);
  }

  /**
   * Update marker colors based on queue data.
   * @param {Object} queues - Current queue data from QueueManager.
   */
  function updateMarkerColors(queues) {
    Object.entries(queues).forEach(([id, q]) => {
      const circle = document.querySelector(`[data-loc-id="${id}"] circle`);
      if (!circle) return;

      const level = VenueUtils.getQueueLevel(q.wait);
      const colors = { low: '#34a853', med: '#fbbc04', high: '#ea4335' };
      circle.setAttribute('stroke', colors[level] || '#4285f4');
    });
  }

  return { init, highlightLocation, updateMarkerColors, VENUE_LOCATIONS };
})();
