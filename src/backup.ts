import { unzip, zip, strFromU8, strToU8 } from 'fflate';
import { z } from 'zod';
import { asMedia, changed, database, mediaRecord } from './db';
import type { Job, Media, Work } from './types';

const id = z.string().uuid();
const draftSchema = z.object({
  prompt: z.string().max(32000),
  models: z.array(z.enum(['banana', 'gpt'])).max(2),
  ratio: z.enum(['portrait', 'square', 'landscape']),
  resolution: z.enum(['1K', '2K']),
  count: z.number().int().min(1).max(4),
  refs: z.array(id).max(4),
  googleSearch: z.boolean(),
  gptQuality: z.enum(['auto', 'low', 'medium', 'high']),
  gptBackground: z.enum(['auto', 'opaque', 'transparent']),
});
const workSchema = z.object({
  id,
  title: z.string().max(100),
  createdAt: z.number().finite(),
  updatedAt: z.number().finite(),
  draft: draftSchema,
});
const jobSchema = z.object({
  id,
  workId: id,
  batchId: id,
  model: z.enum(['banana', 'gpt']),
  createdAt: z.number().finite(),
  draft: draftSchema,
  status: z.enum(['queued', 'sending', 'processing', 'unknown', 'failed', 'succeeded']),
  mediaId: id.optional(),
  cost: z.number().nonnegative().finite().optional(),
});
const manifestSchema = z.object({
  version: z.literal(1),
  works: z.array(workSchema).max(10000),
  jobs: z.array(jobSchema).max(50000),
  media: z
    .array(
      z.object({
        id,
        type: z.enum(['image/png', 'image/jpeg', 'image/webp']),
        name: z.string().max(255),
      }),
    )
    .max(50000),
});
export async function exportBackup(): Promise<Blob> {
  const tx = (await database).transaction(['works', 'jobs', 'media']);
  const [works, jobs, media] = await Promise.all([
    tx.objectStore('works').getAll(),
    tx.objectStore('jobs').getAll(),
    tx.objectStore('media').getAll(),
  ]);
  await tx.done;
  const used = new Set([
    ...works.flatMap((w) => w.draft.refs),
    ...jobs.flatMap((j) => [...j.draft.refs, j.mediaId ?? '']),
  ]);
  const selected = media.filter((m) => used.has(m.id)).map(asMedia);
  if (selected.reduce((size, m) => size + m.blob.size, 0) > 240 * 1024 * 1024)
    throw new Error('作品超過單次備份容量，請先下載重要圖片並分批整理作品。');
  const manifest = {
    version: 1,
    works,
    jobs: jobs.map(({ keyTag: _tag, message: _message, ...job }) => job),
    media: selected.map(({ id, blob, name }) => ({ id, type: blob.type, name })),
  };
  const files: Record<string, Uint8Array> = { 'manifest.json': strToU8(JSON.stringify(manifest)) };
  for (const m of selected) files[`media/${m.id}`] = new Uint8Array(await m.blob.arrayBuffer());
  const zipped = await new Promise<Uint8Array<ArrayBuffer>>((resolve, reject) =>
    zip(files, { level: 0 }, (error, data) =>
      error ? reject(error) : resolve(new Uint8Array(data)),
    ),
  );
  return new Blob([zipped], { type: 'application/zip' });
}
export async function importBackup(file: File) {
  if (file.size > 250 * 1024 * 1024) throw new Error('第一版可還原 250 MB 以內的備份。');
  let total = 0;
  let tooLarge = false;
  // Read the archive with an uncompressed-size guard before allocating entries.
  const extracted = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
    void file
      .arrayBuffer()
      .then((buffer) =>
        unzip(
          new Uint8Array(buffer),
          {
            filter: (entry) => {
              total += entry.originalSize;
              if (entry.originalSize > 50 * 1024 * 1024 || total > 500 * 1024 * 1024) {
                tooLarge = true;
                return false;
              }
              return entry.name === 'manifest.json' || /^media\/[0-9a-f-]{36}$/.test(entry.name);
            },
          },
          (error, data) => (error ? reject(new Error('備份檔案無法讀取。')) : resolve(data)),
        ),
      )
      .catch(reject);
  });
  if (tooLarge || !extracted['manifest.json']) throw new Error('備份過大或缺少作品清單。');
  const parsed = manifestSchema.safeParse(JSON.parse(strFromU8(extracted['manifest.json'])));
  if (!parsed.success) throw new Error('這不是支援的拾光畫室備份格式。');
  const data = parsed.data;
  const remap = new Map<string, string>();
  const mapId = (old: string) => {
    if (!remap.has(old)) remap.set(old, crypto.randomUUID());
    return remap.get(old)!;
  };
  const media: Media[] = data.media.map((m) => {
    const bytes = extracted[`media/${m.id}`];
    if (!bytes?.length) throw new Error('備份缺少圖片，尚未匯入任何作品。');
    return {
      id: mapId(m.id),
      name: m.name,
      blob: new Blob([new Uint8Array(bytes)], { type: m.type }),
    };
  });
  const mediaIds = new Set(data.media.map((m) => m.id));
  const workIds = new Set(data.works.map((w) => w.id));
  for (const d of [...data.works.map((w) => w.draft), ...data.jobs.map((j) => j.draft)])
    if (d.refs.some((ref) => !mediaIds.has(ref))) throw new Error('備份缺少參考照片。');
  for (const j of data.jobs)
    if (
      !workIds.has(j.workId) ||
      (j.mediaId && !mediaIds.has(j.mediaId)) ||
      (j.status === 'succeeded' && !j.mediaId)
    )
      throw new Error('備份作品資料不完整。');
  const works: Work[] = data.works.map((w) => ({
    ...w,
    id: mapId(w.id),
    draft: { ...w.draft, refs: w.draft.refs.map(mapId) },
  }));
  const jobs: Job[] = data.jobs.map((j) => ({
    ...j,
    id: mapId(j.id),
    workId: mapId(j.workId),
    batchId: mapId(j.batchId),
    draft: { ...j.draft, refs: j.draft.refs.map(mapId) },
    mediaId: j.mediaId ? mapId(j.mediaId) : undefined,
    keyTag: '',
    status: j.status === 'succeeded' ? 'succeeded' : 'unknown',
    message: '此為備份中的未完成紀錄，不會自動重新生成。',
  }));
  const records = await Promise.all(media.map(mediaRecord));
  const tx = (await database).transaction(['works', 'jobs', 'media'], 'readwrite');
  void tx.done.catch(() => {});
  for (const m of records) await tx.objectStore('media').add(m);
  for (const w of works) await tx.objectStore('works').add(w);
  for (const j of jobs) await tx.objectStore('jobs').add(j);
  await tx.done;
  changed();
  return works.length;
}
