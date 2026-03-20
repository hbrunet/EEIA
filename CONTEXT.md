# Contexto del proyecto EEIA

## Idea
App móvil personal para aprender inglés de forma adaptativa. Sin pegar prompts manualmente.
Prioridades: reforzar debilidades reales, entrenar tonadas/acentos, guardar progreso y planificar clases automáticamente.

## Stack
- Expo + React Native + TypeScript (móvil)
- Node.js + Express (backend tutor)
- OpenAI API (modelo configurable por `.env`)
- AsyncStorage (persistencia local)
- expo-speech (TTS para práctica de acentos)

## Variables de entorno
Crear `.env` en la raíz copiando `.env.example`:
```
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
SERVER_PORT=3000
OPENAI_API_KEY=tu_api_key_aqui
OPENAI_MODEL=gpt-4.1-mini
CHAT_CONTEXT_WINDOW=8
```

## Cómo correr
```bash
npm install
npm run server   # backend en puerto 3000
npm run dev      # app Expo (escanear QR con Expo Go en tu teléfono)
```

## Próximos pasos pendientes
1. Persistir historial de chat en AsyncStorage
2. STT para speaking real y scoring de pronunciación
3. Autenticación real + sincronización en nube
4. Pasar perfil y debilidades del usuario al system prompt del tutor
