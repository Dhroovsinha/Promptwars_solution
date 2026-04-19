# AI Crowd Intelligence System for Smart Stadiums

## 💡 Why This Matters
Large-scale sporting venues face persistent challenges with dangerous crowd congestion, unpredictable wait times, and poor wayfinding. This project solves that by putting a context-aware, predictive AI concierge in the pocket of every attendee. By balancing load distribution across venue infrastructure, we prevent dangerous bottlenecks and increase overall safety and satisfaction.

## 🌟 Key Features
- **Real-time crowd prediction**: Forecasts congestion 10 minutes ahead so attendees can make proactive decisions.
- **Smart routing suggestions**: Dynamically scores facilities based on wait times, crowd density, and distance.
- **AI-powered decision engine**: Intelligent multi-factor routing with seamless **Gemini API fallback** for conversational reasoning.

## 🏗️ Architecture
This is a highly optimized, lightweight web application built for speed and reliability in crowded network environments.
- **Frontend**: Vanilla HTML5, CSS3, JS with Semantic tags and full ARIA accessibility.
- **Backend / AI**: Serverless execution relying on Google Gemini API for intelligent generation, supplemented by a deterministic scoring fallback.
- **Containerization**: Fully Dockerized using `nginx:alpine` to serve static assets with ultra-low overhead.

## 🛠️ Google Services Used
- **Google Gemini API**: Powers the conversational interface to explain *why* a route is recommended.
- **Google Cloud Run**: Native support for serverless deployment on port 8080.

## 🧪 Testing
The system includes automated, in-memory simulated crowd scenarios that trigger on startup, validating core logic:
- High crowd congestion (rerouting logic)
- Moderate traffic (standard routing)
- Emergency reroutes (safe path establishment)

## ⚡ Constraints Handled
- **<1MB Repo Size**: Zero heavy dependencies. Vanilla JS/CSS keeps the footprint tiny.
- **Single Branch**: All code resides cleanly in `main`.
- **Lightweight Deployment**: A 3-line Dockerfile guarantees rapid, error-free Cloud Run deployment.

## 🚀 How to Run Locally

### With Docker
```bash
docker build -t stadium-ai .
docker run -p 8080:8080 stadium-ai
```
Visit `http://localhost:8080`

### Without Docker
```bash
python -m http.server 8000
```
Visit `http://localhost:8000`

### ☁️ Deployed Link
*Project is ready for 1-click deployment to Google Cloud Run!*
```bash
gcloud run deploy crowd-ai --source . --port 8080 --allow-unauthenticated
```