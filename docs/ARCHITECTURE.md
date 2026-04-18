# VenueFlow — Architecture

## Overview
VenueFlow is an AI-powered venue navigation assistant for large-scale sporting events.
It combines a multi-factor Decision Engine with conversational AI to help attendees
with crowd movement, queue reduction, and real-time coordination.

## Tech Stack
- **Frontend**: Vanilla HTML/CSS/JS (lightweight, no build step)
- **AI Assistant**: Google Gemini API (via REST)
- **Decision Engine**: Custom multi-factor scoring (wait × crowd × distance × trend)
- **Maps & Routing**: Google Maps JavaScript API
- **Real-Time Data**: Firebase Realtime Database
- **Auth**: Firebase Anonymous Auth (frictionless)

## Architecture Diagram
```
┌─────────────┐    ┌──────────────────┐    ┌────────────────┐
│  Firebase    │───▶│  QueueManager    │───▶│ DecisionEngine │
│  (Data Sync) │    │  (Monitoring)    │    │ (Scoring, AI)  │
└─────────────┘    └──────────────────┘    └───────┬────────┘
                                                    │
                   ┌──────────────────┐             │
                   │   Assistant.js    │◀────────────┘
                   │  (Gemini + Local) │
                   └────────┬─────────┘
                            │
┌─────────────┐    ┌────────▼─────────┐    ┌────────────────┐
│  VenueMap   │◀───│     App.js       │───▶│   User (Chat)  │
│  (SVG/Maps) │    │  (Controller)    │    │                │
└─────────────┘    └──────────────────┘    └────────────────┘
```

## Folder Structure
```
Promptwars_solution/
├── index.html              # Main entry point
├── css/
│   └── style.css           # Design system
├── js/
│   ├── app.js              # App controller & UI events
│   ├── decisionEngine.js   # ★ Multi-factor scoring & predictions
│   ├── assistant.js         # Gemini AI + decision-powered fallback
│   ├── map.js              # Google Maps + SVG venue map
│   ├── firebase-config.js  # Firebase + temporal event simulation
│   ├── queue.js            # Queue monitoring with DecisionEngine
│   └── utils.js            # Pure utility functions
├── tests/
│   └── test.html           # In-browser test suite (60+ assertions)
├── docs/
│   └── ARCHITECTURE.md     # This file
├── .env.example            # API key template
├── .gitignore
└── README.md
```

## Decision Engine Flow
```
Live Data (queues, crowd, phase)
        │
        ▼
  recordSnapshot()  ──▶  History Buffer (6 readings)
        │
        ▼
  scoreOption()     ──▶  Weighted Score (0-100)
   ├─ waitScore (40%)        normalized 0-1
   ├─ crowdScore (25%)       from density data
   ├─ distScore (20%)        from user zone
   └─ trendScore (15%)       from history slope
        │
        ▼
  rankOptions()     ──▶  Sorted + Badged
   ├─ ⭐ Best Option
   ├─ ⚡ Fastest
   └─ 🟢 Low Crowd
        │
        ▼
  predictWait()     ──▶  10-min forecast + warnings
```

## Key Design Decisions
- No build tools = instant setup, tiny repo (< 100 KB)
- Decision Engine is a pure module with no DOM dependencies (fully testable)
- Firebase Anonymous Auth = zero-friction onboarding
- Temporal simulation compresses 3-hour event into 10-minute demo cycle
- Gemini system prompt injects Decision Engine scores for AI context
- Every recommendation includes reasoning for transparency
