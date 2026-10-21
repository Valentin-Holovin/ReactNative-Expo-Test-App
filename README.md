# ReactNative Expo Test App

Минимальное приложение Expo с одним экраном Hello World.

## Запуск

```sh
npm install
npm start
```

`npm run ios` — iOS, `npm run android` — Android, `npm run web` — браузер.

## Библиотеки

- Expo Router — навигация; экраны находятся в `src/app`.
- TanStack Query — запросы и кеш серверных данных; провайдер подключён в `_layout.tsx`.
- Zustand — состояние приложения.
- AsyncStorage — локальное хранение данных.
- React Native Reanimated и Gesture Handler — анимации и жесты.
- Safe Area Context — безопасные отступы экрана.

Zustand и AsyncStorage установлены для будущих задач. Демонстрационных хранилищ и запросов нет.

## Проверки

```sh
npm run typecheck
npm run lint
npx expo install --check
```
