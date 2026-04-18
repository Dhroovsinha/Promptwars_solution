/**
 * assistant.js — AI Assistant powered by Google Gemini + Decision Engine.
 *
 * Google Service: Gemini API (generative AI)
 *
 * The assistant uses the DecisionEngine's scored recommendations, trend
 * analysis, and predictive insights to provide intelligent, actionable,
 * and REASONED guidance to attendees. Every response explains WHY.
 */

const Assistant = (() => {
  'use strict';

  let apiKey = null;
  let conversationHistory = [];
  const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

  /**
   * System prompt with full venue context and Decision Engine data.
   */
  function buildSystemPrompt() {
    const sitReport = QueueManager.getSummaryForAssistant();
    const time = VenueUtils.timeNow();
    const userZone = DecisionEngine.getUserZone();

    return `You are **VenueFlow Assistant**, an AI concierge for a live sporting event at National Stadium.
Your role is to help attendees have the best possible experience by providing real-time, actionable guidance.

**Your capabilities:**
1. **Queue Guidance** — You have scored rankings for all food courts, restrooms, merchandise, and gates. Each option has a composite score (0-100) based on wait time, crowd density, distance from the user, and trend direction. Always recommend the highest-scored option and explain why.
2. **Navigation** — You can give directions between any two points in the stadium (gates, sections, facilities).
3. **Crowd Management** — You know crowd density in different areas and can suggest less crowded routes.
4. **Predictive Intelligence** — You can predict future congestion and warn attendees proactively.
5. **Event Timing** — You know the event schedule and current phase.
6. **Safety & Accessibility** — You can direct attendees to first aid, accessible entrances, and emergency exits.

**Current Live Intelligence (updated every 5 seconds):**
${sitReport}

**User's Current Zone:** ${userZone}
**Current Time:** ${time}

**Stadium Layout:**
- North Stand: Gate 1, Food Court North, Restroom A, Section A
- South Stand: Gate 2, Food Court South, Restroom B, Section B
- East Side: Snack Bar East, Restroom C
- West Side: Merchandise Store, First Aid

**Behavioral Rules:**
- Be concise, friendly, and action-oriented. Use 2-4 sentences max.
- Always include specific wait times AND reasoning when recommending.
- Format reasoning like: "Recommended because [reasons]."
- Use emoji for clarity (🟢 🟡 🔴 for status, 📈📉 for trends, ⭐ for best option).
- If a queue is growing (📈), warn the user to go now or suggest an alternative.
- If a queue is clearing (📉), suggest waiting a few minutes.
- Proactively share predictions and warnings when relevant.
- Never make up data — use only the live intelligence provided above.`;
  }

  /**
   * Initialize the assistant.
   * @param {string|null} key - Gemini API key.
   */
  function init(key) {
    apiKey = key && key !== 'YOUR_GEMINI_API_KEY_HERE' ? key : null;
    conversationHistory = [];
  }

  /**
   * Send a message and get a response.
   * @param {string} userMessage - The attendee's question.
   * @returns {Promise<string>} The assistant's response text.
   */
  async function chat(userMessage) {
    conversationHistory.push({ role: 'user', text: userMessage });

    // Detect and set user zone from message context
    detectUserZone(userMessage);

    let response;
    if (apiKey) {
      response = await callGemini(userMessage);
    } else {
      response = generateLocalResponse(userMessage);
    }

    conversationHistory.push({ role: 'assistant', text: response });
    return response;
  }

  /**
   * Detect user's zone from conversation context.
   * @param {string} msg - User message.
   */
  function detectUserZone(msg) {
    const lower = msg.toLowerCase();
    if (lower.includes('north') || lower.includes('section a') || lower.includes('gate 1')) {
      DecisionEngine.setUserZone('north');
    } else if (lower.includes('south') || lower.includes('section b') || lower.includes('gate 2')) {
      DecisionEngine.setUserZone('south');
    } else if (lower.includes('east')) {
      DecisionEngine.setUserZone('east');
    } else if (lower.includes('west') || lower.includes('merch')) {
      DecisionEngine.setUserZone('west');
    }
  }

  /**
   * Call Google Gemini API for an intelligent response.
   */
  async function callGemini(userMessage) {
    const systemPrompt = buildSystemPrompt();
    const contents = [];
    conversationHistory.forEach(msg => {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.text }]
      });
    });

    try {
      const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 400,
            topP: 0.9,
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          ]
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('[Gemini] API error:', res.status, err);
        return generateLocalResponse(userMessage);
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        console.warn('[Gemini] Empty response, using fallback.');
        return generateLocalResponse(userMessage);
      }
      return text.trim();
    } catch (err) {
      console.error('[Gemini] Network error:', err);
      return generateLocalResponse(userMessage);
    }
  }

  /**
   * Smart rule-based fallback powered by the Decision Engine.
   * Uses multi-factor scoring, trend analysis, and predictions
   * to generate intelligent, reasoned responses.
   *
   * @param {string} message - User's message.
   * @returns {string} Generated response with reasoning.
   */
  function generateLocalResponse(message) {
    const msg = message.toLowerCase();
    const queues = QueueManager.getQueues();
    const crowd = QueueManager.getCrowdDensity();
    const phase = FirebaseService.getCurrentPhase();

    // --- Intent: Food queue ---
    if (matchesIntent(msg, ['food', 'eat', 'hungry', 'snack', 'drink', 'concession', 'burger', 'pizza'])) {
      return buildRankedResponse('food', '🍔', queues, crowd, phase);
    }

    // --- Intent: Restroom ---
    if (matchesIntent(msg, ['restroom', 'bathroom', 'toilet', 'washroom', 'loo'])) {
      return buildRankedResponse('restroom', '🚻', queues, crowd, phase);
    }

    // --- Intent: Gate / entry ---
    if (matchesIntent(msg, ['gate', 'entry', 'entrance', 'enter'])) {
      return buildRankedResponse('gate', '🚪', queues, crowd, phase);
    }

    // --- Intent: Seat finding ---
    if (matchesIntent(msg, ['seat', 'section', 'find my', 'where is', 'row', 'stand'])) {
      if (msg.includes('a') || msg.includes('north')) {
        DecisionEngine.setUserZone('north');
        const nearbyFood = DecisionEngine.recommend('food', queues, crowd);
        return `💺 **Section A** is in the **North Stand**. Enter through **Gate 1** and follow signs to the left.\n\n📍 Nearest facilities: Food Court North, Restroom A.\n${nearbyFood ? `\n🍔 *Closest food: ${nearbyFood.name} (${nearbyFood.waitFormatted} wait)*` : ''}`;
      }
      if (msg.includes('b') || msg.includes('south')) {
        DecisionEngine.setUserZone('south');
        const nearbyFood = DecisionEngine.recommend('food', queues, crowd);
        return `💺 **Section B** is in the **South Stand**. Enter through **Gate 2** and head straight.\n\n📍 Nearest facilities: Food Court South, Restroom B.\n${nearbyFood ? `\n🍔 *Closest food: ${nearbyFood.name} (${nearbyFood.waitFormatted} wait)*` : ''}`;
      }
      return '💺 The stadium has **Section A** (North) and **Section B** (South). Which section is on your ticket?';
    }

    // --- Intent: Exit / leaving ---
    if (matchesIntent(msg, ['exit', 'leave', 'go home', 'after match', 'parking', 'departure'])) {
      const gates = DecisionEngine.rankOptions('gate', queues, crowd);
      const bestGate = gates[0];
      let response = '🚪 **Smart exit strategy:**\n\n';
      if (bestGate) {
        response += `⭐ **${bestGate.name}** is your best exit (score: ${bestGate.score}/100).\n`;
        response += `*${bestGate.reasoning}.*\n\n`;
      }
      response += '💡 **Pro tip:** Wait 10-15 min after the final whistle. The main crush clears within that time.';
      if (phase.phase === 'post_match') {
        response += '\n\n⚠️ *Post-match exit is active now. Crowd density is high at main gates.*';
      }
      return response;
    }

    // --- Intent: Halftime / timing ---
    if (matchesIntent(msg, ['halftime', 'half time', 'break', 'when should', 'best time', 'timing'])) {
      const bestFood = DecisionEngine.recommend('food', queues, crowd);
      const bestRestroom = DecisionEngine.recommend('restroom', queues, crowd);
      let response = `⏰ **Current phase: ${phase.phaseLabel}**\n\n`;

      if (phase.phase === 'first_half') {
        response += '🏃 Head to food/restrooms **now** — before halftime queues triple!\n\n';
      } else if (phase.phase === 'halftime') {
        response += '🔥 **Halftime rush is active!** Queues are at peak. Consider waiting for 2nd half.\n\n';
      } else {
        response += 'Best strategy: go 5 min before halftime when queues are still short.\n\n';
      }

      if (bestFood) response += `🍔 Best food now: **${bestFood.name}** (${bestFood.waitFormatted}) — ${bestFood.reasoning}\n`;
      if (bestRestroom) response += `🚻 Best restroom: **${bestRestroom.name}** (${bestRestroom.waitFormatted}) — ${bestRestroom.reasoning}`;
      return response;
    }

    // --- Intent: Prediction / forecast (BEFORE queue to catch "will queues...") ---
    if (matchesIntent(msg, ['predict', 'forecast', 'future', 'will it', 'gonna', 'going to', 'later', 'minutes'])) {
      let response = '🔮 **Congestion Forecast:**\n\n';
      const predictions = [];
      Object.entries(queues).forEach(([id, q]) => {
        const pred = DecisionEngine.predictWait(id, q.wait, 10);
        if (pred.warning) {
          predictions.push({ name: q.name, ...pred });
        }
      });
      if (predictions.length > 0) {
        predictions.forEach(p => {
          response += `${p.warning} — **${p.name}** (predicted: ~${p.predicted} min, confidence: ${p.confidence})\n`;
        });
      } else {
        response += 'No significant changes predicted in the next 10 minutes. Conditions are stable.\n';
      }
      response += `\n📊 *Current phase: ${phase.phaseLabel}*`;
      return response;
    }

    // --- Intent: Queue / status overview ---
    if (matchesIntent(msg, ['queue', 'wait', 'busy', 'crowded', 'line', 'status', 'how long', 'overview', 'report'])) {
      return QueueManager.getSummaryForAssistant() + '\n\n*Ask about a specific facility for scored recommendations!*';
    }

    // --- Intent: Emergency / medical ---
    if (matchesIntent(msg, ['emergency', 'medical', 'first aid', 'hurt', 'injured', 'ambulance'])) {
      return '🏥 **First Aid** is on the **West side**, near the Merchandise Store.\n\n🚨 For emergencies, call stadium security at the nearest help point (blue signs) or dial the emergency number on your ticket.\n\n*Stay calm — help is nearby.*';
    }

    // --- Intent: Help ---
    if (matchesIntent(msg, ['help', 'what can', 'how do', 'guide', 'assist'])) {
      return '👋 I\'m your **VenueFlow Assistant** with AI decision intelligence!\n\n' +
        '🍔 **Food** — Scored recommendations with reasoning\n' +
        '🚻 **Restrooms** — Nearest AND lowest crowd option\n' +
        '💺 **Seats** — Directions + nearby facilities\n' +
        '🚪 **Exit** — Smart gate scoring for fastest departure\n' +
        '⏰ **Timing** — Event phase awareness\n' +
        '🔮 **Predictions** — "What will queues be like later?"\n' +
        '📊 **Status** — Full venue intelligence report\n\n' +
        '*Every recommendation includes reasoning — I explain WHY, not just WHAT.*';
    }

    // --- Intent: Merchandise ---
    if (matchesIntent(msg, ['merch', 'merchandise', 'shop', 'buy', 'souvenir', 'jersey'])) {
      const merch = queues['merch_main'];
      if (merch) {
        const trend = DecisionEngine.getTrend('merch_main');
        const pred = DecisionEngine.predictWait('merch_main', merch.wait, 10);
        let response = `🛍 **Merchandise Store** — West concourse, near Gate 1.\n\n`;
        response += `Current wait: **~${Math.round(merch.wait)} min** ${trend.label}\n`;
        if (pred.warning) response += `${pred.warning}\n`;
        response += `\n💡 *Best time: right after kickoff when everyone is seated.*`;
        return response;
      }
      return '🛍 Merchandise Store is on the West concourse.';
    }

    // --- Intent: Greeting ---
    if (matchesIntent(msg, ['hi', 'hello', 'hey', 'good', 'morning', 'evening'])) {
      const bestFood = DecisionEngine.recommend('food', queues, crowd);
      let msg2 = `👋 Welcome to the stadium! I'm your VenueFlow Assistant with real-time intelligence.\n\n`;
      msg2 += `📊 **Current phase: ${phase.phaseLabel}**\n`;
      if (bestFood) {
        msg2 += `🍔 Best food option: **${bestFood.name}** (${bestFood.waitFormatted}) ${bestFood.badge || ''}\n`;
        msg2 += `*${bestFood.reasoning}*\n`;
      }
      msg2 += `\nAsk me anything about queues, directions, or timing! 🏟️`;
      return msg2;
    }

    // --- Default ---
    return '🤔 I can help with **food, restrooms, seats, exits, timing, and predictions**.\n\nTry:\n• "Where\'s the best food option?"\n• "What will queues be like later?"\n• "Best exit strategy?"';
  }

  /**
   * Build a response for ranked facility recommendations.
   * Shows top option with reasoning + alternatives.
   *
   * @param {string} type - Facility type.
   * @param {string} emoji - Category emoji.
   * @param {Object} queues - Queue data.
   * @param {Object} crowd - Crowd density data.
   * @param {Object} phase - Event phase.
   * @returns {string} Formatted response.
   */
  function buildRankedResponse(type, emoji, queues, crowd, phase) {
    const ranked = DecisionEngine.rankOptions(type, queues, crowd);
    if (ranked.length === 0) return `No ${type} data available right now.`;

    const best = ranked[0];
    let response = `${emoji} ⭐ **${best.name}** is your best option (score: **${best.score}/100**).\n`;
    response += `Wait: **${best.waitFormatted}** ${best.trend.label}\n`;
    response += `📍 *${best.reasoning}.*\n`;

    // Prediction warning
    if (best.prediction.warning) {
      response += `\n${best.prediction.warning}\n`;
    }

    // Show alternatives
    if (ranked.length > 1) {
      response += '\n**Alternatives:**\n';
      ranked.slice(1).forEach((opt, i) => {
        const badge = opt.badge ? ` ${opt.badge}` : '';
        response += `${i + 2}. ${opt.name}: ${opt.waitFormatted} (score: ${opt.score})${badge}\n`;
      });
    }

    // Phase-specific advice
    if (phase.phase === 'halftime' && type === 'food') {
      response += '\n🔥 *Halftime rush — queues are at peak! Consider waiting 5 min for them to clear.*';
    }
    if (phase.phase === 'first_half' && type === 'food') {
      response += '\n💡 *Go now while the match is on — queues are at their shortest!*';
    }

    return response;
  }

  /**
   * Check if a message matches any intent keywords.
   */
  function matchesIntent(msg, keywords) {
    return keywords.some(kw => msg.includes(kw));
  }

  /**
   * Check if the assistant is in live (Gemini) mode.
   * @returns {boolean}
   */
  function isLive() {
    return !!apiKey;
  }

  return { init, chat, isLive };
})();
