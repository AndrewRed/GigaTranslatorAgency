# GigaTranslatorAgency

Минимальный модуль для перевода чанков текста через LLM API c production-защитами:

- `src/translateChunk.js` — формирует промпт и вызывает клиент.
- `src/llmClient.js` — делает HTTP-вызов с timeout, retries, exponential backoff + jitter, `Retry-After` и безопасным логированием.

## Экспорт

```js
import { translateChunk, requestLlm } from './src/index.js';
```
