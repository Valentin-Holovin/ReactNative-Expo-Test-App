# CashMine Expo app

Expo / TypeScript приложение для просмотра payback-балансов и создания Claim.

## Запуск

Требуется Node.js 24+ (для запуска TypeScript unit-тестов без отдельного загрузчика).

```sh
npm install
npm run web
```

При первом входе введите API token. Он хранится в браузере; смена доступна на Home. API URL задан в `src/api/client.ts`.

Работают: балансы и USD totals, свежесть снимка, Claim с Max/комиссией/подтверждением, восстановление неизвестного результата с тем же idempotency key, отслеживание статуса и пагинация Activity.

## Проверки и сборка

```sh
npm test
npm run typecheck
npm run lint
npx expo-doctor
npm run build:web
```

## Netlify

Сборка — SPA (`web.output: single`). После `npm run build:web` папка `dist` готова для загрузки через Netlify Drop. Загружайте только `dist`, а не исходники проекта.

При подключении Git-репозитория Netlify использует `netlify.toml`: Node.js 24, команда `npm run build:web`, publish directory `dist`. Файл `public/_redirects` копируется в сборку и направляет вложенные URL на `index.html`, чтобы обновление `/claim` или `/activity` работало.

Токен вводится пользователем в приложении; переменные окружения с личным токеном не нужны.

Live link: пока не указан.

Результаты проверки и ограничения: [QA_REPORT.md](QA_REPORT.md).
