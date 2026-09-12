import type { Draft, ModelId } from './types';

export const models = {
  banana: {
    name: 'Nano Banana 2',
    maker: 'GOOGLE',
    air: 'google:4@3',
    note: '自然光影・靈活改圖',
    letter: 'N',
  },
  gpt: {
    name: 'GPT Image 2',
    maker: 'OPENAI',
    air: 'openai:gpt-image@2',
    note: '細膩構圖・文字設計',
    letter: 'G',
  },
} as const;

export function dimensions(model: ModelId, draft: Draft) {
  const portrait = model === 'banana' ? [768, 1376] : [768, 1360];
  const size =
    draft.ratio === 'square'
      ? [1024, 1024]
      : draft.ratio === 'portrait'
        ? portrait
        : [...portrait].reverse();
  const scale = draft.resolution === '2K' ? 2 : 1;
  return { width: size[0] * scale, height: size[1] * scale };
}

export function validateDraft(draft: Draft) {
  if (draft.prompt.trim().length < 3) throw new Error('請用至少 3 個字描述想要的畫面。');
  if (draft.prompt.length > 32000) throw new Error('描述太長了，請縮短至 32,000 字以內。');
  if (
    !draft.models.length ||
    new Set(draft.models).size !== draft.models.length ||
    draft.models.some((m) => !models[m])
  )
    throw new Error('請至少選擇一個模型。');
  if (!Number.isInteger(draft.count) || draft.count < 1 || draft.count > 4)
    throw new Error('每個模型可生成 1 至 4 張。');
  if (draft.refs.length > 4) throw new Error('每次最多使用 4 張參考照片。');
}

export function buildRequest(id: string, model: ModelId, draft: Draft, references: string[]) {
  validateDraft(draft);
  if (references.length !== draft.refs.length)
    throw new Error('參考照片尚未完整載入，請重新選擇照片。');
  return {
    taskType: 'imageInference',
    taskUUID: id,
    model: models[model].air,
    positivePrompt: draft.prompt.trim(),
    ...dimensions(model, draft),
    numberResults: 1,
    outputType: 'dataURI',
    outputFormat: 'PNG',
    deliveryMethod: 'async',
    includeCost: true,
    ...(references.length ? { inputs: { referenceImages: references } } : {}),
    ...(model === 'banana'
      ? { providerSettings: { google: { webSearch: draft.googleSearch } } }
      : {
          providerSettings: { openai: { quality: draft.gptQuality } },
          settings: { background: draft.gptBackground },
        }),
  };
}
