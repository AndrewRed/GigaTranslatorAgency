# GigaTranslatorAgency

Веб-приложение (backend + frontend) для литературного перевода английской прозы на русский через OpenAI-compatible API.

## Что умеет

- Принимает даже некачественный английский текст.
- Разбивает большие тексты на части, чтобы стабильно обрабатывать длинные главы.
- Даёт модели системную инструкцию на художественную адаптацию (не дословный перевод).
- Склеивает результат в цельный русский текст в книжной стилистике.

## Быстрый старт

```bash
npm install
npm start
```

Откройте `http://localhost:3000`.

## Переменные окружения

Можно задать в `.env`:

```env
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
PORT=3000
```

> В интерфейсе можно передать `baseUrl`, `apiKey`, `model` напрямую. Поля сохраняются в localStorage браузера.

## API

### `POST /api/translate`

Тело запроса JSON:

```json
{
  "text": "your english text",
  "title": "Book title",
  "author": "Author",
  "notes": "style notes",
  "baseUrl": "https://api.openai.com/v1",
  "apiKey": "sk-...",
  "model": "gpt-4o-mini",
  "temperature": 0.65
}
```

Ответ:

```json
{
  "chunks": ["...", "..."],
  "translation": "..."
}
```

### `GET /api/health`

Проверка доступности сервиса.
