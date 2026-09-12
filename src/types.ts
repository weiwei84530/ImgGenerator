export type ModelId = 'banana' | 'gpt';
export type Ratio = 'portrait' | 'square' | 'landscape';
export interface Draft {
  prompt: string;
  models: ModelId[];
  ratio: Ratio;
  resolution: '1K' | '2K';
  count: number;
  refs: string[];
  googleSearch: boolean;
  gptQuality: 'auto' | 'low' | 'medium' | 'high';
  gptBackground: 'auto' | 'opaque' | 'transparent';
}
export interface Work {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  draft: Draft;
}
export type JobStatus = 'queued' | 'sending' | 'processing' | 'unknown' | 'failed' | 'succeeded';
export interface Job {
  id: string;
  workId: string;
  batchId: string;
  model: ModelId;
  status: JobStatus;
  createdAt: number;
  draft: Draft;
  keyTag: string;
  mediaId?: string;
  cost?: number;
  message?: string;
}
export interface Media {
  id: string;
  blob: Blob;
  name: string;
}
export interface Preferences {
  showMoney: boolean;
}
export interface Balance {
  amount: number;
  freeBalance?: number;
  currency: string;
}
export const newDraft = (): Draft => ({
  prompt: '',
  models: ['banana', 'gpt'],
  ratio: 'portrait',
  resolution: '1K',
  count: 1,
  refs: [],
  googleSearch: false,
  gptQuality: 'auto',
  gptBackground: 'auto',
});
export const isActive = (job: Job) => ['queued', 'sending', 'processing'].includes(job.status);
