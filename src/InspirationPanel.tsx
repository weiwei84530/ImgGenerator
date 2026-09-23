import { useEffect, useRef, useState } from 'react';
import {
  ArrowUpLeft,
  Check,
  ChevronDown,
  Lightbulb,
  LoaderCircle,
  RefreshCw,
  Undo2,
} from 'lucide-react';
import {
  fetchInspiration,
  inspirationContext,
  promptRecords,
  type InspirationIdea,
} from './inspiration';
import type { Draft, Job } from './types';

const pendingWorks = new Set<string>();
interface Suggestions {
  source: string;
  applied?: string;
  originalPrompt: string;
  ideas: InspirationIdea[];
}

export function InspirationPanel({
  workId,
  draft,
  jobs,
  apiKey,
  showMoney,
  disabled,
  onApply,
  onSettled,
}: {
  workId: string;
  draft: Draft;
  jobs: Job[];
  apiKey: string;
  showMoney: boolean;
  disabled: boolean;
  onApply: (prompt: string) => void;
  onSettled: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestions>();
  const [lastCost, setLastCost] = useState<number>();
  const [attempted, setAttempted] = useState(false);
  const [historyLimit, setHistoryLimit] = useState(10);
  const live = useRef(true);
  const context = inspirationContext(draft);
  const latest = useRef({ context, apiKey });
  latest.current = { context, apiKey };
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  const records = promptRecords(jobs, draft.kind ?? 'image');
  const current =
    suggestions && (suggestions.source === context || suggestions.applied === context)
      ? suggestions
      : undefined;
  const canUndo = current?.applied === context && draft.prompt !== current.originalPrompt;

  const generate = async () => {
    if (disabled || busy) return;
    if (pendingWorks.has(workId)) {
      setError('這份作品正在取得靈感，請稍後再試。');
      return;
    }
    if (!apiKey) {
      setError('請先到右上角的設定輸入 API Key，再取得靈感。');
      return;
    }
    if (!navigator.onLine) {
      setError('目前離線，請連上網路後再取得靈感。');
      return;
    }
    pendingWorks.add(workId);
    setBusy(true);
    setError('');
    setLastCost(undefined);
    setAttempted(true);
    try {
      const result = await fetchInspiration(
        apiKey,
        structuredClone(draft),
        records,
        current?.ideas,
      );
      if (!live.current || latest.current.apiKey !== apiKey) return;
      setLastCost(result.cost);
      if (latest.current.context !== context) {
        setError('描述、照片或設定已改變，這次提案未套用。請依目前內容重新取得靈感。');
        return;
      }
      setSuggestions({ source: context, originalPrompt: draft.prompt, ideas: result.ideas });
    } catch (err) {
      if (live.current)
        setError(err instanceof Error ? err.message : '暫時無法取得靈感，請稍後再試。');
    } finally {
      pendingWorks.delete(workId);
      if (live.current) setBusy(false);
      onSettled();
    }
  };

  return (
    <div className="inspiration">
      <div className="inspiration-actions">
        <button
          type="button"
          className="inspiration-trigger"
          disabled={busy || disabled}
          onClick={() => void generate()}
        >
          {busy ? (
            <LoaderCircle size={18} className="spin" />
          ) : current ? (
            <RefreshCw size={17} />
          ) : (
            <Lightbulb size={18} />
          )}
          {busy ? '正在想點子…' : current ? '換一批' : '給我一點靈感'}
        </button>
        {canUndo && (
          <button
            type="button"
            className="text-button inspiration-undo"
            disabled={busy || disabled}
            onClick={() => {
              onApply(current.originalPrompt);
              setSuggestions({ ...current, applied: undefined });
            }}
          >
            <Undo2 size={16} /> 復原原本描述
          </button>
        )}
      </div>
      <p className="inspiration-caption">
        {draft.prompt.trim()
          ? '沿著你的想法，多想四種可能。'
          : draft.refs.length
            ? '從照片出發，找找可以怎麼創作。'
            : '還沒想好也沒關係，先挑一個喜歡的方向。'}
      </p>
      {busy && (
        <p className="hint" role="status">
          {draft.refs.length ? '正在看照片，整理四個提案…' : '正在整理四個提案…'}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {current && (
        <div className="inspiration-results" aria-label="靈感提案" aria-busy={busy}>
          <p className="inspiration-guidance">選一個填入描述，還可以繼續修改。</p>
          <div className="inspiration-grid">
            {current.ideas.map((idea, index) => {
              const selected = current.applied === context && draft.prompt === idea.prompt;
              return (
                <button
                  key={`${index}:${idea.title}`}
                  type="button"
                  className="inspiration-idea"
                  aria-pressed={selected}
                  disabled={busy || disabled}
                  onClick={() => {
                    onApply(idea.prompt);
                    setSuggestions({
                      ...current,
                      applied: inspirationContext({ ...draft, prompt: idea.prompt }),
                    });
                  }}
                >
                  <span className="idea-heading">
                    <span className="idea-number">{String(index + 1).padStart(2, '0')}</span>
                    <strong>{idea.title}</strong>
                  </span>
                  <span className="idea-prompt">{idea.prompt}</span>
                  <span className="idea-apply">
                    {selected ? <Check size={15} /> : <ArrowUpLeft size={15} />}
                    {selected ? '已填入描述' : '用這個想法'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {showMoney && (
        <p className="inspiration-cost">
          每次取得靈感或換一批，皆由 Runware 依用量計費。
          {attempted && !busy && (
            <span>
              {lastCost === undefined
                ? ' 這次費用未取得，請以 Runware 紀錄為準。'
                : ` 這次靈感費用：US$ ${lastCost.toFixed(6)}。`}
            </span>
          )}
        </p>
      )}
      <details className="inspiration-details">
        <summary>
          靈感怎麼參考我的描述？
          <ChevronDown size={15} />
        </summary>
        <p>
          只記錄按下生成後採用的描述，保存在這台裝置；圖片與影片分開參考。同次生成多張只算一次。草稿、刪掉的文字與未採用的提案不會作為偏好。
        </p>
        <p>
          取得靈感時，目前描述、照片及部分近期採用紀錄會傳送至 Runware
          與必要的上游服務。本機保存不代表雲端服務不會處理或保存內容。
        </p>
        <p>紀錄隨作品備份；刪除作品也會移除對應紀錄。各裝置不會自動同步。</p>
        <strong className="prompt-history-heading">
          已採用的{draft.kind === 'video' ? '影片' : '圖片'}描述 · {records.length} 筆
        </strong>
        {records.length ? (
          <>
            <ol className="prompt-history">
              {records.slice(0, historyLimit).map((record) => (
                <li key={record.batchId}>
                  <time dateTime={new Date(record.createdAt).toISOString()}>
                    {new Date(record.createdAt).toLocaleDateString('zh-TW')}
                  </time>
                  <p>{record.prompt}</p>
                </li>
              ))}
            </ol>
            {records.length > historyLimit && (
              <button
                type="button"
                className="text-button"
                onClick={() => setHistoryLimit((limit) => limit + 10)}
              >
                顯示更早的描述
              </button>
            )}
          </>
        ) : (
          <p>還沒有採用紀錄。先從這次的想法開始就好。</p>
        )}
      </details>
    </div>
  );
}
