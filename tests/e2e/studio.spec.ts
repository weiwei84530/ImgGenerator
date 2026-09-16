import { test, expect, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.exposeFunction('readTestErrors', () => errors);
});
test.afterEach(async ({ page }) => {
  if (!page.isClosed()) {
    const errors = await page.evaluate(() =>
      (window as unknown as { readTestErrors: () => Promise<string[]> }).readTestErrors(),
    );
    expect(errors).toEqual([]);
  }
});

test('rapid clicks submit once and reset removes saved data and credentials', async ({ page }) => {
  const api = await mockRunware(page);
  page.on('dialog', (d) => void d.accept());
  await setup(page);
  await newWork(page);
  await page.getByRole('button', { name: '開始生成圖片' }).evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
  });
  await expect(page.getByRole('button', { name: /檢視 .* 圖片/ })).toHaveCount(2);
  expect(api.submitted).toHaveLength(2);
  await page.getByLabel('設定', { exact: true }).click();
  await openSettingsSection(page, '顯示偏好');
  await page.getByRole('switch', { name: /顯示餘額與費用/ }).uncheck();
  await openSettingsSection(page, '作品與備份');
  await page.getByRole('button', { name: '清除資料並重設服務' }).click();
  await expect(page.getByRole('heading', { name: '設定服務' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('img-generator.key'))).toBeNull();
  await page.getByLabel('Runware API Key', { exact: true }).fill('new-fake-key');
  await page.getByRole('button', { name: '連線，開始創作' }).click();
  await expect(page.getByLabel('重新查詢餘額')).toContainText('12.34');
  await page.getByRole('button', { name: /我的作品/ }).click();
  await expect(page.locator('.saved-work')).toHaveCount(0);
});

test('media storage failure preserves the task and recovers without new generation', async ({
  page,
}) => {
  const api = await mockRunware(page);
  await setup(page);
  await newWork(page);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    let failOnce = true;
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof original>) {
      if (this.name === 'media' && failOnce) {
        failOnce = false;
        throw new DOMException('Simulated full storage', 'QuotaExceededError');
      }
      return original.apply(this, args);
    };
  });
  await page.getByRole('button', { name: '開始生成圖片' }).click();
  await expect(page.getByRole('button', { name: /檢視 .* 圖片/ })).toHaveCount(1);
  await page.getByRole('button', { name: '查詢原任務' }).click();
  await expect(page.getByRole('button', { name: /檢視 .* 圖片/ })).toHaveCount(2);
  expect(api.submitted).toHaveLength(2);
});

const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
type Task = {
  taskType: string;
  taskUUID: string;
  model?: string;
  inputs?: { referenceImages: string[] };
  positivePrompt?: string;
  apiKey?: string;
  [key: string]: unknown;
};
async function mockRunware(
  page: Page,
  options: { failGpt?: boolean; failVeo?: boolean; interrupt?: boolean; badBalance?: boolean } = {},
) {
  const submitted: Task[] = [];
  const polled: Task[] = [];
  const failed = new Set<string>();
  let interrupt = options.interrupt;
  await page.route('https://im.runware.ai/test-*.mp4', (route) =>
    route.fulfill({ contentType: 'video/mp4', path: 'tests/fixtures/sample.mp4' }),
  );
  await page.route('https://content.runware.ai/models/*/pricing', (route) => {
    const air = decodeURIComponent(route.request().url().split('/models/')[1].split('/pricing')[0]);
    const pricingRates =
      air === 'google:4@3'
        ? [
            { amount: 0.06895, unit: 'output', label: '1K' },
            { amount: 0.10255, unit: 'output', label: '2K' },
            { amount: 0.00028, unit: 'inputImage' },
          ]
        : [];
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ air, pricingRates }),
    });
  });
  await page.route('https://api.runware.ai/v1', async (route) => {
    const [task] = route.request().postDataJSON() as Task[];
    const reply = (body: unknown) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (task.taskType === 'authentication') {
      if (task.apiKey === 'bad-key') return reply({ errors: [{ code: 'invalidApiKey' }] });
      return reply({ data: [] });
    }
    if (task.taskType === 'accountManagement')
      return reply(
        options.badBalance
          ? { errors: [{ code: 'forbidden' }] }
          : { data: [{ taskType: 'accountManagement', balance: 12.34 }] },
      );
    if (task.taskType === 'imageInference' || task.taskType === 'videoInference') {
      submitted.push(task);
      if (options.failVeo && task.model === 'google:3@3') {
        failed.add(task.taskUUID);
        options.failVeo = false;
      }
      if (options.failGpt && task.model?.startsWith('openai')) {
        failed.add(task.taskUUID);
        options.failGpt = false;
      }
      if (interrupt) {
        interrupt = false;
        return route.abort('failed');
      }
      return reply({ data: [{ taskUUID: task.taskUUID, status: 'processing' }] });
    }
    if (task.taskType === 'getResponse') {
      polled.push(task);
      if (failed.has(task.taskUUID))
        return reply({
          errors: [{ taskUUID: task.taskUUID, status: 'error', code: 'contentModeration' }],
        });
      if (submitted.find((t) => t.taskUUID === task.taskUUID)?.taskType === 'videoInference')
        return reply({
          data: [
            {
              taskType: 'videoInference',
              taskUUID: task.taskUUID,
              status: 'success',
              videoURL: `https://im.runware.ai/test-${task.taskUUID}.mp4`,
              cost: 0.336,
            },
          ],
        });
      return reply({
        data: [
          {
            taskType: 'imageInference',
            taskUUID: task.taskUUID,
            status: 'success',
            imageDataURI: `data:image/png;base64,${PNG}`,
            imageUUID: task.taskUUID,
            cost: 0.075,
          },
        ],
      });
    }
    throw new Error(`Unexpected task: ${task.taskType}`);
  });
  return { submitted, polled };
}
async function setup(page: Page, search = '') {
  await page.goto(`/${search}`);
  await page.getByLabel('Runware API Key', { exact: true }).fill('test-key-never-real');
  await page.getByRole('button', { name: '連線，開始創作' }).click();
  await expect(page.getByRole('button', { name: /製作圖片/ })).toBeVisible();
}
async function newWork(page: Page) {
  await page.getByRole('button', { name: /製作圖片/ }).click();
  await page.getByLabel('描述你的想法').fill('一隻貓咪在溫柔的花園中');
}
async function openSettingsSection(page: Page, name: string) {
  const summary = page.locator('summary').filter({ hasText: name });
  if ((await summary.getAttribute('aria-expanded')) !== 'true') await summary.click();
}

test('category defaults remember parameters while new works keep prompts and references empty', async ({
  page,
}) => {
  await mockRunware(page);
  await setup(page);
  await newWork(page);
  await page.getByLabel('移除 GPT Image 2').click();
  await page.getByLabel('增加張數').click();
  await page.getByRole('button', { name: '方形', exact: false }).click();
  await page.getByLabel('拾光畫室首頁').click();
  await page.getByRole('button', { name: /製作影片/ }).click();
  await expect(page.getByLabel('移除 Kling 3.0 Standard')).toBeVisible();
  await expect(page.getByLabel('生成聲音', { exact: true })).not.toBeChecked();
  await page.getByLabel('生成聲音', { exact: true }).check();
  await page.getByLabel('影片長度').selectOption('8');
  await page.reload();
  await page.getByLabel('拾光畫室首頁').click();
  await page.getByRole('button', { name: /製作圖片/ }).click();
  await expect(page.getByLabel('移除 Nano Banana 2')).toBeVisible();
  await expect(page.getByLabel('移除 GPT Image 2')).toHaveCount(0);
  await expect(page.getByLabel('描述你的想法')).toHaveValue('');
  await expect(page.locator('.stepper')).toContainText('2 張');
  await page.getByLabel('拾光畫室首頁').click();
  await page.getByRole('button', { name: /製作影片/ }).click();
  await expect(page.getByLabel('影片長度')).toHaveValue('8');
  await expect(page.getByLabel('生成聲音', { exact: true })).toBeChecked();
  await expect(page.getByLabel('描述你的想法')).toHaveValue('');
});

test('expanded image models generate alongside existing models and pass through references', async ({
  page,
}) => {
  const api = await mockRunware(page);
  await setup(page);
  await newWork(page);
  for (const model of ['FLUX.2 Pro', 'Seedream 5.0 Pro']) {
    await page.getByRole('button', { name: '新增模型' }).click();
    await page.getByLabel('選擇新增模型').selectOption({ label: model });
  }
  await page.getByLabel('加入照片', { exact: true }).setInputFiles({
    name: 'photo.png',
    mimeType: 'image/png',
    buffer: Buffer.from(PNG, 'base64'),
  });
  await expect(page.getByAltText('參考照片 1')).toBeVisible();
  await page.getByRole('button', { name: '開始修改照片' }).click();
  await expect(page.getByRole('button', { name: /檢視 .* 圖片/ })).toHaveCount(4);
  expect(api.submitted.map((t) => t.model).sort()).toEqual([
    'bfl:5@1',
    'bytedance:seedream@5.0-pro',
    'google:4@3',
    'openai:gpt-image@2',
  ]);
  expect(api.submitted.every((t) => t.inputs?.referenceImages.length === 1)).toBe(true);
});

test('video first-frame generation plays and downloads, hides costs, and survives backup restore', async ({
  page,
  browserName,
}) => {
  const api = await mockRunware(page);
  page.on('dialog', (d) => void d.accept());
  await setup(page, '?costs=hidden');
  await newWork(page);
  await page.getByRole('button', { name: '開始生成圖片' }).click();
  await expect(page.getByRole('button', { name: /檢視 .* 圖片/ })).toHaveCount(2);
  await page.getByRole('button', { name: /檢視 Nano Banana/ }).click();
  await page.getByRole('button', { name: '用這張圖製作影片' }).click();
  await expect(page.getByAltText('參考照片 1')).toBeVisible();
  await page.getByLabel('描述你的想法').fill('讓花朵輕輕搖動');
  await page.getByRole('button', { name: '開始生成影片' }).click();
  await expect(page.getByRole('button', { name: /檢視 .* 影片/ })).toHaveCount(1);
  const videoTask = api.submitted.find((t) => t.taskType === 'videoInference')!;
  expect(videoTask.inputs).toHaveProperty('frameImages');
  expect(videoTask.width).toBeUndefined();
  await expect(page.getByText(/實際費用/)).toHaveCount(0);
  await page.getByRole('button', { name: /檢視 .* 影片/ }).click();
  const player = page.getByRole('dialog').locator('video');
  await expect(player).toHaveAttribute('controls', '');
  // Windows WebKit rejects H.264 MP4 despite canPlayType; Linux CI tests playback.
  if (browserName === 'webkit' && process.platform === 'win32') {
    await expect(
      page.getByRole('dialog').getByText('這個瀏覽器無法播放影片，請使用下方「下載影片」後開啟。'),
    ).toBeVisible();
  } else {
    await player.evaluate((v) => (v as HTMLVideoElement).play());
    await expect
      .poll(() => player.evaluate((v) => (v as HTMLVideoElement).currentTime))
      .toBeGreaterThan(0);
  }
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '下載影片' }).click();
  expect((await downloadPromise).suggestedFilename()).toMatch(/\.mp4$/);
  await page.getByRole('dialog').getByLabel('關閉', { exact: true }).click();
  await page.getByLabel('設定', { exact: true }).click();
  await openSettingsSection(page, '作品與備份');
  const backup = page.waitForEvent('download');
  await page.getByRole('button', { name: '匯出備份' }).click();
  const archive = await (await backup).path();
  await page.getByRole('button', { name: '清除所有作品', exact: true }).click();
  await page.getByLabel('還原備份', { exact: true }).setInputFiles(archive!);
  await expect(page.getByRole('status')).toContainText('已還原');
  expect(api.submitted).toHaveLength(3);
  await page.getByRole('dialog').getByLabel('關閉', { exact: true }).click();
  await page.getByRole('button', { name: /我的作品/ }).click();
  await expect(page.locator('.saved-work')).toHaveCount(2);
  await expect(page.getByText('1 支影片', { exact: true })).toBeVisible();
  await expect(page.locator('.work-list video')).toHaveCount(1);
});

test('video partial failures retry only the failed model and reload only polls the original task', async ({
  page,
}) => {
  const api = await mockRunware(page, { failVeo: true, interrupt: true });
  page.on('dialog', (d) => void d.accept());
  await setup(page);
  await page.getByRole('button', { name: /製作影片/ }).click();
  await page.getByRole('button', { name: '新增模型' }).click();
  await page.getByLabel('選擇新增模型').selectOption({ label: 'Veo 3.1 Fast' });
  await page.getByLabel('描述你的想法').fill('一朵花在微風中搖動');
  await page.getByRole('button', { name: '開始生成影片' }).click();
  await expect(page.getByRole('button', { name: '查詢原任務' })).toBeVisible();
  await page.reload();
  await page.getByLabel('拾光畫室首頁').click();
  await page.getByRole('button', { name: /我的作品/ }).click();
  await page.locator('.work-open').first().click();
  await page.getByRole('tab', { name: /本次作品/ }).click();
  await expect(page.getByRole('button', { name: /檢視 Kling .* 影片/ })).toHaveCount(1);
  expect(api.submitted).toHaveLength(2);
  await page.getByRole('button', { name: '重新生成這支' }).click();
  await expect(page.getByRole('button', { name: /檢視 .* 影片/ })).toHaveCount(2);
  expect(api.submitted).toHaveLength(3);
  expect(api.submitted[2].model).toBe('google:3@3');
});

test('first-use validation, saved key, replacement, and hidden money preference', async ({
  page,
}) => {
  await mockRunware(page);
  await page.goto('/?costs=hidden');
  await page.getByLabel('Runware API Key', { exact: true }).fill('bad-key');
  await page.getByRole('button', { name: '連線，開始創作' }).click();
  await expect(page.getByRole('alert')).toContainText('API Key 無效');
  expect(await page.evaluate(() => localStorage.getItem('img-generator.key'))).toBeNull();
  await setup(page, '?costs=hidden');
  await expect(page.getByLabel('重新查詢餘額')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: /製作圖片/ })).toBeVisible();
  await page.getByLabel('設定', { exact: true }).click();
  await openSettingsSection(page, '顯示偏好');
  const toggle = page.getByRole('switch', { name: /顯示餘額與費用/ });
  await expect(toggle).not.toBeChecked();
  await toggle.check();
  await openSettingsSection(page, '服務連線');
  await page.getByLabel('Runware API Key', { exact: true }).fill('replacement-test-key');
  await page.getByRole('button', { name: '驗證並更換 Key' }).click();
  await expect(page.getByLabel('重新查詢餘額')).toContainText('12.34');
  await page.goto('/?costs=hidden');
  await expect(page.getByLabel('重新查詢餘額')).toContainText('12.34');
  expect(await page.evaluate(() => localStorage.getItem('img-generator.key'))).toBe(
    'replacement-test-key',
  );
});

test('two models, two photos each, original references, download and new work', async ({
  page,
}) => {
  const api = await mockRunware(page);
  await setup(page);
  await newWork(page);
  await page.getByLabel('加入照片', { exact: true }).setInputFiles({
    name: 'reference.png',
    mimeType: 'image/png',
    buffer: Buffer.from(PNG, 'base64'),
  });
  await expect(page.getByAltText('參考照片 1')).toBeVisible();
  await page.getByLabel('增加張數').click();
  await page.getByRole('button', { name: '開始修改照片' }).click();
  await expect(page.getByRole('button', { name: /檢視 .* 圖片/ })).toHaveCount(4);
  expect(api.submitted).toHaveLength(4);
  expect(api.submitted.filter((t) => t.model === 'google:4@3')).toHaveLength(2);
  expect(api.submitted.every((t) => t.inputs?.referenceImages.length === 1)).toBe(true);
  expect(new Set(api.submitted.map((t) => t.inputs!.referenceImages[0])).size).toBe(1);
  await page
    .getByRole('button', { name: /檢視 Nano Banana 2 圖片/ })
    .first()
    .click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: '下載圖片' }).click();
  expect((await downloaded).suggestedFilename()).toMatch(/banana-.*\.png/);
  await page.getByRole('button', { name: '用這張圖開始新作品' }).click();
  await expect(page.getByAltText('參考照片 1')).toBeVisible();
  await expect(page.getByLabel('描述你的想法')).toHaveValue('');
  expect(api.submitted).toHaveLength(4);
  await page.getByLabel('拾光畫室首頁').click();
  await page.getByRole('button', { name: /我的作品/ }).click();
  await expect(page.locator('.saved-work')).toHaveCount(2);
});

test('partial failure preserves success and retries exactly one image', async ({ page }) => {
  const api = await mockRunware(page, { failGpt: true });
  page.on('dialog', (d) => void d.accept());
  await setup(page);
  await newWork(page);
  await page.getByRole('button', { name: '開始生成圖片' }).click();
  await expect(page.getByRole('button', { name: /檢視 Nano Banana/ })).toHaveCount(1);
  await page.getByRole('button', { name: '重新生成這張' }).click();
  await expect(page.getByRole('button', { name: /檢視 .* 圖片/ })).toHaveCount(2);
  expect(api.submitted).toHaveLength(3);
  expect(api.submitted[2].model).toBe('openai:gpt-image@2');
});

test('interrupted submission reloads by polling the same task without another charge', async ({
  page,
}) => {
  const api = await mockRunware(page, { interrupt: true });
  await setup(page);
  await newWork(page);
  await page.getByRole('button', { name: '移除 GPT Image 2' }).click();
  await page.getByRole('button', { name: '開始生成圖片' }).click();
  await expect(page.getByRole('button', { name: '查詢原任務' })).toBeVisible();
  await page.reload();
  await expect.poll(() => api.polled.length).toBeGreaterThan(0);
  expect(api.submitted).toHaveLength(1);
  expect(api.polled[0].taskUUID).toBe(api.submitted[0].taskUUID);
  await page.getByLabel('拾光畫室首頁').click();
  await page.getByRole('button', { name: /我的作品/ }).click();
  await page.locator('.work-open').first().click();
  await page.getByRole('tab', { name: /本次作品/ }).click();
  await expect(page.getByRole('button', { name: /檢視 Nano Banana/ })).toHaveCount(1);
});

test('money stays hidden in editor, results and full view, then restores', async ({ page }) => {
  await mockRunware(page);
  await setup(page, '?costs=hidden');
  await newWork(page);
  await expect(page.getByText(/預估費用/)).toHaveCount(0);
  await page.getByRole('button', { name: '開始生成圖片' }).click();
  await expect(page.getByRole('button', { name: /檢視 .* 圖片/ })).toHaveCount(2);
  await expect(page.getByText(/實際費用/)).toHaveCount(0);
  await page.getByRole('button', { name: /檢視 Nano Banana/ }).click();
  await expect(page.getByRole('dialog').getByText(/US\$/)).toHaveCount(0);
  await page.getByRole('dialog').getByLabel('關閉', { exact: true }).click();
  await page.getByLabel('設定', { exact: true }).click();
  await openSettingsSection(page, '顯示偏好');
  await page.getByRole('switch', { name: /顯示餘額與費用/ }).check();
  await page.getByRole('dialog').getByLabel('關閉', { exact: true }).click();
  await expect(page.getByText(/實際費用 US\$/)).toHaveCount(2);
  await page.getByRole('button', { name: /檢視 Nano Banana/ }).click();
  await expect(page.getByRole('dialog').getByText(/實際費用：US\$/)).toBeVisible();
});

test('backup restore, deletion, key removal and offline images', async ({ page }) => {
  await mockRunware(page);
  page.on('dialog', (d) => void d.accept());
  await setup(page);
  await newWork(page);
  await page.getByRole('button', { name: '開始生成圖片' }).click();
  await expect(page.getByRole('button', { name: /檢視 .* 圖片/ })).toHaveCount(2);
  await page.getByLabel('設定', { exact: true }).click();
  await openSettingsSection(page, '作品與備份');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: '匯出備份' }).click();
  const archive = await downloaded;
  const path = await archive.path();
  expect(path).toBeTruthy();
  await page.getByRole('button', { name: '清除所有作品', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('已清除作品');
  await page.getByLabel('還原備份', { exact: true }).setInputFiles(path!);
  await expect(page.getByRole('status')).toContainText('已還原 1 份作品');
  await openSettingsSection(page, '服務連線');
  await page.getByRole('button', { name: '移除這台裝置的 Key' }).click();
  await expect(page.getByRole('heading', { name: '設定服務' })).toBeVisible();
  await page.getByLabel('Runware API Key', { exact: true }).fill('test-key-never-real');
  await page.getByRole('button', { name: '連線，開始創作' }).click();
  await page.getByRole('button', { name: /我的作品/ }).click();
  await page.locator('.work-open').first().click();
  await page.context().setOffline(true);
  await page.getByRole('tab', { name: /本次作品/ }).click();
  await expect(page.getByRole('button', { name: /檢視 .* 圖片/ })).toHaveCount(2);
  await expect(page.locator('.result-image img').first()).toBeVisible();
});

test('mobile layout fits and unavailable balance is never shown as zero', async ({
  page,
}, testInfo) => {
  await mockRunware(page, { badBalance: true });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)).toBe(
    true,
  );
  await page.screenshot({ path: testInfo.outputPath('welcome.png'), fullPage: true });
  await setup(page);
  await expect(page.getByLabel('重新查詢餘額')).toContainText('暫時無法讀取');
  await page.screenshot({ path: testInfo.outputPath('home.png'), fullPage: true });
  await newWork(page);
  await page.screenshot({ path: testInfo.outputPath('workspace.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 320, height: 568 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('browser back follows screens and closes overlays', async ({ page }) => {
  await mockRunware(page);
  await setup(page);
  await newWork(page);
  await page.goBack();
  await expect(page.getByRole('button', { name: /製作圖片/ })).toBeVisible();

  await page.getByLabel('設定', { exact: true }).click();
  await expect(page.getByRole('dialog', { name: '畫室設定' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog', { name: '畫室設定' })).toHaveCount(0);

  await newWork(page);
  await page.getByRole('button', { name: '開始生成圖片' }).click();
  await page.getByRole('button', { name: /檢視 Nano Banana/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('existing works open results and local collections stay focused', async ({ page }) => {
  await mockRunware(page);
  await setup(page);
  await newWork(page);
  await page.getByRole('button', { name: '開始生成圖片' }).click();
  await page.getByLabel('拾光畫室首頁').click();
  await page.getByRole('button', { name: /我的作品/ }).click();
  await expect(page.getByRole('button', { name: '開始新作品' })).toHaveCount(0);
  await page.locator('.work-open').first().click();
  await expect(page.getByRole('tab', { name: /本次作品/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByText('喜歡的作品記得下載下來，避免遺失。')).toBeVisible();
  await expect(page.getByRole('button', { name: '繼續這份作品' })).toHaveCount(0);
});

test('balance limit persists and advanced settings only appear when relevant', async ({ page }) => {
  await mockRunware(page);
  await setup(page);
  await page.getByLabel('設定', { exact: true }).click();
  await expect(page.getByLabel('餘額顯示上限')).toHaveValue('20');
  await page.getByLabel('餘額顯示上限').fill('35');
  await page.getByRole('dialog').getByLabel('關閉', { exact: true }).click();
  await page.reload();
  await page.getByLabel('設定', { exact: true }).click();
  await expect(page.getByLabel('餘額顯示上限')).toHaveValue('35');
  await page.getByRole('dialog').getByLabel('關閉', { exact: true }).click();

  await newWork(page);
  await page.getByLabel('移除 Nano Banana 2').click();
  await page.getByLabel('移除 GPT Image 2').click();
  await page.getByRole('button', { name: '新增模型' }).click();
  await page.getByLabel('選擇新增模型').selectOption({ label: 'FLUX.2 Pro' });
  await expect(page.getByText('進階設定', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '新增模型' }).click();
  await page.getByLabel('選擇新增模型').selectOption({ label: 'Seedream 5.0 Pro' });
  await expect(page.getByText('進階設定', { exact: true })).toBeVisible();
});

test('phone landscape shows the portrait prompt', async ({ page }) => {
  await mockRunware(page);
  await setup(page);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.getByText('請將手機轉回直向')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByText('請將手機轉回直向')).toBeHidden();
});
