# EEIA Mobile

Mobile-first MVP for an adaptive English learning coach focused on weakness-based lesson planning, accent training, and persistent progress tracking.

## Stack

- Expo + React Native + TypeScript
- React Navigation (bottom tabs)
- AsyncStorage for local persistence
- Node.js Express tutor API

## Features in this scaffold

- Home dashboard with next class objective
- Initial diagnostic trigger to compute weakness priorities
- Tutor chat input to set adaptive class goal
- Lesson flow screen generated from adaptive engine rules
- Progress metrics screen with weaknesses and recent sessions
- Accent lab with TTS listening sample per accent and score updates
- Pronunciation practice with voice recording, transcription-based scoring, and feedback
- Weekly planner generated from current weak areas
- API client layer and environment config

## Run

1. Install dependencies:

```bash
npm install
```

2. Optional environment file:

```bash
cp .env.example .env
```

3. Configure environment variables in `.env`:

```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:3000
SERVER_PORT=3000
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.3-70b-versatile
CHAT_CONTEXT_WINDOW=8
```

If you run the app on a physical phone, `localhost` points to the phone itself, not to your Mac. Use your Mac's LAN IP instead, for example `http://192.168.1.20:3000`. If `EXPO_PUBLIC_API_BASE_URL` is omitted, the app now tries to infer the Expo dev host automatically.

4. Start tutor backend:

```bash
npm run server
```

5. Start mobile development:

```bash
npm run dev
```

6. Run on device/emulator:

```bash
npm run android
# or
npm run ios
```

7. Type-check lint:

```bash
npm run lint
```

## Free deployment strategy: Render + Expo Go

This project can be shared with external testers at no cost using Render for the backend and Expo Go for the mobile app.

### 1. Deploy backend to Render (free)

1. Push this repository to GitHub.
2. In Render, create a new Web Service from the repository.
3. Render detects `render.yaml` and applies:
	- Build command: `npm install`
	- Start command: `npm run server`
	- Plan: `free`
4. In Render service environment variables, set:
	- `GROQ_API_KEY`
	- `GROQ_MODEL` (optional, default already exists)
	- `CHAT_CONTEXT_WINDOW` (optional)
5. Deploy and copy your backend URL, for example: `https://eeia-server.onrender.com`.

The server now supports Render's default `PORT` variable automatically.

### 2. Point the app to deployed backend

Set this value in your local `.env`:

`EXPO_PUBLIC_API_BASE_URL=https://your-render-url.onrender.com`

Then restart Expo to reload environment variables.

### 3. Share app via Expo Go

1. Run `npm run dev`.
2. Open Expo Go on tester devices.
3. Share the QR code or development URL from Expo.

Testers can run the app without building an APK/IPA, as long as the backend is publicly reachable.

### 4. Free-tier expectations

- Render free services may sleep after inactivity.
- First request after idle time can be slower.
- Suitable for MVP testing and user feedback rounds.

## Notes

- Auth is currently a placeholder screen and should be connected to a provider in a next iteration.
- Chat screen calls `/tutor/message` and updates next class goal with backend suggestion.
- Chat sends a short context window (last N messages) for session memory continuity.
- If `GROQ_API_KEY` is missing, backend returns deterministic fallback responses.
