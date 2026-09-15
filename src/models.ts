import { isVideo, type Draft, type ModelId, type WorkKind } from './types';

export const models = {
  banana: {
    kind: 'image',
    name: 'Nano Banana 2',
    maker: 'GOOGLE',
    air: 'google:4@3',
    note: '自然光影・靈活改圖',
    letter: 'N',
  },
  gpt: {
    kind: 'image',
    name: 'GPT Image 2',
    maker: 'OPENAI',
    air: 'openai:gpt-image@2',
    note: '細膩構圖・文字設計',
    letter: 'G',
  },
  flux: {
    kind: 'image',
    name: 'FLUX.2 Pro',
    maker: 'BLACK FOREST LABS',
    air: 'bfl:5@1',
    note: '寫實質感・商品攝影',
    letter: 'F',
  },
  seedream: {
    kind: 'image',
    name: 'Seedream 5.0 Pro',
    maker: 'BYTEDANCE',
    air: 'bytedance:seedream@5.0-pro',
    note: '構圖設計・多圖修改',
    letter: 'S',
  },
  kling: {
    kind: 'video',
    name: 'Kling 3.0 Standard',
    maker: 'KLING AI',
    air: 'klingai:kling-video@3-standard',
    note: '動作自然・日常創作',
    letter: 'K',
  },
  seedance: {
    kind: 'video',
    name: 'Seedance 2.0 Fast',
    maker: 'BYTEDANCE',
    air: 'bytedance:seedance@2.0-fast',
    note: '快速創作・豐富動態',
    letter: 'S',
  },
  veo: {
    kind: 'video',
    name: 'Veo 3.1 Fast',
    maker: 'GOOGLE',
    air: 'google:3@3',
    note: '光影氛圍・聲音場景',
    letter: 'V',
  },
} as const;

export const modelsFor = (kind: WorkKind) =>
  (Object.keys(models) as ModelId[]).filter((id) => models[id].kind === kind);
export const promptLimit = (draft: Draft) =>
  Math.min(
    ...draft.models.map((m) =>
      m === 'kling'
        ? 2500
        : ['seedream', 'veo'].includes(m)
          ? 3000
          : m === 'seedance'
            ? 10000
            : 32000,
    ),
    32000,
  );
export const supports1080 = (draft: Draft) =>
  draft.models.length > 0 && draft.models.every((m) => m === 'veo');

export function dimensions(model: ModelId, draft: Draft) {
  if (models[model].kind === 'video') {
    const high = draft.videoResolution === '1080p';
    if (draft.ratio === 'square') return { width: 960, height: 960 };
    return draft.ratio === 'portrait'
      ? { width: high ? 1080 : 720, height: high ? 1920 : 1280 }
      : { width: high ? 1920 : 1280, height: high ? 1080 : 720 };
  }
  if (model === 'seedream' && draft.ratio !== 'square') {
    const size = draft.resolution === '2K' ? [1584, 2816] : [800, 1424];
    return draft.ratio === 'portrait'
      ? { width: size[0], height: size[1] }
      : { width: size[1], height: size[0] };
  }
  if (model === 'flux' && draft.resolution === '2K' && draft.ratio !== 'square')
    return draft.ratio === 'portrait'
      ? { width: 1152, height: 2048 }
      : { width: 2048, height: 1152 };
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
  if (draft.models.some((m) => models[m].kind !== (draft.kind ?? 'image')))
    throw new Error('請選擇符合這份作品類別的模型。');
  if (draft.prompt.length > promptLimit(draft))
    throw new Error(`目前模型最多接受 ${promptLimit(draft).toLocaleString()} 字，請縮短描述。`);
  if (isVideo(draft)) {
    if (draft.refs.length > 1) throw new Error('影片每次使用一張起始照片。');
    if (![4, 6, 8].includes(draft.duration ?? 4)) throw new Error('請選擇 4、6 或 8 秒。');
    if (draft.count > 2) throw new Error('每個模型每次最多生成 2 支影片。');
    if (draft.ratio === 'square' && draft.models.includes('veo') && !draft.refs.length)
      throw new Error('Veo 支援直向與橫向影片，請更換比例。');
    if (draft.videoResolution === '1080p' && !supports1080(draft))
      throw new Error('目前選取的模型組合支援 720p，請調整解析度。');
    const negativeLength = draft.klingNegativePrompt?.trim().length ?? 0;
    if (draft.models.includes('kling') && negativeLength === 1)
      throw new Error('Kling 排除內容請至少填寫 2 個字，或保持空白。');
    if (negativeLength > 2500) throw new Error('Kling 排除內容最多 2,500 字。');
  }
}

export interface GenerationRequest {
  taskType: string;
  taskUUID: string;
  model: string;
  positivePrompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  duration?: number;
  resolution?: string;
  numberResults: number;
  outputType: string;
  outputFormat: string;
  deliveryMethod: string;
  includeCost: boolean;
  inputs?: { referenceImages?: string[]; frameImages?: { image: string; frame: string }[] };
  providerSettings?: Record<string, Record<string, string | boolean>>;
  settings?: Record<string, string | boolean>;
}

export function buildRequest(
  id: string,
  model: ModelId,
  draft: Draft,
  references: string[],
): GenerationRequest {
  validateDraft(draft);
  if (references.length !== draft.refs.length)
    throw new Error('參考照片尚未完整載入，請重新選擇照片。');
  if (isVideo(draft))
    return {
      taskType: 'videoInference',
      taskUUID: id,
      model: models[model].air,
      positivePrompt: draft.prompt.trim(),
      duration: draft.duration ?? 4,
      numberResults: 1,
      outputType: 'URL',
      outputFormat: 'MP4',
      deliveryMethod: 'async',
      includeCost: true,
      ...(references.length
        ? {
            inputs: { frameImages: [{ image: references[0], frame: 'first' }] },
            ...(model !== 'kling' ? { resolution: draft.videoResolution ?? '720p' } : {}),
          }
        : dimensions(model, draft)),
      ...(model === 'kling'
        ? {
            providerSettings: { klingai: { sound: draft.audio ?? false } },
            ...(draft.klingNegativePrompt?.trim()
              ? { negativePrompt: draft.klingNegativePrompt.trim() }
              : {}),
          }
        : model === 'seedance'
          ? { settings: { audio: draft.audio ?? false } }
          : {
              providerSettings: {
                google: {
                  generateAudio: draft.audio ?? false,
                  ...(references.length ? { resizeMode: 'pad' } : {}),
                },
              },
            }),
    };
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
      : model === 'gpt'
        ? {
            providerSettings: { openai: { quality: draft.gptQuality } },
            settings: { background: draft.gptBackground },
          }
        : model === 'seedream'
          ? { settings: { thinking: draft.seedreamThinking ?? true } }
          : {}),
  };
}
