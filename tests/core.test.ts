import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { initialPreferences } from '../src/preferences';
import { buildRequest, dimensions } from '../src/models';
import { newDraft, type Job, type Work } from '../src/types';
import {
  addJobs,
  clearWorks,
  database,
  getMedia,
  removeWork,
  saveMedia,
  saveWork,
} from '../src/db';
import { exportBackup, importBackup } from '../src/backup';

afterEach(async () => {
  await clearWorks();
});
describe('preferences', () => {
  it('only uses the hidden URL default before a preference exists', () => {
    expect(initialPreferences(null, '').showMoney).toBe(true);
    expect(initialPreferences(null, '?costs=hidden').showMoney).toBe(false);
    expect(initialPreferences('{"showMoney":true}', '?costs=hidden').showMoney).toBe(true);
    expect(initialPreferences('{"showMoney":false}', '').showMoney).toBe(false);
    expect(initialPreferences('broken', '?costs=hidden').showMoney).toBe(false);
  });
});
describe('Runware request capabilities', () => {
  it('passes identical prompts and references to both models with their supported dimensions', () => {
    const draft = {
      ...newDraft(),
      prompt: '保留照片人物，換成水彩風格',
      refs: ['local-photo'],
      count: 2,
    };
    const banana = buildRequest('task', 'banana', draft, ['data:image/png;base64,test']);
    const gpt = buildRequest('task', 'gpt', draft, ['data:image/png;base64,test']);
    expect(banana.inputs).toEqual(gpt.inputs);
    expect(banana.positivePrompt).toBe(gpt.positivePrompt);
    expect(banana.model).toBe('google:4@3');
    expect(gpt.model).toBe('openai:gpt-image@2');
    expect(banana.height).toBe(1376);
    expect(gpt.height).toBe(1360);
    expect(gpt.numberResults).toBe(1);
    expect(gpt.deliveryMethod).toBe('async');
    expect(gpt.outputType).toBe('dataURI');
    expect(() => buildRequest('task', 'gpt', draft, [])).toThrow('參考照片');
  });
  it('keeps every GPT size inside the documented bounds and preserves advanced options', () => {
    for (const ratio of ['portrait', 'square', 'landscape'] as const)
      for (const resolution of ['1K', '2K'] as const) {
        const size = dimensions('gpt', { ...newDraft(), ratio, resolution });
        expect(size.width % 16).toBe(0);
        expect(size.height % 16).toBe(0);
        expect(size.width * size.height).toBeGreaterThanOrEqual(655360);
        expect(size.width * size.height).toBeLessThanOrEqual(8294400);
      }
    const request = buildRequest(
      'task',
      'gpt',
      { ...newDraft(), prompt: '一朵向日葵', gptBackground: 'transparent', gptQuality: 'high' },
      [],
    );
    expect('settings' in request && request.settings).toEqual({ background: 'transparent' });
    expect(request.providerSettings?.openai).toEqual({ quality: 'high' });
    expect(request.outputFormat).toBe('PNG');
  });
});
function fixture(): { work: Work; job: Job; mediaId: string } {
  const mediaId = crypto.randomUUID();
  const work = {
    id: crypto.randomUUID(),
    title: '測試作品',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    draft: { ...newDraft(), refs: [mediaId], prompt: '花園中的貓咪' },
  };
  const job: Job = {
    id: crypto.randomUUID(),
    workId: work.id,
    model: 'banana',
    batchId: crypto.randomUUID(),
    createdAt: Date.now(),
    status: 'succeeded',
    draft: work.draft,
    keyTag: 'private-fingerprint',
    mediaId,
    cost: 0.1,
  };
  return { work, job, mediaId };
}
describe('local data and backups', () => {
  it('atomically blocks concurrent paid batches for a work', async () => {
    const { work, job } = fixture();
    await saveWork(work);
    const result = await Promise.allSettled([
      addJobs([{ ...job, status: 'queued' }]),
      addJobs([{ ...job, id: crypto.randomUUID(), status: 'queued' }]),
    ]);
    expect(result.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await (await database).count('jobs')).toBe(1);
  });
  it('roundtrips image bytes without credentials and adds copies without overwriting existing work', async () => {
    const { work, job, mediaId } = fixture();
    await saveWork(work);
    await addJobs([job]);
    await saveMedia({
      id: mediaId,
      blob: new Blob(['actual-image-bytes'], { type: 'image/png' }),
      name: 'photo.png',
    });
    const blob = await exportBackup();
    expect(await blob.text()).not.toContain('private-fingerprint');
    await importBackup(new File([blob], 'backup.zip'));
    const works = await (await database).getAll('works');
    expect(works).toHaveLength(2);
    const copied = works.find((w) => w.id !== work.id)!;
    expect(copied.draft.refs[0]).not.toBe(mediaId);
    expect(await (await getMedia(copied.draft.refs[0]))!.blob.text()).toBe('actual-image-bytes');
    await removeWork(work.id);
    expect(await (await database).count('works')).toBe(1);
    expect(await getMedia(copied.draft.refs[0])).toBeDefined();
  });
  it('retains an image referenced from another work', async () => {
    const { work, job, mediaId } = fixture();
    await saveWork(work);
    await addJobs([job]);
    await saveMedia({
      id: mediaId,
      blob: new Blob(['image'], { type: 'image/png' }),
      name: 'photo.png',
    });
    await saveWork({ ...work, id: crypto.randomUUID() });
    await removeWork(work.id);
    expect(await getMedia(mediaId)).toBeDefined();
  });
  it('rejects malformed backups without modifying the library', async () => {
    await expect(importBackup(new File(['not a zip'], 'bad.zip'))).rejects.toThrow();
    expect(await (await database).count('works')).toBe(0);
  });
});
