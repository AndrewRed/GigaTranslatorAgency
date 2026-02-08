import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const DEFAULT_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'GigaTranslatorAgency' });
});

function splitIntoChunks(text, maxChunkLength = 4500) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return [];
  }

  const chunks = [];
  let current = '';

  for (const paragraph of paragraphs) {
    if ((`${current}\n\n${paragraph}`).length <= maxChunkLength) {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
      continue;
    }

    if (current) {
      chunks.push(current);
      current = '';
    }

    if (paragraph.length <= maxChunkLength) {
      current = paragraph;
      continue;
    }

    for (let i = 0; i < paragraph.length; i += maxChunkLength) {
      chunks.push(paragraph.slice(i, i + maxChunkLength));
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

function buildSystemPrompt({ title, author, notes }) {
  return [
    'Ты — главный литературный переводчик агентства переводов.',
    'Задача: превратить некачественный или шероховатый английский текст в художественный русский текст уровня книжного издания.',
    'Критерии качества:',
    '1) Передавай смысл, атмосферу, характеры и подтекст, а не буквальную структуру исходника.',
    '2) Исправляй логические, грамматические и стилистические дефекты исходного английского текста естественно для читателя.',
    '3) Используй живой, красивый литературный русский язык без канцеляризмов и машинных конструкций.',
    '4) Сохраняй имена, термины и внутреннюю согласованность между частями.',
    '5) Не добавляй комментарии переводчика, сноски и пояснения — возвращай только готовый художественный перевод.',
    title ? `Название произведения: ${title}.` : null,
    author ? `Автор: ${author}.` : null,
    notes ? `Редакторские заметки: ${notes}.` : null
  ].filter(Boolean).join('\n');
}

async function translateChunk({ baseUrl, apiKey, model, systemPrompt, chunk, previousContext, temperature }) {
  const endpoint = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  const userPrompt = [
    previousContext
      ? `Краткий контекст предыдущих частей (для стилистической связности):\n${previousContext}`
      : null,
    'Переведи следующий фрагмент на русский как фрагмент готовой книги:',
    chunk
  ]
    .filter(Boolean)
    .join('\n\n');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI-compatible API error (${response.status}): ${errorBody}`);
  }

  const payload = await response.json();
  return payload?.choices?.[0]?.message?.content?.trim();
}

app.post('/api/translate', async (req, res) => {
  try {
    const {
      text,
      title,
      author,
      notes,
      baseUrl = DEFAULT_BASE_URL,
      apiKey = process.env.OPENAI_API_KEY,
      model = DEFAULT_MODEL,
      temperature = 0.65
    } = req.body ?? {};

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Поле text обязательно и должно быть строкой.' });
    }

    if (!apiKey) {
      return res.status(400).json({ error: 'Не указан API key. Передайте apiKey в запросе или задайте OPENAI_API_KEY.' });
    }

    const chunks = splitIntoChunks(text);
    if (chunks.length === 0) {
      return res.status(400).json({ error: 'Текст пустой после нормализации.' });
    }

    const systemPrompt = buildSystemPrompt({ title, author, notes });
    const translatedChunks = [];

    for (let i = 0; i < chunks.length; i += 1) {
      const previousContext = translatedChunks.length > 0
        ? translatedChunks.slice(-2).join('\n\n').slice(-1200)
        : '';

      const translated = await translateChunk({
        baseUrl,
        apiKey,
        model,
        systemPrompt,
        chunk: chunks[i],
        previousContext,
        temperature
      });

      if (!translated) {
        throw new Error(`Модель вернула пустой ответ для чанка ${i + 1}.`);
      }

      translatedChunks.push(translated);
    }

    return res.json({
      chunks: translatedChunks,
      translation: translatedChunks.join('\n\n')
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`GigaTranslatorAgency running on http://localhost:${PORT}`);
});
