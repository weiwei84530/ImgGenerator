import { draftSchema } from './draft-schema';
import { currentDraft, modelsFor } from './models';
import { newDraft, newVideoDraft, type Draft, type WorkKind } from './types';

const storageKey = (kind: WorkKind) => `img-generator.defaults.${kind}`;

export function rememberDraft(draft: Draft) {
  const parsed = draftSchema.parse(draft);
  const { prompt: _prompt, refs: _refs, ...settings } = parsed;
  localStorage.setItem(storageKey(draft.kind ?? 'image'), JSON.stringify(settings));
}

export function rememberedDraft(kind: WorkKind): Draft {
  const fallback = kind === 'video' ? newVideoDraft() : newDraft();
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(kind)) ?? 'null');
    if (!saved || typeof saved !== 'object') return fallback;
    const parsed = draftSchema.safeParse({ ...fallback, ...saved, kind, prompt: '', refs: [] });
    if (!parsed.success) return fallback;
    const draft = currentDraft(parsed.data);
    if (draft.models.some((m) => !modelsFor(kind).includes(m))) return fallback;
    return draft;
  } catch {
    return fallback;
  }
}

export function clearDraftDefaults() {
  localStorage.removeItem(storageKey('image'));
  localStorage.removeItem(storageKey('video'));
}
