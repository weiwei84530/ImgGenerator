import type { Job, Work } from './types';

export function visibleWorks(works: Work[], jobs: Job[]) {
  const recorded = new Set(jobs.map((job) => job.workId));
  return works.filter(
    (work) => work.draft.prompt.trim() || work.draft.refs.length || recorded.has(work.id),
  );
}

export function workPreview(work: Work, jobs: Job[]) {
  const results = jobs.filter(
    (job) => job.workId === work.id && job.mediaId && job.status === 'succeeded',
  );
  return results.sort((a, b) => b.createdAt - a.createdAt)[0]?.mediaId ?? work.draft.refs.at(-1);
}
