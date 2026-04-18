# VenueFlow — Architecture

## Overview
VenueFlow is an AI-powered venue navigation assistant for large-scale sporting events.
It helps attendees with crowd movement, queue reduction, and real-time coordination
through a conversational AI interface backed by Google services.

## Tech Stack
- **Frontend**: Vanilla HTML/CSS/JS (lightweight, no build step)
- **AI Assistant**: Google Gemini API (via REST)
- **Maps & Routing**: Google Maps JavaScript API
- **Real-Time Data**: Firebase Realtime Database
- **Auth**: Firebase Anonymous Auth (frictionless)

## Folder Structure
```
Promptwars_solution/
├── index.html              # Main entry point
├── css/
│   └── style.css           # All styles
├── js/
│   ├── app.js              # App initialization & routing
│   ├── assistant.js         # Gemini AI assistant logic
│   ├── map.js              # Google Maps integration
│   ├── firebase-config.js  # Firebase setup
│   ├── queue.js            # Queue monitoring & recommendations
│   └── utils.js            # Shared utilities
├── tests/
│   └── test.html           # In-browser test suite
├── docs/
│   └── ARCHITECTURE.md     # This file
├── .env.example            # Environment variable template
├── .gitignore
└── README.md
```

## Data Flow
1. Attendee opens app → Firebase Anonymous Auth
2. App loads venue map via Google Maps API
3. Firebase syncs real-time crowd/queue data
4. Attendee chats with AI assistant (Gemini)
5. Assistant reasons over venue context (queues, location, event schedule)
6. Returns actionable guidance (directions, timing, alerts)

## Key Design Decisions
- No build tools = instant setup, tiny repo
- Firebase Anonymous Auth = zero-friction onboarding
- Simulated crowd data with realistic patterns (demo mode)
- Gemini system prompt encodes venue knowledge for contextual responses
