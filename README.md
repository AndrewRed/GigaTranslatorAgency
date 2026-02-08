# GigaTranslatorAgency

Асинхронный сервис переводов с API для создания/мониторинга job и отдельным worker-процессом для обработки чанков.

## Требования

- PostgreSQL
- Redis
- Node.js 20+

## Запуск

```bash
npm install
npm run start
```

В отдельном процессе:

```bash
npm run worker
```

## API

- `POST /api/jobs` — создать job
- `GET /api/jobs/:id` — получить статус и прогресс
- `GET /api/jobs/:id/result` — получить итоговый результат
- `GET /api/jobs/:id/events` — SSE поток событий по job

Пример `POST /api/jobs`:

```json
{
  "text": "hello world",
  "targetLang": "ru"
}
```
