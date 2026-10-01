import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { once } from 'node:events';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, extname } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href
  : 'playwright');
execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: root, stdio: 'inherit' });
await mkdir(resolve(root, '.verification'), { recursive: true });
const server = spawn(process.execPath, ['scripts/serve.mjs', 'dist'], {
  cwd: root, env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'],
});
let browser;
try {
  const [output] = await once(server.stdout, 'data');
  const url = output.toString().match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
  assert.ok(url, 'development server did not return its URL');
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  // Keep regressions independent of GitHub availability and rate limits.
  await page.route('https://api.github.com/repos/MF-Dust/Nori.Desktop/releases/latest', (route) => route.fulfill({ json: { assets: [] } }));
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', (response) => { if (response.status() >= 400) errors.push(response.url() + ': ' + response.status()); });

  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator('h1').count(), 1);
    for (const image of await page.locator('img[loading="lazy"]').all()) {
      await image.scrollIntoViewIfNeeded();
    }
    await page.waitForFunction(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0));
    await page.evaluate(() => scrollTo(0, 0));
    const sizing = await page.evaluate(() => ({
      viewport: innerWidth,
      content: document.documentElement.scrollWidth,
    }));
    assert.ok(sizing.content <= sizing.viewport, 'horizontal overflow at ' + width + ': ' + JSON.stringify(sizing));
    if (width === 1440 || width === 390) {
      await page.screenshot({ path: resolve(root, '.verification/' + width + '-full.png'), fullPage: true });
      await page.screenshot({ path: resolve(root, '.verification/' + width + '-hero.png') });
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url);
  const menu = page.getByRole('button', { name: '打开导航菜单', exact: true });
  await menu.click();
  await assert.doesNotReject(() => page.locator('#main-nav').waitFor({ state: 'visible' }));
  await page.keyboard.press('Escape');
  assert.equal(await menu.getAttribute('aria-expanded'), 'false');
  assert.equal(await menu.evaluate((element) => element === document.activeElement), true);
  await menu.click();
  await page.locator('#main-nav').getByRole('link', { name: '相遇预览', exact: true }).click();
  assert.equal(await menu.getAttribute('aria-expanded'), 'false');
  assert.ok(page.url().endsWith('#preview'));
  await page.locator('[data-scene="break"]').click();
  assert.match(await page.locator('#preview-response').innerText(), /喝点水/);
  assert.equal(await page.locator('[aria-pressed="true"]').count(), 1);
  await page.locator('[data-scene="night"]').focus();
  await page.keyboard.press('Enter');
  assert.match(await page.locator('#preview-response').innerText(), /晚安/);
  assert.match(await page.locator('.chat-caption').innerText(), /明天/);
  await page.locator('[data-scene="hello"]').click();
  assert.match(await page.locator('#preview-response').innerText(), /请多多指教/);
  const faq = page.locator('details').first();
  await faq.locator('summary').click();
  assert.equal(await faq.getAttribute('open'), '');
  assert.match(await faq.innerText(), /不是/);
  await page.screenshot({ path: resolve(root, '.verification/390-preview.png'), fullPage: true });

  // Reduced motion uses native anchors and leaves no preview animations running.
  assert.equal(await page.locator('#preview-chat').evaluate((element) => element.getAnimations().length), 0);
  await page.locator('.back-to-top').click();
  await page.waitForFunction(() => scrollY < 60);
  await page.waitForFunction(() => document.querySelector('.back-to-top').inert);

  // Observe the real browser API without coupling product code to a test hook.
  await page.addInitScript(() => {
    window.transitionCount = 0;
    const start = document.startViewTransition.bind(document);
    document.startViewTransition = (update) => {
      window.transitionCount++;
      const transition = start(update);
      window.transitionFinished = transition.finished;
      return transition;
    };
  });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.locator('#main-nav a[href="#features"]').click();
  await page.evaluate(() => window.transitionFinished);
  await page.waitForFunction(() => document.querySelector('#main-nav a[href="#features"]').getAttribute('aria-current') === 'location');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'features');
  assert.ok(await page.evaluate(() => window.transitionCount > 0));
  assert.ok(Number(await page.locator('.site-header').evaluate((element) => element.style.getPropertyValue('--scroll-progress'))) > 0);
  await page.locator('#main-nav a[href="#preview"]').click();
  await page.evaluate(() => window.transitionFinished);
  assert.ok(page.url().endsWith('#preview'));
  await page.goBack();
  await page.waitForFunction(() => location.hash === '#features' && document.querySelector('#main-nav a[href="#features"]').getAttribute('aria-current') === 'location');
  await page.goForward();
  await page.waitForFunction(() => location.hash === '#preview' && document.querySelector('#main-nav a[href="#preview"]').getAttribute('aria-current') === 'location');

  const sceneAnimations = await page.evaluate(() => {
    document.querySelector('[data-scene="night"]').click();
    return document.querySelector('#preview-chat').getAnimations().length;
  });
  assert.ok(sceneAnimations > 0, 'preview must animate with normal motion');
  await page.evaluate(() => {
    for (const scene of ['break', 'night', 'hello', 'night']) document.querySelector('[data-scene="' + scene + '"]').click();
  });
  assert.match(await page.locator('#preview-response').innerText(), /晚安/);
  assert.equal(await page.locator('.desktop-scene').getAttribute('data-moment'), 'night');
  assert.equal(await page.locator('#scene-counter').innerText(), '03 / 03');
  assert.equal(await page.locator('[aria-pressed="true"]').count(), 1);
  await page.evaluate(() => Promise.all(document.querySelector('#preview-chat').getAnimations().map((animation) => animation.finished)));
  await page.screenshot({ path: resolve(root, '.verification/1440-motion-preview.png') });

  // Rapid navigation must not apply the stale callback from an older snapshot.
  await page.evaluate(() => {
    document.querySelector('#main-nav a[href="#about"]').click();
    document.querySelector('#main-nav a[href="#download"]').click();
  });
  await page.evaluate(() => window.transitionFinished);
  assert.ok(page.url().endsWith('#download'));
  assert.equal(await page.evaluate(() => document.activeElement.id), 'download');

  // The unsupported-browser path still performs real, shareable anchor navigation.
  await page.evaluate(() => { document.startViewTransition = undefined; });
  await page.locator('#main-nav a[href="#faq"]').click();
  await page.waitForFunction(() => location.hash === '#faq' && Math.abs(document.querySelector('#faq').getBoundingClientRect().top - 110) < 3);
  const animatedFaq = page.locator('.faq-list details').first();
  const closedHeight = await animatedFaq.evaluate((element) => element.getBoundingClientRect().height);
  await animatedFaq.locator('summary').click();
  await page.waitForFunction((height) => document.querySelector('.faq-list details').getBoundingClientRect().height > height + 30, closedHeight);
  await animatedFaq.locator('summary').click();
  await page.waitForFunction((height) => Math.abs(document.querySelector('.faq-list details').getBoundingClientRect().height - height) < 1, closedHeight);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url, { waitUntil: 'networkidle' });
  await menu.click();
  assert.equal(await page.locator('#main-nav').evaluate((element) => element.inert), false);
  await page.locator('#main-nav').evaluate((element) => Promise.all(element.getAnimations().map((animation) => animation.finished)));
  await page.screenshot({ path: resolve(root, '.verification/390-motion-menu.png') });
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#main-nav').evaluate((element) => element.inert), true);
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#main-nav')).visibility === 'hidden');
  await menu.click();
  await page.locator('#main-nav a[href="#preview"]').click();
  await page.evaluate(() => window.transitionFinished);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'preview');
  assert.equal(await page.locator('#main-nav').evaluate((element) => element.inert), true);

  // Switching the preference while a scene is animating stops it immediately.
  await page.locator('[data-scene="break"]').click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => document.querySelector('#preview-chat').getAnimations().length === 0);
  await page.locator('[data-scene="night"]').click();
  assert.equal(await page.locator('#preview-chat').evaluate((element) => element.getAnimations().length), 0);
  const previousCount = await page.evaluate(() => window.transitionCount);
  await page.locator('.back-to-top').click();
  await page.waitForFunction(() => scrollY < 60);
  assert.equal(await page.evaluate(() => window.transitionCount), previousCount);

  // Direct links initiate an archive download instead of opening Releases.
  await page.route('https://github.com/MF-Dust/Nori.Desktop/releases/download/**', (route) => route.fulfill({
    contentType: 'application/octet-stream',
    headers: { 'content-disposition': 'attachment; filename="nori-test.zip"' },
    body: 'download test fixture',
  }));
  for (const link of await page.locator('[data-download]').all()) {
    const downloadPromise = page.waitForEvent('download');
    await link.click();
    const download = await downloadPromise;
    assert.equal(download.url(), await link.getAttribute('href'));
    assert.equal(await download.failure(), null);
  }

  // Relative resources must work when the site is deployed below a URL prefix.
  await page.route('**/nori/**', async (route) => {
    const name = new URL(route.request().url()).pathname.slice('/nori/'.length) || 'index.html';
    const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };
    await route.fulfill({ body: await readFile(resolve(root, 'dist', name)), contentType: types[extname(name)] });
  });
  await page.goto(url + '/nori/', { waitUntil: 'networkidle' });
  await page.locator('[data-scene="break"]').click();
  assert.match(await page.locator('#preview-response').innerText(), /喝点水/);
  assert.deepEqual(errors, [], 'browser console or resource errors');
  console.log('PASS: responsive layouts, assets, motion, navigation/history, keyboard, rapid switching, FAQ, reduced-motion/fallback and subpath deployment.');
} finally {
  await browser?.close();
  server.kill();
}
