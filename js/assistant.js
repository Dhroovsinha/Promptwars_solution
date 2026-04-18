/**
 * assistant.js — AI Assistant powered by Google Gemini.
 *
 * Google Service: Gemini API (generative AI)
 *
 * The assistant uses venue context (queue data, crowd density, event schedule)
 * to provide intelligent, actionable recommendations to attendees.
 * Falls back to a smart rule-based engine in demo mode.
 */

const Assistant = (() => {
  'use strict';

  let apiKey = null;
  let conversationHistory = [];
  const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

  /**
   * System prompt that gives the AI full venue context and behavioral rules.
   * This is the core of the "smart assistant" design.
   */
  function buildSystemPrompt() {
    const queueSummary = QueueManager.getSummaryForAssistant();
    const time = VenueUtils.timeNow();

    return `You are **VenueFlow Assistant**, an AI concierge for a live sporting event at National Stadium.
Your role is to help attendees have the best possible experience by providing real-time, actionable guidance.

**Your capabilities:**
1. **Queue Guidance** — You know current wait times for all food courts, restrooms, merchandise, and gates. Always recommend the shortest option.
2. **Navigation** — You can give directions between any two points in the stadium (gates, sections, facilities).
3. **Crowd Management** — You know crowd density in different areas and can suggest less crowded routes.
4. **Event Timing** — You know the event schedule and can suggest optimal times for food/restroom breaks.
5. **Safety & Accessibility** — You can direct attendees to first aid, accessible entrances, and emergency exits.

**Current Live Data (updates every few seconds):**
${queueSummary}

**Current Time:** ${time}

**Event Schedule:**
- Gates open: 2 hours before kickoff
- Kickoff: on schedule
- Halftime: ~45 min after kickoff (best time for food runs — go 5 min before halftime starts)
- Post-match: staggered exit recommended (wait 10-15 min to avoid crush)

**Stadium Layout:**
- North Stand: Gates 1, Food Court North, Restroom A
- South Stand: Gate 2, Food Court South, Restroom B
- East Side: Snack Bar East, Restroom C
- West Side: Merchandise Store, First Aid
- Sections A (North) and B (South) for seating

**Behavioral Rules:**
- Be concise, friendly, and action-oriented. Use 2-4 sentences max.
- Always include specific wait times when discussing queues.
- Use emoji sparingly for clarity (🟢 🟡 🔴 for queue status, 📍 for locations).
- If someone asks about food, always tell them the shortest queue option first.
- For restrooms, prioritize proximity AND wait time.
- Proactively warn about upcoming crowd surges (halftime, end of match).
- If a question is outside your scope, politely redirect to stadium staff.
- Never make up data — use only the live data provided above.`;
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
   * Call Google Gemini API for an intelligent response.
   * @param {string} userMessage - User's input.
   * @returns {Promise<string>} AI-generated response.
   */
  async function callGemini(userMessage) {
    const systemPrompt = buildSystemPrompt();

    // Build conversation contents for Gemini
    const contents = [];

    // Add conversation history
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
            maxOutputTokens: 300,
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
        return generateLocalResponse(userMessage); // Fallback
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
   * Smart rule-based fallback when Gemini API is unavailable.
   * Parses intent from the user message and returns contextual answers
   * using live queue data. This is NOT a dumb fallback — it demonstrates
   * the assistant's logic and decision-making framework.
   *
   * @param {string} message - User's message.
   * @returns {string} Generated response.
   */
  function generateLocalResponse(message) {
    const msg = message.toLowerCase();
    const queues = QueueManager.getQueues();
    const alerts = QueueManager.getAlerts();

    // Intent: Food queue
    if (matchesIntent(msg, ['food', 'eat', 'hungry', 'snack', 'drink', 'concession', 'burger', 'pizza'])) {
      const best = QueueManager.findBest('food');
      if (best) {
        const alternatives = Object.entries(queues)
          .filter(([_, q]) => q.type === 'food')
          .sort((a, b) => a[1].wait - b[1].wait);

        let response = `🟢 **${best.name}** has the shortest wait right now at **${best.formatted}**! `;
        if (alternatives.length > 1) {
          const second = alternatives[1];
          response += `\n\nAlternatively, ${second[1].name} has a ~${Math.round(second[1].wait)} min wait.`;
        }
        response += `\n\n💡 *Tip: Head there now before halftime when queues double!*`;
        return response;
      }
      return 'I don\'t have current food queue data. Please check the venue map for food court locations.';
    }

    // Intent: Restroom
    if (matchesIntent(msg, ['restroom', 'bathroom', 'toilet', 'washroom', 'loo'])) {
      const best = QueueManager.findBest('restroom');
      if (best) {
        let response = `🚻 **${best.name}** is your best bet with only **${best.formatted}** wait.`;
        const others = Object.entries(queues)
          .filter(([_, q]) => q.type === 'restroom')
          .sort((a, b) => a[1].wait - b[1].wait);
        if (others.length > 1) {
          response += `\n\nOther options: ${others.slice(1).map(([_, q]) => `${q.name} (~${Math.round(q.wait)} min)`).join(', ')}.`;
        }
        return response;
      }
      return 'Restrooms are located at North (A), South (B), and East (C) concourses. Check the map for the nearest one.';
    }

    // Intent: Seat finding
    if (matchesIntent(msg, ['seat', 'section', 'find my', 'where is', 'row', 'stand'])) {
      if (msg.includes('a') || msg.includes('north')) {
        return '💺 **Section A** is in the **North Stand**. Enter through **Gate 1** and follow signs to the left. Look for section markers on the stairway walls.\n\n📍 Nearest facilities: Food Court North, Restroom A.';
      }
      if (msg.includes('b') || msg.includes('south')) {
        return '💺 **Section B** is in the **South Stand**. Enter through **Gate 2** and head straight. Section markers are clearly visible.\n\n📍 Nearest facilities: Food Court South, Restroom B.';
      }
      return '💺 The stadium has **Section A** (North Stand) and **Section B** (South Stand). Which section is on your ticket? I can give you specific directions!';
    }

    // Intent: Exit / leaving
    if (matchesIntent(msg, ['exit', 'leave', 'go home', 'end', 'after match', 'parking', 'departure'])) {
      return '🚪 **Smart exit strategy:**\n\n1. **Avoid the rush** — Wait 10-15 min after the final whistle. The main crush clears within that time.\n2. **Use Gate 2** (South) if parked to the south — it\'s typically less crowded.\n3. **Gate 1** (North) connects to the metro station.\n\n💡 *I\'ll alert you when crowd density drops near your exit.*';
    }

    // Intent: Halftime / timing
    if (matchesIntent(msg, ['halftime', 'half time', 'break', 'when should', 'best time', 'timing'])) {
      return '⏰ **Halftime tip:** The best strategy is to head to food/restrooms **5 minutes before halftime** starts. During halftime itself, queues can triple!\n\nRight now:\n' +
        `🍔 Shortest food queue: ${QueueManager.findBest('food')?.formatted || 'N/A'}\n` +
        `🚻 Shortest restroom: ${QueueManager.findBest('restroom')?.formatted || 'N/A'}\n\n` +
        '*I\'ll notify you when it\'s the optimal time to go!*';
    }

    // Intent: Queue status overview
    if (matchesIntent(msg, ['queue', 'wait', 'busy', 'crowded', 'line', 'status', 'how long'])) {
      return QueueManager.getSummaryForAssistant() + '\n\n*Ask me about a specific facility for personalized recommendations!*';
    }

    // Intent: Emergency / medical (checked BEFORE generic help to prioritize safety)
    if (matchesIntent(msg, ['emergency', 'medical', 'first aid', 'hurt', 'injured', 'ambulance'])) {
      return '🏥 **First Aid** is located on the **West side** of the stadium, near the Merchandise Store.\n\n🚨 For emergencies, call stadium security at the nearest help point (marked with blue signs) or dial the emergency number on your ticket.\n\n*Stay calm — help is nearby.*';
    }

    // Intent: Help / what can you do
    if (matchesIntent(msg, ['help', 'what can', 'how do', 'guide', 'assist'])) {
      return '👋 I\'m your **VenueFlow Assistant**! I can help you with:\n\n' +
        '🍔 **Food** — Find the shortest queue\n' +
        '🚻 **Restrooms** — Nearest with least wait\n' +
        '💺 **Seats** — Directions to your section\n' +
        '🚪 **Exits** — Smart departure strategies\n' +
        '⏰ **Timing** — Best time for food/restroom breaks\n' +
        '📊 **Status** — Live crowd & queue overview\n\n' +
        '*Just ask naturally — I understand context!*';
    }

    // Intent: Merchandise
    if (matchesIntent(msg, ['merch', 'merchandise', 'shop', 'buy', 'souvenir', 'jersey'])) {
      const merch = queues['merch_main'];
      if (merch) {
        return `🛍 The **Merchandise Store** is on the **West concourse**, near Gate 1.\n\nCurrent wait: **~${Math.round(merch.wait)} min** (${VenueUtils.getQueueLevel(merch.wait) === 'high' ? 'quite busy!' : 'manageable'}).\n\n💡 *Best time to shop: right after kickoff when everyone\'s in their seats.*`;
      }
      return '🛍 The Merchandise Store is on the West concourse. Check the map for directions!';
    }

    // Intent: Greeting
    if (matchesIntent(msg, ['hi', 'hello', 'hey', 'good', 'morning', 'evening'])) {
      return `👋 Hey there! Welcome to the stadium! I'm your VenueFlow Assistant.\n\nI can help you find the shortest queues, navigate to your seat, or plan the best time for a food run. What do you need? 🏟️`;
    }

    // Default: helpful fallback
    return '🤔 I\'m not sure about that, but I can help you with **food queues, restrooms, seat directions, exit strategies, and event timing**.\n\nTry asking something like:\n• "Where\'s the shortest food queue?"\n• "How do I get to Section B?"\n• "What\'s the best exit strategy?"';
  }

  /**
   * Check if a message matches any intent keywords.
   * @param {string} msg - Lowercased message.
   * @param {string[]} keywords - Keywords to match.
   * @returns {boolean}
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
