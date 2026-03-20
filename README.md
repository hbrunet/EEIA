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
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
SERVER_PORT=3000
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4.1-mini
CHAT_CONTEXT_WINDOW=8
```

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

## Notes

- Auth is currently a placeholder screen and should be connected to a provider in a next iteration.
- Chat screen calls `/tutor/message` and updates next class goal with backend suggestion.
- Chat sends a short context window (last N messages) for session memory continuity.
- If `OPENAI_API_KEY` is missing, backend returns deterministic fallback responses.
