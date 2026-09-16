import { dimensions, models } from './models';
import { isVideo, type Draft, type ModelId } from './types';

export interface PricingRate {
  amount: number;
  unit: string;
  label?: string;
  after?: number;
}

interface PricingResponse {
  air: string;
  pricingRates?: PricingRate[];
}

const pricingCache = new Map<ModelId, Promise<PricingRate[] | null>>();

async function fetchRates(model: ModelId) {
  const existing = pricingCache.get(model);
  if (existing) return existing;
  const request = fetch(
    `https://content.runware.ai/models/${encodeURIComponent(models[model].air)}/pricing`,
  )
    .then(async (response) => {
      if (!response.ok) return null;
      const data = (await response.json()) as PricingResponse;
      return data.air === models[model].air && Array.isArray(data.pricingRates)
        ? data.pricingRates
        : null;
    })
    .catch(() => null);
  pricingCache.set(model, request);
  return request;
}

const rate = (rates: PricingRate[], unit: string, label?: RegExp) =>
  rates.find((item) => item.unit === unit && (!label || label.test(item.label ?? '')))?.amount;

export function calculateModelEstimate(model: ModelId, draft: Draft, rates: PricingRate[]) {
  if (model === 'gpt') return null;

  if (model === 'banana') {
    if (draft.googleSearch) return null;
    const output = rate(rates, 'output', new RegExp(`^${draft.resolution}$`, 'i'));
    const input = rate(rates, 'inputImage');
    if (output === undefined || (draft.refs.length > 0 && input === undefined)) return null;
    return output + (input ?? 0) * draft.refs.length;
  }

  if (model === 'flux') {
    if (draft.refs.length) return null;
    const perMegapixel = rate(rates, 'outputMegapixel', /First megapixel/i);
    if (perMegapixel === undefined) return null;
    const size = dimensions(model, draft);
    return perMegapixel * ((size.width * size.height) / 1_000_000);
  }

  if (model === 'seedream') {
    const size = dimensions(model, draft);
    const label = size.width * size.height > 2_360_000 ? /^2K$/i : /^1\.5K$/i;
    const output = rate(rates, 'output', label);
    const extraInput = rate(rates, 'inputImage');
    if (output === undefined || (draft.refs.length > 1 && extraInput === undefined)) return null;
    return output + (extraInput ?? 0) * Math.max(0, draft.refs.length - 1);
  }

  if (isVideo(draft)) {
    const withAudio = draft.audio ?? false;
    const resolution = draft.videoResolution ?? '720p';
    const label =
      model === 'seedance'
        ? new RegExp(`^${resolution}$`, 'i')
        : model === 'kling'
          ? withAudio
            ? /· audio$/i
            : /no audio/i
          : withAudio
            ? /with audio/i
            : /^720p \/ 1080p$/i;
    const perSecond = rate(rates, 'durationSecond', label);
    if (perSecond === undefined) return null;
    return perSecond * (draft.duration ?? 4);
  }

  return null;
}

export async function estimateDraftCost(draft: Draft) {
  const values = await Promise.all(
    draft.models.map(async (model) => {
      const rates = await fetchRates(model);
      return rates ? calculateModelEstimate(model, draft, rates) : null;
    }),
  );
  if (values.some((value) => value === null)) return null;
  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0) * draft.count;
}
