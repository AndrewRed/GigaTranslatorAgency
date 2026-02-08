'use strict';

/**
 * Translation pipeline with token-oriented chunking and multi-pass editing.
 *
 * Integrators can supply a custom `llmClient` with signature:
 *   await llmClient({ system, user, temperature, maxTokens }) => string
 */

const DEFAULT_MODEL_BUDGET = {
  chunkInputTokens: 1400,
  styleSeedChunks: 3,
  translationOutputTokens: 1600,
  analysisOutputTokens: 700,
};

function countApproxTokens(text) {
  if (!text) return 0;
  const words = text.match(/[\p{L}\p{N}_'-]+/gu) || [];
  const punctuation = text.match(/[^\s\p{L}\p{N}_]/gu) || [];
  return Math.ceil(words.length * 1.25 + punctuation.length * 0.5);
}

function normalizeParagraph(paragraph) {
  return paragraph.replace(/\s+/g, ' ').trim();
}

/**
 * Token-oriented chunking: split by paragraphs and keep each chunk under token budget.
 */
function splitIntoChunks(text, tokenBudget = DEFAULT_MODEL_BUDGET.chunkInputTokens) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map(normalizeParagraph)
    .filter(Boolean);

  if (!paragraphs.length) return [];

  const chunks = [];
  let current = [];
  let currentTokens = 0;

  const pushChunk = () => {
    if (!current.length) return;
    chunks.push(current.join('\n\n'));
    current = [];
    currentTokens = 0;
  };

  for (const paragraph of paragraphs) {
    const pTokens = countApproxTokens(paragraph);

    if (pTokens > tokenBudget) {
      pushChunk();
      const sentences = paragraph.split(/(?<=[.!?…])\s+/).filter(Boolean);
      let sentenceBlock = [];
      let sentenceTokens = 0;

      for (const sentence of sentences) {
        const sTokens = countApproxTokens(sentence);
        if (sentenceTokens + sTokens > tokenBudget && sentenceBlock.length) {
          chunks.push(sentenceBlock.join(' '));
          sentenceBlock = [sentence];
          sentenceTokens = sTokens;
        } else {
          sentenceBlock.push(sentence);
          sentenceTokens += sTokens;
        }
      }
      if (sentenceBlock.length) chunks.push(sentenceBlock.join(' '));
      continue;
    }

    if (currentTokens + pTokens > tokenBudget && current.length) {
      pushChunk();
    }

    current.push(paragraph);
    currentTokens += pTokens;
  }

  pushChunk();
  return chunks;
}

function parseJsonRelaxed(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    const maybe = text.match(/\{[\s\S]*\}/);
    if (maybe) {
      try {
        return JSON.parse(maybe[0]);
      } catch {
        return fallback;
      }
    }
    return fallback;
  }
}

function mergeUnique(base = [], incoming = []) {
  const set = new Set(base);
  for (const item of incoming) {
    if (typeof item === 'string' && item.trim()) {
      set.add(item.trim());
    }
  }
  return [...set];
}

function mergeGlossary(base = {}, incoming = {}) {
  const merged = { ...base };
  for (const [k, v] of Object.entries(incoming)) {
    if (!k || typeof v !== 'string' || !v.trim()) continue;
    merged[k.trim()] = v.trim();
  }
  return merged;
}

function mergeStyleGuide(base = {}, incoming = {}) {
  return {
    names: mergeUnique(base.names, incoming.names),
    terms: mergeGlossary(base.terms, incoming.terms),
    tone: incoming.tone?.trim() || base.tone || '',
    era: incoming.era?.trim() || base.era || '',
    notes: mergeUnique(base.notes, incoming.notes),
  };
}

function styleGuideToPromptBlock(styleGuide) {
  return JSON.stringify(
    {
      names: styleGuide.names || [],
      terms: styleGuide.terms || {},
      tone: styleGuide.tone || '',
      era: styleGuide.era || '',
      notes: styleGuide.notes || [],
    },
    null,
    2,
  );
}

async function extractStyleGuide(seedChunks, llmClient) {
  const combined = seedChunks.join('\n\n');
  const system =
    'Ты редактор-переводчик. Извлеки из исходника имена/термины/тон/эпоху. Верни строго JSON.';
  const user = [
    'Проанализируй фрагменты и верни объект:',
    '{"names": string[], "terms": Record<string,string>, "tone": string, "era": string, "notes": string[]}',
    '',
    combined,
  ].join('\n');

  const raw = await llmClient({
    system,
    user,
    temperature: 0.1,
    maxTokens: DEFAULT_MODEL_BUDGET.analysisOutputTokens,
  });

  return mergeStyleGuide(
    {},
    parseJsonRelaxed(raw, {
      names: [],
      terms: {},
      tone: '',
      era: '',
      notes: [],
    }),
  );
}

async function updateStyleGuideWithChunk(sourceChunk, translatedChunk, styleGuide, llmClient) {
  const system =
    'Ты контроллер консистентности перевода. Обнови только полезные элементы glossary/style-guide. Верни строго JSON.';
  const user = [
    'Текущий style guide:',
    styleGuideToPromptBlock(styleGuide),
    '',
    'Источник:',
    sourceChunk,
    '',
    'Перевод:',
    translatedChunk,
    '',
    'Верни JSON в формате {"names":[],"terms":{},"tone":"","era":"","notes":[]}.',
  ].join('\n');

  const raw = await llmClient({
    system,
    user,
    temperature: 0.1,
    maxTokens: DEFAULT_MODEL_BUDGET.analysisOutputTokens,
  });

  return mergeStyleGuide(styleGuide, parseJsonRelaxed(raw, {}));
}

async function translateChunk(sourceChunk, styleGuide, llmClient, targetLanguage) {
  const system = `Ты литературный переводчик. Переводи на ${targetLanguage}, сохраняя смысл и авторский стиль.`;
  const user = [
    'Используй этот glossary/style guide как обязательный контекст:',
    styleGuideToPromptBlock(styleGuide),
    '',
    'Переведи фрагмент:',
    sourceChunk,
  ].join('\n');

  return llmClient({
    system,
    user,
    temperature: 0.3,
    maxTokens: DEFAULT_MODEL_BUDGET.translationOutputTokens,
  });
}

async function selfEditPass(translatedText, styleGuide, llmClient, targetLanguage) {
  const system =
    `Ты литературный редактор. Улучши ритм и естественность текста на ${targetLanguage}, без потери фактов и терминов.`;
  const user = [
    'Сохрани согласованность с glossary/style guide:',
    styleGuideToPromptBlock(styleGuide),
    '',
    'Текст для редакторской правки:',
    translatedText,
  ].join('\n');

  return llmClient({
    system,
    user,
    temperature: 0.25,
    maxTokens: DEFAULT_MODEL_BUDGET.translationOutputTokens * 2,
  });
}

async function consistencyCheckPass(editedText, styleGuide, llmClient, targetLanguage) {
  const system =
    `Ты QA-редактор перевода на ${targetLanguage}. Исправь несогласованность имён, обращений и терминов. Верни полный исправленный текст.`;
  const user = [
    'Проверь консистентность относительно style guide:',
    styleGuideToPromptBlock(styleGuide),
    '',
    'Текст:',
    editedText,
  ].join('\n');

  return llmClient({
    system,
    user,
    temperature: 0.1,
    maxTokens: DEFAULT_MODEL_BUDGET.translationOutputTokens * 2,
  });
}

async function translateBook({ text, targetLanguage, llmClient }) {
  if (!text?.trim()) throw new Error('Source text is empty.');
  if (typeof llmClient !== 'function') throw new Error('llmClient must be a function.');

  const chunks = splitIntoChunks(text);
  const seedChunks = chunks.slice(0, DEFAULT_MODEL_BUDGET.styleSeedChunks);
  let styleGuide = await extractStyleGuide(seedChunks, llmClient);

  const translatedChunks = [];
  for (const chunk of chunks) {
    const translatedChunk = await translateChunk(chunk, styleGuide, llmClient, targetLanguage);
    translatedChunks.push(translatedChunk);
    styleGuide = await updateStyleGuideWithChunk(chunk, translatedChunk, styleGuide, llmClient);
  }

  const draft = translatedChunks.join('\n\n');
  const edited = await selfEditPass(draft, styleGuide, llmClient, targetLanguage);
  const finalText = await consistencyCheckPass(edited, styleGuide, llmClient, targetLanguage);

  return {
    chunks,
    styleGuide,
    draft,
    edited,
    finalText,
  };
}

module.exports = {
  countApproxTokens,
  splitIntoChunks,
  extractStyleGuide,
  updateStyleGuideWithChunk,
  selfEditPass,
  consistencyCheckPass,
  translateBook,
};
