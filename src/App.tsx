import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  ChevronDown,
  ExternalLink,
  Eye,
  EyeOff,
  FolderHeart,
  ImagePlus,
  Images,
  Leaf,
  LoaderCircle,
  Minus,
  Plus,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
  Film,
  Play,
  Smartphone,
} from 'lucide-react';
import { clearWorks, getMedia, removeWork, saveWork, snapshot } from './db';
import { exportBackup, importBackup } from './backup';
import { queueGeneration, resumeJobs, runJob } from './engine';
import { dimensions, models, modelsFor, promptLimit, supports1080 } from './models';
import { rememberDraft, rememberedDraft, clearDraftDefaults } from './draft-defaults';
import { download, importPhoto } from './media';
import {
  readKey,
  readPreferences,
  resetPreferences,
  saveKey,
  savePreferences,
} from './preferences';
import { fetchBalance, keyTag, validateKey } from './runware';
import { estimateDraftCost } from './pricing';
import googleLogo from './assets/providers/google.png';
import openaiLogo from './assets/providers/openai.png';
import bflLogo from './assets/providers/bfl.png';
import bytedanceLogo from './assets/providers/bytedance.png';
import klingLogo from './assets/providers/kling.png';
import {
  isActive,
  isVideo,
  type Balance,
  type Draft,
  type Job,
  type Preferences,
  type Work,
  type WorkKind,
} from './types';

const REPO = 'https://github.com/weiwei84530/ImgGenerator';
const STUDIO = 'https://weiweistudio.com';
const money = (value: number) => `US$ ${value.toFixed(4).replace(/0{1,2}$/, '')}`;
const date = (value: number) =>
  new Intl.DateTimeFormat('zh-TW', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
type Notify = (message: string) => void;
type Screen = 'home' | 'work' | 'library';
type WorkTab = 'edit' | 'results';
interface NavigationState {
  studio: true;
  screen: Screen;
  workId?: string;
  workTab?: WorkTab;
  overlay?: 'settings' | 'viewer';
  jobId?: string;
}

const providerLogos = {
  banana: googleLogo,
  gpt: openaiLogo,
  flux: bflLogo,
  seedream: bytedanceLogo,
  kling: klingLogo,
  seedance: bytedanceLogo,
  veo: googleLogo,
} as const;

const isSystemTitle = (title: string) => ['還沒命名的作品', '從照片開始的新作品'].includes(title);

function ModelMark({ model }: { model: keyof typeof providerLogos }) {
  return (
    <span className={`model-icon ${model}`}>
      <img src={providerLogos[model]} alt="" />
    </span>
  );
}

function LocalImage({
  id,
  alt,
  className,
  controls = false,
}: {
  id: string;
  alt: string;
  className?: string;
  controls?: boolean;
}) {
  const [url, setUrl] = useState('');
  const [video, setVideo] = useState(false);
  const [playbackError, setPlaybackError] = useState(false);
  useEffect(() => {
    setPlaybackError(false);
    let alive = true;
    let objectUrl = '';
    void getMedia(id)
      .then((media) => {
        if (alive && media) {
          setVideo(media.blob.type === 'video/mp4');
          objectUrl = URL.createObjectURL(media.blob);
          setUrl(objectUrl);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);
  return url ? (
    video ? (
      <>
        <video
          src={url}
          aria-label={alt}
          className={className}
          controls={controls}
          muted={!controls}
          playsInline
          preload="metadata"
          onError={() => setPlaybackError(true)}
        />
        {controls && playbackError && (
          <p className="hint" role="status">
            這個瀏覽器無法播放影片，請使用下方「下載影片」後開啟。
          </p>
        )}
      </>
    ) : (
      <img src={url} alt={alt} className={className} />
    )
  ) : (
    <div className="image-placeholder">
      <Images aria-hidden="true" />
      <span>載入作品</span>
    </div>
  );
}

function Modal({
  title,
  close,
  children,
  wide = false,
  notice,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
  wide?: boolean;
  notice?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = old;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? 'modal viewer' : 'modal'}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      aria-label={title}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="icon-button" onClick={close} aria-label="關閉">
          <X />
        </button>
      </div>
      {notice && (
        <div className="modal-notice" role="status">
          {notice}
        </div>
      )}
      {children}
    </dialog>
  );
}

function KeyForm({
  onSuccess,
  notify,
  replacing = false,
}: {
  onSuccess: (key: string) => void;
  notify: Notify;
  replacing?: boolean;
}) {
  const [input, setInput] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setError('');
        try {
          const key = input.trim();
          if (!key) throw new Error('請輸入 Runware API Key。');
          await validateKey(key);
          saveKey(key);
          onSuccess(key);
          setInput('');
          notify(replacing ? '已更換 API Key。' : '服務已連線，開始創作吧。');
        } catch (err) {
          setError(err instanceof Error ? err.message : '無法連線，請稍後再試。');
        } finally {
          setBusy(false);
        }
      }}
    >
      <label htmlFor={replacing ? 'replacement-key' : 'api-key'}>Runware API Key</label>
      <div className="key-input">
        <input
          id={replacing ? 'replacement-key' : 'api-key'}
          type={visible ? 'text' : 'password'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="貼上你的 API Key"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          required
          disabled={busy}
        />
        <button
          type="button"
          className="icon-button"
          aria-label={visible ? '隱藏 Key' : '顯示 Key'}
          onClick={() => setVisible(!visible)}
        >
          {visible ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </div>
      <p className="hint">驗證成功後會記住這台裝置。請在你信任的瀏覽器使用。</p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="primary full" disabled={busy || !input.trim()}>
        {busy ? <LoaderCircle className="spin" /> : <ArrowRight />}
        {busy ? '正在確認服務…' : replacing ? '驗證並更換 Key' : '連線，開始創作'}
      </button>
    </form>
  );
}

function Welcome({ onSuccess, notify }: { onSuccess: (key: string) => void; notify: Notify }) {
  return (
    <div className="welcome">
      <div className="welcome-hero">
        <div>
          <div className="eyebrow">
            <span /> A LITTLE SPACE FOR IDEAS
          </div>
          <h1>
            把美好，<em>慢慢畫出來。</em>
          </h1>
          <p className="intro">用一句話或一張照片，開始創作。</p>
        </div>
        <div className="paper-art" aria-hidden="true">
          <div className="art-card art-back">
            <div className="art-sun" />
            <div className="art-hill" />
          </div>
          <div className="art-card art-front">
            <div className="art-flower">
              <i />
              <i />
              <i />
              <i />
              <i />
              <b />
            </div>
          </div>
        </div>
      </div>
      <section className="card setup-card">
        <div className="section-kicker">只需設定一次</div>
        <h2>設定服務</h2>
        <KeyForm onSuccess={onSuccess} notify={notify} />
        <a className="small-link" href="https://runware.ai" target="_blank" rel="noreferrer">
          前往 Runware 取得 API Key <ExternalLink size={13} />
        </a>
      </section>
      <p className="welcome-privacy">
        <ShieldCheck size={16} /> Key 與作品保存在這台裝置；生成內容會傳送至 Runware。
      </p>
    </div>
  );
}

function MoneyBadge({
  balance,
  loading,
  refresh,
}: {
  balance: Balance | null;
  loading: boolean;
  refresh: () => void;
}) {
  return (
    <button className="balance" onClick={refresh} disabled={loading} aria-label="重新查詢餘額">
      {loading ? '餘額查詢中…' : balance ? `餘額 ${money(balance.amount)}` : '餘額暫時無法讀取'}
      {balance?.freeBalance !== undefined && balance.freeBalance > 0 && (
        <span>另有贈額 {money(balance.freeBalance)}</span>
      )}
    </button>
  );
}

function Workspace({
  work,
  jobs,
  apiKey,
  showMoney,
  initialTab,
  notify,
  openImage,
}: {
  work: Work;
  jobs: Job[];
  apiKey: string;
  showMoney: boolean;
  initialTab: WorkTab;
  notify: Notify;
  openImage: (job: Job) => void;
}) {
  const [draft, setDraft] = useState<Draft>(work.draft);
  const latestDraft = useRef(draft);
  const [tab, setTab] = useState<WorkTab>(initialTab);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [addModel, setAddModel] = useState(false);
  const submitLock = useRef(false);
  const latestSave = useRef<Promise<void>>(Promise.resolve());
  const [saveError, setSaveError] = useState(false);
  const [estimatedCost, setEstimatedCost] = useState<number | null>(null);
  const active = jobs.some(isActive);
  const total = draft.models.length * draft.count;
  const video = isVideo(draft);
  const unit = video ? '支' : '張';
  const mediaName = video ? '影片' : '圖片';
  const availableModels = modelsFor(video ? 'video' : 'image');
  const maxRefs = video ? 1 : 4;
  const advancedModels = draft.models.filter((model) =>
    ['banana', 'gpt', 'seedream', 'kling'].includes(model),
  );
  useEffect(() => {
    let live = true;
    setEstimatedCost(null);
    if (showMoney && draft.models.length) {
      void estimateDraftCost(draft).then((value) => {
        if (live) setEstimatedCost(value);
      });
    }
    return () => {
      live = false;
    };
  }, [draft, showMoney]);
  const update = (patch: Partial<Draft>) => {
    const next = { ...latestDraft.current, ...patch };
    if (isVideo(next) && next.videoResolution === '1080p' && !supports1080(next)) {
      next.videoResolution = '720p';
      notify('已切換為所選模型共同支援的 720p。');
    }
    if (isVideo(next) && next.ratio === 'square' && next.models.includes('veo')) {
      next.ratio = 'portrait';
      notify('Veo 不提供方形選項，已切換為手機直向；有照片時依照片調整。');
    }
    try {
      rememberDraft(next);
    } catch {
      notify('這次設定無法記住，請檢查瀏覽器儲存空間。');
    }
    latestDraft.current = next;
    setDraft(next);
    const updated = {
      ...work,
      title: next.prompt.trim().slice(0, 36) || '還沒命名的作品',
      draft: next,
      updatedAt: Date.now(),
    };
    latestSave.current = saveWork(updated)
      .then(() => setSaveError(false))
      .catch(() => {
        setSaveError(true);
      });
  };
  const submit = async (target = draft) => {
    if (submitLock.current || active || uploading) return;
    if (!navigator.onLine) {
      notify('目前離線，請連上網路後再開始生成。');
      return;
    }
    submitLock.current = true;
    setSubmitting(true);
    try {
      await latestSave.current;
      await saveWork({
        ...work,
        draft,
        title: draft.prompt.trim().slice(0, 36) || work.title,
        updatedAt: Date.now(),
      });
      await queueGeneration(work.id, target, apiKey);
      setTab('results');
    } catch (err) {
      notify(err instanceof Error ? err.message : '尚未送出，請確認儲存空間後再試。');
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };
  return (
    <>
      <div className="tabs" role="tablist" aria-label="工作區">
        <button role="tab" aria-selected={tab === 'edit'} onClick={() => setTab('edit')}>
          <Sparkles size={18} />
          編輯畫面
        </button>
        <button role="tab" aria-selected={tab === 'results'} onClick={() => setTab('results')}>
          <Images size={18} />
          本次作品{' '}
          <span className="count">{jobs.filter((j) => j.status === 'succeeded').length}</span>
          {active && <span className="working-dot" />}
        </button>
      </div>
      {saveError && (
        <p className="error" role="alert">
          草稿尚未保存。請確認裝置儲存空間，暫時不要離開。
        </p>
      )}
      {tab === 'edit' ? (
        <div className="editor" role="tabpanel" aria-label="編輯畫面">
          <section className="card prompt-card">
            <label className="section-label" htmlFor="prompt">
              <span className="step">01</span>描述你的想法
            </label>
            <textarea
              id="prompt"
              value={draft.prompt}
              maxLength={32000}
              placeholder={
                video
                  ? draft.refs.length
                    ? '例如：讓照片中的花朵隨風輕輕搖動，鏡頭緩慢靠近。'
                    : '例如：午後花園裡，一隻橘貓伸懶腰，陽光灑落，鏡頭緩慢靠近。'
                  : draft.refs.length
                    ? '想怎麼修改這張照片？例如：保留人物，把背景換成溫暖的花園。'
                    : '例如：一隻橘貓坐在窗邊，午後陽光灑在牠身上，溫柔的水彩風格…'
              }
              onChange={(e) => update({ prompt: e.target.value })}
              rows={5}
            />
            <div className="prompt-footer">
              <Leaf size={15} />
              <span>
                {video
                  ? draft.refs.length
                    ? '照片會作為影片的起始畫面'
                    : '描述動作、鏡頭與想要的氛圍'
                  : draft.refs.length
                    ? '這次會以你上傳的照片進行修改'
                    : '像跟朋友說話一樣，自然描述就好'}
              </span>
            </div>
            {draft.prompt.length > promptLimit(draft) && (
              <p className="error" role="alert">
                目前模型最多接受 {promptLimit(draft).toLocaleString()} 字，請縮短描述。
              </p>
            )}
            <div className="refs">
              {draft.refs.map((ref, index) => (
                <div className="ref-image" key={ref}>
                  <LocalImage id={ref} alt={`參考照片 ${index + 1}`} />
                  <button
                    aria-label={`移除參考照片 ${index + 1}`}
                    onClick={() => update({ refs: draft.refs.filter((r) => r !== ref) })}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              {draft.refs.length < maxRefs && (
                <label className="upload-button">
                  <ImagePlus size={21} />
                  <span>
                    {uploading ? '讀取照片中…' : '加入照片'}
                    <small>選填 · 最多 {maxRefs} 張</small>
                  </span>
                  <input
                    type="file"
                    aria-label="加入照片"
                    accept="image/jpeg,image/png,image/webp"
                    multiple={!video}
                    disabled={uploading}
                    onChange={async (e) => {
                      const files = Array.from(e.target.files ?? []);
                      e.target.value = '';
                      if (files.length + draft.refs.length > maxRefs) {
                        notify(`最多可加入 ${maxRefs} 張參考照片。`);
                        return;
                      }
                      setUploading(true);
                      try {
                        const refs = [];
                        for (const file of files) refs.push(await importPhoto(file));
                        update({ refs: [...draft.refs, ...refs] });
                      } catch (err) {
                        notify(err instanceof Error ? err.message : '照片無法保存。');
                      } finally {
                        setUploading(false);
                      }
                    }}
                  />
                </label>
              )}
            </div>
          </section>
          <section className="card">
            <div className="section-row">
              <h2 className="section-label">
                <span className="step">02</span>選擇創作 AI
              </h2>
              <span className="subtle-pill">已選 {draft.models.length} 個</span>
            </div>
            <div className="model-list">
              {draft.models.map((model) => (
                <div className="model-card" key={model}>
                  <ModelMark model={model} />
                  <div>
                    <strong>{models[model].name}</strong>
                    <small>{models[model].note}</small>
                  </div>
                  <button
                    className="icon-button"
                    aria-label={`移除 ${models[model].name}`}
                    onClick={() => update({ models: draft.models.filter((m) => m !== model) })}
                  >
                    <Minus size={20} />
                  </button>
                </div>
              ))}
            </div>
            {draft.models.length < availableModels.length && (
              <div className="add-model-row">
                {addModel ? (
                  <select
                    aria-label="選擇新增模型"
                    defaultValue=""
                    autoFocus
                    onBlur={(event) => {
                      if (!event.currentTarget.value) setAddModel(false);
                    }}
                    onChange={(event) => {
                      const model = event.target.value as (typeof availableModels)[number];
                      if (model) update({ models: [...draft.models, model] });
                      setAddModel(false);
                    }}
                  >
                    <option value="" disabled>
                      選擇模型
                    </option>
                    {availableModels
                      .filter((model) => !draft.models.includes(model))
                      .map((model) => (
                        <option value={model} key={model}>
                          {models[model].name}
                        </option>
                      ))}
                  </select>
                ) : (
                  <span>新增模型</span>
                )}
                <button
                  className="icon-button"
                  aria-label={addModel ? '取消新增模型' : '新增模型'}
                  onClick={() => setAddModel(!addModel)}
                >
                  {addModel ? <X size={18} /> : <Plus size={20} />}
                </button>
              </div>
            )}
            <p className="hint">每個 AI 都會使用同一段描述與相同照片。</p>
          </section>
          <section className="card">
            <h2 className="section-label">
              <span className="step">03</span>畫面的樣子
            </h2>
            {video && draft.refs.length > 0 ? (
              <p className="hint">
                影片比例依起始照片調整。Veo 會補邊適配直向或橫向，保留照片內容；實際尺寸由模型決定。
              </p>
            ) : (
              <fieldset>
                <legend>{mediaName}比例</legend>
                <div className="ratio-options">
                  {(['portrait', 'square', 'landscape'] as const).map((ratio, index) => (
                    <button
                      key={ratio}
                      type="button"
                      aria-pressed={draft.ratio === ratio}
                      disabled={video && ratio === 'square' && draft.models.includes('veo')}
                      onClick={() => update({ ratio })}
                    >
                      <span className={`ratio-shape ${ratio}`} />
                      <strong>{['手機直向', '方形', '橫向'][index]}</strong>
                      <small>{['約 9 : 16', '1 : 1', '約 16 : 9'][index]}</small>
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
            <div className="setting-row">
              <label htmlFor="resolution">
                清晰度<small>較高解析度需要更多時間</small>
              </label>
              <select
                id="resolution"
                value={video ? (draft.videoResolution ?? '720p') : draft.resolution}
                onChange={(e) =>
                  video
                    ? update({ videoResolution: e.target.value as Draft['videoResolution'] })
                    : update({ resolution: e.target.value as Draft['resolution'] })
                }
              >
                {video ? (
                  <>
                    <option value="720p">標準 · 720p</option>
                    <option value="1080p" disabled={!supports1080(draft)}>
                      細緻 · 1080p（限 Veo）
                    </option>
                  </>
                ) : (
                  <>
                    <option value="1K">標準 · 1K</option>
                    <option value="2K">細緻 · 2K</option>
                  </>
                )}
              </select>
            </div>
            {video && (
              <>
                <label className="setting-row">
                  影片長度
                  <select
                    value={draft.duration ?? 4}
                    onChange={(e) => update({ duration: Number(e.target.value) })}
                  >
                    {[4, 6, 8].map((seconds) => (
                      <option value={seconds} key={seconds}>
                        {seconds} 秒
                      </option>
                    ))}
                  </select>
                </label>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={draft.audio ?? false}
                    onChange={(e) => update({ audio: e.target.checked })}
                  />
                  生成聲音
                </label>
                <p className="hint">
                  聲音由 AI 配合畫面生成，可在描述中指定音效或對白；不保證逐字準確。
                </p>
              </>
            )}
            <div className="setting-row">
              <div>
                每個 AI 生成
                <small>
                  總共會得到 {total} {unit}
                  {mediaName}
                </small>
              </div>
              <div className="stepper">
                <button
                  aria-label={video ? '減少支數' : '減少張數'}
                  disabled={draft.count <= 1}
                  onClick={() => update({ count: draft.count - 1 })}
                >
                  <Minus size={17} />
                </button>
                <span>
                  {draft.count} {unit}
                </span>
                <button
                  aria-label={video ? '增加支數' : '增加張數'}
                  disabled={draft.count >= (video ? 2 : 4)}
                  onClick={() => update({ count: draft.count + 1 })}
                >
                  <Plus size={17} />
                </button>
              </div>
            </div>
            {advancedModels.length > 0 && (
              <details className="advanced">
                <summary>
                  <Settings2 size={17} />
                  進階設定
                  <ChevronDown size={17} />
                </summary>
                {advancedModels.map((model) => (
                  <div className="advanced-model" key={model}>
                    <strong>{models[model].name}</strong>
                    <small>
                      {video && draft.refs.length
                        ? '依照片決定尺寸'
                        : `輸出 ${dimensions(model, draft).width} × ${dimensions(model, draft).height} px`}{' '}
                      · {video ? 'MP4' : 'PNG'}
                    </small>
                    {model === 'banana' ? (
                      <label className="check-row">
                        <input
                          type="checkbox"
                          checked={draft.googleSearch}
                          onChange={(e) => update({ googleSearch: e.target.checked })}
                        />
                        參考網路資料生成圖片
                      </label>
                    ) : model === 'gpt' ? (
                      <>
                        <label className="setting-row">
                          繪製品質
                          <select
                            value={draft.gptQuality}
                            onChange={(e) =>
                              update({ gptQuality: e.target.value as Draft['gptQuality'] })
                            }
                          >
                            <option value="auto">自動</option>
                            <option value="low">快速</option>
                            <option value="medium">標準</option>
                            <option value="high">精細</option>
                          </select>
                        </label>
                        <label className="setting-row">
                          背景
                          <select
                            value={draft.gptBackground}
                            onChange={(e) =>
                              update({ gptBackground: e.target.value as Draft['gptBackground'] })
                            }
                          >
                            <option value="auto">自動</option>
                            <option value="opaque">一般背景</option>
                            <option value="transparent">透明背景</option>
                          </select>
                        </label>
                      </>
                    ) : model === 'seedream' ? (
                      <label className="check-row">
                        <input
                          type="checkbox"
                          checked={draft.seedreamThinking ?? true}
                          onChange={(e) => update({ seedreamThinking: e.target.checked })}
                        />
                        加強構思（可能需要更多時間）
                      </label>
                    ) : model === 'kling' ? (
                      <label className="setting-row">
                        不想出現的內容
                        <input
                          value={draft.klingNegativePrompt ?? ''}
                          maxLength={2500}
                          onChange={(e) => update({ klingNegativePrompt: e.target.value })}
                          placeholder="例如：鏡頭晃動"
                        />
                      </label>
                    ) : null}
                  </div>
                ))}
              </details>
            )}
          </section>
          <div className="submit-bar">
            <div className="submit-summary">
              <span>
                <strong>{draft.models.length}</strong> 個 AI <span className="times">×</span> 各{' '}
                <strong>{draft.count}</strong> {unit} <span className="times">=</span>{' '}
                <strong>{total}</strong> {unit}作品
              </span>
              {showMoney && estimatedCost !== null && (
                <small>預估費用 {money(estimatedCost)} · 完成後依實際用量計費</small>
              )}
            </div>
            <button
              className="primary full generate"
              disabled={
                submitting ||
                active ||
                uploading ||
                !draft.models.length ||
                draft.prompt.trim().length < 3 ||
                draft.prompt.length > promptLimit(draft)
              }
              onClick={() => void submit()}
            >
              {submitting || active ? <LoaderCircle className="spin" /> : <Sparkles size={20} />}
              {submitting
                ? '正在送出…'
                : active
                  ? '作品正在生成中'
                  : video
                    ? '開始生成影片'
                    : draft.refs.length
                      ? '開始修改照片'
                      : '開始生成圖片'}
              {!active && !submitting && <ArrowRight size={19} />}
            </button>
          </div>
        </div>
      ) : (
        <div className="results" role="tabpanel" aria-label="本次作品">
          {!jobs.length ? (
            <div className="empty-state">
              <div className="empty-icon">
                <Images size={31} />
              </div>
              <h2>美好的作品，從一個想法開始</h2>
              <p>回到編輯畫面，寫下想創作的內容吧。</p>
              <button className="secondary" onClick={() => setTab('edit')}>
                開始編輯 <ArrowRight size={17} />
              </button>
            </div>
          ) : (
            <>
              <div className="results-heading">
                <h2>本次作品</h2>
                <span>
                  {jobs.filter((j) => j.status === 'succeeded').length} {unit}作品
                </span>
              </div>
              {[...new Set(jobs.map((j) => j.batchId))].reverse().map((batch, index) => (
                <section className="batch" key={batch}>
                  <div className="batch-heading">
                    <span>第 {new Set(jobs.map((j) => j.batchId)).size - index} 次生成</span>
                    <small>{date(jobs.find((j) => j.batchId === batch)!.createdAt)}</small>
                  </div>
                  <p className="batch-prompt">
                    {jobs.find((j) => j.batchId === batch)!.draft.prompt}
                  </p>
                  <div className="result-grid">
                    {jobs
                      .filter((j) => j.batchId === batch)
                      .map((job) => (
                        <article className="result-card" key={job.id}>
                          {job.status === 'succeeded' && job.mediaId ? (
                            <button
                              className="result-image"
                              aria-label={`檢視 ${models[job.model].name} ${mediaName}`}
                              onClick={() => openImage(job)}
                            >
                              <LocalImage id={job.mediaId} alt={job.draft.prompt} />
                              <span className="zoom-hint">
                                {video ? <Play size={16} /> : <Eye size={16} />}
                                {video ? '播放' : '放大'}
                              </span>
                            </button>
                          ) : (
                            <div className={`job-placeholder ${job.status}`}>
                              {isActive(job) ? (
                                <>
                                  <LoaderCircle className="spin" size={27} />
                                  <strong>{video ? '正在製作影片' : '正在為你作畫'}</strong>
                                  <span>稍等一下，靈感正在成形</span>
                                </>
                              ) : (
                                <>
                                  <Images size={28} />
                                  <strong>
                                    {job.status === 'failed'
                                      ? video
                                        ? '這支影片尚未完成'
                                        : '這張圖尚未完成'
                                      : '等待確認結果'}
                                  </strong>
                                  <span>{job.message}</span>
                                  {job.status === 'failed' ? (
                                    <button
                                      className="secondary"
                                      disabled={submitting || active}
                                      onClick={() => {
                                        if (
                                          confirm(
                                            `重新生成這${unit}${mediaName}？這會送出新的生成請求。`,
                                          )
                                        )
                                          void submit({
                                            ...job.draft,
                                            models: [job.model],
                                            count: 1,
                                          });
                                      }}
                                    >
                                      {video ? '重新生成這支' : '重新生成這張'}
                                    </button>
                                  ) : (
                                    <button
                                      className="secondary"
                                      onClick={async () => {
                                        if (job.keyTag !== (await keyTag(apiKey))) {
                                          notify(
                                            '請切換回當時使用的 Key，才能查詢原任務。備份紀錄無法查詢。',
                                          );
                                          return;
                                        }
                                        void runJob(job.id, apiKey);
                                        notify('正在查詢原任務，不會重新生成。');
                                      }}
                                    >
                                      查詢原任務
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                          <div className="result-meta">
                            <span className={`model-dot ${job.model}`} />
                            <strong>{models[job.model].name}</strong>
                            {job.status === 'succeeded' && <Check size={14} />}
                          </div>
                          {showMoney && job.status === 'succeeded' && (
                            <p className="result-cost">
                              實際費用 {job.cost !== undefined ? money(job.cost) : '服務商未提供'}
                            </p>
                          )}
                        </article>
                      ))}
                  </div>
                </section>
              ))}
              <div className="local-note">
                <ShieldCheck size={17} />
                喜歡的作品記得下載下來，避免遺失。
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

export default function App() {
  const [apiKey, setApiKey] = useState(readKey);
  const [preferences, setPreferences] = useState<Preferences>(readPreferences);
  const [screen, setScreen] = useState<Screen>('home');
  const [workTab, setWorkTab] = useState<WorkTab>('edit');
  const [works, setWorks] = useState<Work[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [workId, setWorkId] = useState('');
  const [settings, setSettings] = useState(false);
  const [imageJob, setImageJob] = useState<Job | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [dataBusy, setDataBusy] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [loading, setLoading] = useState(true);
  const [storageError, setStorageError] = useState(false);
  const active = jobs.some(isActive);
  const notify = useCallback<Notify>((message) => setToast(message), []);
  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;
  const balanceSequence = useRef(0);
  const applyNavigation = useCallback((state: NavigationState) => {
    setScreen(state.screen);
    setWorkId(state.workId ?? '');
    setWorkTab(state.workTab ?? 'edit');
    setSettings(state.overlay === 'settings');
    setImageJob(
      state.overlay === 'viewer' && state.jobId
        ? (jobsRef.current.find((job) => job.id === state.jobId) ?? null)
        : null,
    );
    window.scrollTo({ top: 0 });
  }, []);
  const navigate = useCallback(
    (next: Omit<NavigationState, 'studio'>) => {
      const state: NavigationState = { studio: true, ...next };
      history.pushState(state, '');
      applyNavigation(state);
    },
    [applyNavigation],
  );
  const closeOverlay = useCallback((overlay: NavigationState['overlay']) => {
    const state = history.state as NavigationState | null;
    if (state?.studio && state.overlay === overlay) history.back();
    else {
      setSettings(false);
      setImageJob(null);
    }
  }, []);

  useEffect(() => {
    const initial: NavigationState = { studio: true, screen: 'home' };
    if (!(history.state as NavigationState | null)?.studio) history.replaceState(initial, '');
    else applyNavigation(history.state as NavigationState);
    const pop = (event: PopStateEvent) => {
      const state = event.state as NavigationState | null;
      applyNavigation(state?.studio ? state : initial);
    };
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, [applyNavigation]);
  const refreshBalance = useCallback(async () => {
    if (!apiKey || !preferences.showMoney) return;
    const sequence = ++balanceSequence.current;
    setBalanceLoading(true);
    try {
      const value = await fetchBalance(apiKey);
      if (sequence === balanceSequence.current) setBalance(value);
    } catch {
      if (sequence === balanceSequence.current) setBalance(null);
    } finally {
      if (sequence === balanceSequence.current) setBalanceLoading(false);
    }
  }, [apiKey, preferences.showMoney]);

  useEffect(() => {
    let live = true;
    let sequence = 0;
    const load = async () => {
      const ticket = ++sequence;
      try {
        const result = await snapshot();
        if (live && ticket === sequence) {
          setWorks(result.works);
          setJobs(result.jobs);
          setStorageError(false);
        }
      } catch {
        if (live) setStorageError(true);
      } finally {
        if (live) setLoading(false);
      }
    };
    void load();
    window.addEventListener('studio-change', load);
    return () => {
      live = false;
      window.removeEventListener('studio-change', load);
    };
  }, []);
  useEffect(() => {
    try {
      savePreferences(preferences);
    } catch {
      notify('偏好無法保存，請確認瀏覽器允許本機儲存。');
    }
  }, [preferences, notify]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 7000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const storage = () => {
      setApiKey(readKey());
      setPreferences(readPreferences());
    };
    window.addEventListener('storage', storage);
    return () => window.removeEventListener('storage', storage);
  }, []);
  useEffect(() => {
    ++balanceSequence.current;
    setBalance(null);
    setBalanceLoading(false);
    if (preferences.showMoney) void refreshBalance();
    return () => {
      ++balanceSequence.current;
    };
  }, [refreshBalance, preferences.showMoney]);
  const completed = jobs.filter((j) => j.status === 'succeeded').length;
  useEffect(() => {
    if (completed) void refreshBalance();
  }, [completed, refreshBalance]);
  useEffect(() => {
    const recover = () => {
      setOffline(!navigator.onLine);
      if (apiKey && navigator.onLine) void resumeJobs(apiKey).catch(() => setStorageError(true));
    };
    const visible = () => {
      if (document.visibilityState === 'visible') recover();
    };
    recover();
    window.addEventListener('online', recover);
    window.addEventListener('offline', recover);
    document.addEventListener('visibilitychange', visible);
    return () => {
      window.removeEventListener('online', recover);
      window.removeEventListener('offline', recover);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [apiKey]);

  const openWork = (work: Work, tab: WorkTab = 'results') =>
    navigate({ screen: 'work', workId: work.id, workTab: tab });
  const createWork = async (ref?: string, kind: WorkKind = 'image') => {
    try {
      const draft = rememberedDraft(kind);
      if (ref) draft.refs = [ref];
      const work: Work = {
        id: crypto.randomUUID(),
        title: ref ? '從照片開始的新作品' : '還沒命名的作品',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        draft,
      };
      await saveWork(work);
      setWorks((previous) => [work, ...previous.filter((w) => w.id !== work.id)]);
      openWork(work, 'edit');
      void navigator.storage?.persist?.().catch(() => {});
    } catch {
      notify('無法建立作品，請檢查裝置儲存空間。');
    }
  };
  const current = works.find((w) => w.id === workId);
  const updateKey = (key: string) => {
    setApiKey(key);
    if (settings) closeOverlay('settings');
  };
  const deleteWork = async (work: Work) => {
    if (jobs.some((j) => j.workId === work.id && isActive(j))) {
      notify('請等生成完成後再刪除。');
      return;
    }
    if (
      !confirm(
        `刪除「${work.title}」及其中的生成紀錄？這只刪除本機資料，無法復原，也不會取消服務商的任務。`,
      )
    )
      return;
    try {
      await removeWork(work.id);
      if (workId === work.id) navigate({ screen: 'library' });
      notify('已刪除這份作品。');
    } catch {
      notify('刪除失敗，請稍後再試。');
    }
  };

  return (
    <main className="shell">
      <div className="landscape-lock" role="status">
        <Smartphone size={46} />
        <strong>請將手機轉回直向</strong>
        <span>直向畫面比較容易操作畫室。</span>
      </div>
      <header className="topbar">
        <button
          className="brand"
          onClick={() => navigate({ screen: 'home' })}
          aria-label="拾光畫室首頁"
        >
          <span className="brand-symbol">
            <Sparkles size={21} />
          </span>
          <span>
            拾光畫室<small>little moments, made visible</small>
          </span>
        </button>
        {apiKey && (
          <div className="header-tools">
            <span className="connected" aria-label="Runware 已設定">
              <span />
              <b>已連線</b>
            </span>
            {preferences.showMoney && (
              <MoneyBadge
                balance={balance}
                loading={balanceLoading}
                refresh={() => void refreshBalance()}
              />
            )}
            <button
              className="icon-button settings-button"
              aria-label="設定"
              onClick={() =>
                navigate({
                  screen,
                  ...(workId ? { workId, workTab } : {}),
                  overlay: 'settings',
                })
              }
            >
              <Settings2 size={21} />
            </button>
          </div>
        )}
      </header>
      {offline && (
        <div className="notice" role="status">
          目前離線，仍可瀏覽已保存的作品。
        </div>
      )}
      {storageError && (
        <div className="error" role="alert">
          無法讀取本機儲存。請確認瀏覽器允許儲存資料，暫時不要清除瀏覽器資料。
        </div>
      )}
      {!apiKey ? (
        <Welcome onSuccess={updateKey} notify={notify} />
      ) : loading ? (
        <div className="empty-state">
          <LoaderCircle className="spin" />
          正在打開畫室…
        </div>
      ) : (
        <>
          {screen === 'home' && (
            <>
              <div className="page-heading home-heading">
                <div className="eyebrow">MAKE SOMETHING LOVELY</div>
                <h1>
                  讓想像，
                  <br />
                  <em>有一個樣子。</em>
                </h1>
                <p className="muted">你的靈感，值得被看見。</p>
              </div>
              <button
                className="create-card"
                onClick={() => void createWork()}
                disabled={storageError}
              >
                <div>
                  <h2>製作圖片</h2>
                  <p>
                    把文字變成畫面，
                    <br />
                    或為照片換一個新模樣。
                  </p>
                  <span className="create-cta">
                    開始創作 <ArrowRight size={19} />
                  </span>
                </div>
                <div className="mini-art" aria-hidden="true">
                  <span className="mini-sun" />
                  <span className="mini-hill" />
                  <Sparkles />
                </div>
              </button>
              <button
                className="create-card video-create-card"
                onClick={() => void createWork(undefined, 'video')}
                disabled={storageError}
              >
                <div>
                  <h2>製作影片</h2>
                  <p>
                    描述一段動作，
                    <br />
                    或讓喜歡的照片成為短片。
                  </p>
                  <span className="create-cta">
                    開始創作 <ArrowRight size={19} />
                  </span>
                </div>
                <div className="mini-art video-mini-art" aria-hidden="true">
                  <span className="mini-sun" />
                  <span className="mini-hill" />
                  <Sparkles />
                </div>
              </button>
              <button className="library-link" onClick={() => navigate({ screen: 'library' })}>
                <span className="library-icon">
                  <FolderHeart size={25} />
                </span>
                <div>
                  <strong>我的作品</strong>
                  <small>
                    {works.length
                      ? `${works.length} 份創作，${completed} 個已保存成果`
                      : '收藏每一次靈光乍現'}
                  </small>
                </div>
                <ArrowRight size={19} />
              </button>
              {works.length > 0 && (
                <section className="recent">
                  <div className="section-row">
                    <h2>接著上次的靈感</h2>
                  </div>
                  {works.slice(0, 3).map((work) => (
                    <button className="recent-work" key={work.id} onClick={() => openWork(work)}>
                      <span className="recent-thumbnail">
                        {jobs.find((j) => j.workId === work.id && j.mediaId)?.mediaId ? (
                          <LocalImage
                            id={jobs.find((j) => j.workId === work.id && j.mediaId)!.mediaId!}
                            alt="作品預覽"
                          />
                        ) : (
                          <Images size={23} />
                        )}
                      </span>
                      <div>
                        <strong className={isSystemTitle(work.title) ? 'system-title' : undefined}>
                          {work.title}
                        </strong>
                        <small>{date(work.updatedAt)}</small>
                      </div>
                      <ArrowRight size={17} />
                    </button>
                  ))}
                </section>
              )}
              <div className="local-note">
                <ShieldCheck size={18} />
                <span>作品只暫存在這個瀏覽器；喜歡的作品請下載，以免遺失。</span>
              </div>
            </>
          )}
          {screen === 'work' && current && (
            <Workspace
              key={`${current.id}:${workTab}`}
              work={current}
              jobs={jobs.filter((j) => j.workId === current.id)}
              apiKey={apiKey}
              showMoney={preferences.showMoney}
              initialTab={workTab}
              notify={notify}
              openImage={(job) =>
                navigate({
                  screen: 'work',
                  workId: current.id,
                  workTab,
                  overlay: 'viewer',
                  jobId: job.id,
                })
              }
            />
          )}
          {screen === 'work' && !current && (
            <div className="empty-state">
              <h2>這份作品已移除</h2>
              <button className="secondary" onClick={() => navigate({ screen: 'library' })}>
                回到我的作品
              </button>
            </div>
          )}
          {screen === 'library' && (
            <>
              <div className="page-heading compact-heading">
                <h1>我的作品</h1>
              </div>
              {!works.length ? (
                <div className="empty-state">
                  <FolderHeart size={40} />
                  <p>還沒有作品，開始第一次創作吧。</p>
                </div>
              ) : (
                <div className="work-list">
                  {works.map((work) => {
                    const result = jobs.find((j) => j.workId === work.id && j.mediaId);
                    return (
                      <article className="saved-work" key={work.id}>
                        <button onClick={() => openWork(work)} className="work-open">
                          {result?.mediaId ? (
                            <LocalImage id={result.mediaId} alt={work.title} />
                          ) : (
                            <div className="work-empty">
                              <Images size={30} />
                            </div>
                          )}
                          <div>
                            <h2 className={isSystemTitle(work.title) ? 'system-title' : undefined}>
                              {work.title}
                            </h2>
                            <p>{date(work.updatedAt)}</p>
                            <span>
                              {
                                jobs.filter((j) => j.workId === work.id && j.status === 'succeeded')
                                  .length
                              }{' '}
                              {isVideo(work.draft) ? '支影片' : '張圖片'}
                            </span>
                          </div>
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`刪除 ${work.title}`}
                          disabled={jobs.some((j) => j.workId === work.id && isActive(j))}
                          onClick={() => void deleteWork(work)}
                        >
                          <Trash2 size={18} />
                        </button>
                      </article>
                    );
                  })}
                </div>
              )}
              <p className="hint">
                各裝置分開保存。清除瀏覽器資料或儲存空間被回收，都可能遺失作品；請定期到設定匯出備份。
              </p>
            </>
          )}
        </>
      )}
      <footer>
        <a href={STUDIO} target="_blank" rel="noreferrer">
          weiweistudio.com <ExternalLink size={12} />
        </a>
        <a href={REPO} target="_blank" rel="noreferrer">
          GitHub <ExternalLink size={12} />
        </a>
      </footer>
      {toast && !settings && !imageJob && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button aria-label="關閉通知" onClick={() => setToast('')}>
            <X size={17} />
          </button>
        </div>
      )}
      {settings && (
        <Modal
          title="畫室設定"
          notice={toast}
          close={() => {
            if (!dataBusy) closeOverlay('settings');
          }}
        >
          <div className="modal-content">
            {preferences.showMoney && (
              <section className="balance-panel" aria-label="餘額使用進度">
                <div className="balance-panel-heading">
                  <div>
                    <span>目前餘額</span>
                    <strong>{balance ? money(balance.amount) : '暫時無法讀取'}</strong>
                  </div>
                  <label>
                    顯示上限
                    <span>
                      US$
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={preferences.balanceLimit}
                        onChange={(event) => {
                          const value = Number(event.target.value);
                          if (Number.isFinite(value) && value > 0)
                            setPreferences({ ...preferences, balanceLimit: value });
                        }}
                        aria-label="餘額顯示上限"
                      />
                    </span>
                  </label>
                </div>
                <progress
                  max={preferences.balanceLimit}
                  value={Math.min(balance?.amount ?? 0, preferences.balanceLimit)}
                  aria-label="目前餘額相對於顯示上限"
                />
                <small>上限只用來顯示進度，不會限制實際生成費用。</small>
              </section>
            )}
            <details className="settings-section">
              <summary>
                顯示偏好 <ChevronDown size={17} />
              </summary>
              <div className="settings-section-body">
                <label className="toggle-row">
                  <span>
                    顯示餘額與費用<small>包含預估費用與實際生成費用</small>
                  </span>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={preferences.showMoney}
                    onChange={(e) =>
                      setPreferences({ ...preferences, showMoney: e.target.checked })
                    }
                  />
                </label>
              </div>
            </details>
            <details className="settings-section">
              <summary>
                服務連線 <ChevronDown size={17} />
              </summary>
              <div className="settings-section-body">
                <p className="hint">
                  已保存 Runware API Key。更換 Key 不會刪除作品，舊任務需用原 Key 查詢。
                </p>
                {active ? (
                  <p className="notice">生成完成後即可更換或移除 Key。</p>
                ) : (
                  <div className="replace-key">
                    <h3>更換 API Key</h3>
                    <KeyForm replacing onSuccess={updateKey} notify={notify} />
                  </div>
                )}
                <button
                  className="text-button danger"
                  disabled={active || dataBusy}
                  onClick={() => {
                    if (confirm('移除這台裝置的 API Key？作品會保留，下次使用需重新設定 Key。')) {
                      saveKey('');
                      setApiKey('');
                      closeOverlay('settings');
                    }
                  }}
                >
                  移除這台裝置的 Key
                </button>
              </div>
            </details>
            <details className="settings-section">
              <summary>
                作品與備份 <ChevronDown size={17} />
              </summary>
              <div className="settings-section-body">
                <p className="hint">
                  備份包含圖片、影片、描述與作品設定，不含 API Key。請妥善保存；更換裝置後可以還原。
                </p>
                <div className="backup-actions">
                  <button
                    className="secondary"
                    disabled={dataBusy || active}
                    onClick={async () => {
                      setDataBusy(true);
                      try {
                        download(
                          await exportBackup(),
                          `little-studio-${new Date().toISOString().slice(0, 10)}.zip`,
                        );
                        notify('備份已準備好，請保存下載的 ZIP 檔。');
                      } catch {
                        notify('匯出失敗，可能是記憶體或儲存空間不足。請先個別下載重要作品。');
                      } finally {
                        setDataBusy(false);
                      }
                    }}
                  >
                    <ArrowDownToLine size={17} />
                    {dataBusy ? '處理中…' : '匯出備份'}
                  </button>
                  <label className={`secondary file-label ${dataBusy || active ? 'disabled' : ''}`}>
                    <FolderHeart size={17} />
                    還原備份
                    <input
                      aria-label="還原備份"
                      type="file"
                      accept=".zip,application/zip"
                      disabled={dataBusy || active}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (!file) return;
                        setDataBusy(true);
                        try {
                          const count = await importBackup(file);
                          notify(`已還原 ${count} 份作品，原有作品也已保留。`);
                        } catch (err) {
                          notify(err instanceof Error ? err.message : '備份無法還原。');
                        } finally {
                          setDataBusy(false);
                        }
                      }}
                    />
                  </label>
                </div>
                <p className="hint">
                  單次可還原 250 MB 以內的 ZIP。手機記憶體有限，重要作品也請另外下載。
                </p>
                <button
                  className="text-button danger"
                  disabled={active || dataBusy}
                  onClick={async () => {
                    if (
                      !confirm(
                        '清除這台裝置的所有作品、照片與生成紀錄？Key 與顯示偏好會保留。此操作無法復原，請先匯出備份。',
                      )
                    )
                      return;
                    setDataBusy(true);
                    try {
                      await clearWorks();
                      const homeState: NavigationState = {
                        studio: true,
                        screen: 'home',
                        overlay: 'settings',
                      };
                      history.replaceState(homeState, '');
                      applyNavigation(homeState);
                      notify('已清除作品，服務設定已保留。');
                    } catch {
                      notify('清除失敗，請稍後再試。');
                    } finally {
                      setDataBusy(false);
                    }
                  }}
                >
                  清除所有作品
                </button>
                <button
                  className="text-button danger"
                  disabled={active || dataBusy}
                  onClick={async () => {
                    if (
                      !confirm(
                        '重設這台裝置？所有作品、照片、Key 與顯示偏好都會刪除，無法復原。請先匯出備份。',
                      )
                    )
                      return;
                    setDataBusy(true);
                    try {
                      await clearWorks();
                      saveKey('');
                      resetPreferences();
                      clearDraftDefaults();
                      setApiKey('');
                      setPreferences(readPreferences());
                      const homeState: NavigationState = { studio: true, screen: 'home' };
                      history.replaceState(homeState, '');
                      applyNavigation(homeState);
                      notify('已重設這台裝置。');
                    } catch {
                      notify('重設未完成，請稍後再試。');
                    } finally {
                      setDataBusy(false);
                    }
                  }}
                >
                  清除資料並重設服務
                </button>
              </div>
            </details>
            <div className="studio-credit">
              Made by{' '}
              <a href={STUDIO} target="_blank" rel="noreferrer">
                weiweistudio.com <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </Modal>
      )}
      {imageJob?.mediaId && (
        <Modal
          title={models[imageJob.model].name}
          notice={toast}
          wide
          close={() => closeOverlay('viewer')}
        >
          <div className="viewer-image">
            <LocalImage id={imageJob.mediaId} alt={imageJob.draft.prompt} controls />
          </div>
          <div className="viewer-info">
            <p>{imageJob.draft.prompt}</p>
            <small>
              {date(imageJob.createdAt)} ·{' '}
              {isVideo(imageJob.draft)
                ? `${imageJob.draft.duration ?? 4} 秒 · ${imageJob.draft.videoResolution ?? '720p'} · ${imageJob.draft.audio ? '生成聲音' : '無聲'}（請求設定）`
                : `${dimensions(imageJob.model, imageJob.draft).width} × ${dimensions(imageJob.model, imageJob.draft).height} px（請求尺寸）`}
            </small>
            {preferences.showMoney && (
              <p className="hint">
                實際費用：{imageJob.cost !== undefined ? money(imageJob.cost) : '服務商未提供'}
              </p>
            )}
            <div className="viewer-actions">
              <button
                className="secondary full"
                onClick={async () => {
                  try {
                    const media = await getMedia(imageJob.mediaId!);
                    if (!media) throw new Error();
                    download(media.blob, media.name);
                    notify('已開始下載。iPhone 可在下載項目開啟，再儲存至「照片」。');
                  } catch {
                    notify('作品無法下載，請稍後再試。');
                  }
                }}
              >
                <ArrowDownToLine size={18} />
                {isVideo(imageJob.draft) ? '下載影片' : '下載圖片'}
              </button>
              {!isVideo(imageJob.draft) && (
                <>
                  <button
                    className="primary full"
                    onClick={() => void createWork(imageJob.mediaId)}
                  >
                    <ImagePlus size={18} />
                    用這張圖開始新作品
                  </button>
                  <button
                    className="secondary full"
                    onClick={() => void createWork(imageJob.mediaId, 'video')}
                  >
                    <Film size={18} />
                    用這張圖製作影片
                  </button>
                </>
              )}
            </div>
            {!isVideo(imageJob.draft) && (
              <p className="hint">會把圖片帶入新作品；按下生成前不會收費。</p>
            )}
          </div>
        </Modal>
      )}
    </main>
  );
}
