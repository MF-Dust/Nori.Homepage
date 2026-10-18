import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const root = new URL('../', import.meta.url);
const html = await readFile(new URL('index.html', root), 'utf8');
const css = await readFile(new URL('styles.css', root), 'utf8');
const script = await readFile(new URL('app.js', root), 'utf8');

test('Google AdSense loader appears exactly once in the document head', () => {
  const head = html.match(/<head>([\s\S]*?)<\/head>/)?.[1];
  assert.ok(head, 'missing document head');
  const loaders = [...html.matchAll(/<script\b[^>]*pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js[^>]*><\/script>/g)];
  assert.equal(loaders.length, 1, 'AdSense must be loaded only once');
  assert.ok(head.includes(loaders[0][0]), 'AdSense loader must be in the document head');
  assert.match(loaders[0][0], /\basync\b/);
  assert.match(loaders[0][0], /\bclient=ca-pub-2067584938190790/);
  assert.match(loaders[0][0], /\bcrossorigin="anonymous"/);
});

test('all local resources exist and fragments resolve', async () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'duplicate HTML id');
  const references = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
  const fonts = [...css.matchAll(/url\("([^"]+)"\)/g)].map((match) => match[1]);
  for (const reference of [...references, ...fonts]) {
    if (reference.startsWith('#')) {
      assert.ok(ids.includes(reference.slice(1)), 'unresolved fragment: ' + reference);
    } else if (!reference.startsWith('https://')) {
      assert.ok((await stat(new URL(reference, root))).isFile(), 'missing asset: ' + reference);
    }
  }
});

test('external links keep opener isolation', () => {
  for (const [link] of html.matchAll(/<a\b[^>]+target="_blank"[^>]*>/g)) {
    assert.match(link, /rel="noopener noreferrer"/);
  }
});

test('preview scenes are wired and explicitly labelled as presets', () => {
  const scenes = [...html.matchAll(/data-scene="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(scenes, ['hello', 'break', 'night']);
  for (const scene of scenes) assert.match(script, new RegExp(scene + ': \\{'));
  assert.match(html, /交互氛围预览 · 预设台词/);
  assert.match(html, /网页示意，不是实际应用截图/);
  assert.match(html, /不会连接 AI，也不会上传对话/);
});

test('download links use the actual repository and disclose runtime requirements', () => {
  assert.equal([...html.matchAll(/href="https:\/\/github.com\/MF-Dust\/Nori.Desktop\/releases"/g)].length, 1);
  const downloads = [...html.matchAll(/data-download="([^"]+)" href="([^"]+)"/g)];
  assert.equal(downloads.length, 3);
  for (const [, suffix, href] of downloads) {
    assert.ok(href.startsWith('https://github.com/MF-Dust/Nori.Desktop/releases/download/'));
    assert.ok(href.endsWith('-' + suffix));
  }
  assert.equal([...html.matchAll(/需要 \.NET Runtime 10/g)].length, 3);
  assert.match(html, /非官方、非商业开源项目/);
  assert.doesNotMatch(html, /MF-Dust\/Nori-Desktop-Pet/);
});

test('latest release selects platform archives and preserves direct links on failure', async () => {
  const prefix = 'https://github.com/MF-Dust/Nori.Desktop/releases/download/';
  const suffixes = ['win-x64-framework-dependent.zip', 'osx-arm64.zip', 'linux-x64.tar.gz'];
  const source = script.slice(0, script.indexOf('updateDownloadLinks();'));
  const assets = suffixes.map((suffix) => ({ name: 'nori-test-' + suffix, browser_download_url: prefix + 'v-test/nori-test-' + suffix }));
  async function run(fetch) {
    const links = suffixes.map((suffix) => ({ dataset: { download: suffix }, href: 'confirmed-' + suffix }));
    await runInNewContext(source + 'updateDownloadLinks()', { fetch, document: { querySelectorAll: () => links } });
    return links.map((link) => link.href);
  }
  const noise = assets.map((asset) => ({ name: asset.name + '.sha256', browser_download_url: asset.browser_download_url + '.sha256' }));
  assert.deepEqual(await run(async () => ({ ok: true, json: async () => ({ assets: [...noise, ...assets] }) })), assets.map((asset) => asset.browser_download_url));
  const fallback = suffixes.map((suffix) => 'confirmed-' + suffix);
  for (const fetch of [
    async () => { throw new Error('offline'); },
    async () => ({ ok: false }),
    async () => ({ ok: true, json: async () => ({}) }),
    async () => ({ ok: true, json: async () => ({ assets: [{ ...assets[0], browser_download_url: 'https://example.com/file.zip' }] }) }),
  ]) assert.deepEqual(await run(fetch), fallback);
  assert.deepEqual(await run(async () => ({ ok: true, json: async () => ({ assets: [assets[0]] }) })), [assets[0].browser_download_url, ...fallback.slice(1)]);
});

test('keyboard navigation, reduced motion and responsive layouts are present', () => {
  assert.match(html, /class="skip-link" href="#main"/);
  assert.match(script, /event.key === 'Escape'/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /max-width: 600px/);
  assert.match(html, /class="back-to-top" href="#home"/);
  assert.match(script, /navigation\.inert = mobileNavigation\.matches && !open/);
  assert.match(script, /reducedMotion\.matches \|\| !document\.startViewTransition/);
  for (const [, id] of html.matchAll(/aria-controls="([^"]+)"/g)) {
    assert.ok(html.includes('id="' + id + '"'), 'missing controlled region: ' + id);
  }
});
