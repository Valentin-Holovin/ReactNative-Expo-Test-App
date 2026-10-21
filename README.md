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
npx expo export --platform web
```

Текущая конфигурация `web.output: server` требует хостинг с поддержкой Expo server output. Для обычного static hosting потребуется соответствующая настройка экспорта и маршрутов.

Live link: пока не указан.

Результаты проверки и ограничения: [QA_REPORT.md](QA_REPORT.md).
