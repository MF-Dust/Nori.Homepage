// Versioned fallback links remain usable without JavaScript or GitHub API access.
async function updateDownloadLinks() {
  try {
    const response = await fetch('https://api.github.com/repos/MF-Dust/Nori.Desktop/releases/latest');
    if (!response.ok) return;
    const release = await response.json();
    if (!Array.isArray(release.assets)) return;
    for (const link of document.querySelectorAll('[data-download]')) {
      const asset = release.assets.find((item) => typeof item.name === 'string'
        && item.name.endsWith('-' + link.dataset.download)
        && typeof item.browser_download_url === 'string'
        && item.browser_download_url.startsWith('https://github.com/MF-Dust/Nori.Desktop/releases/download/'));
      if (!asset) continue;
      link.href = asset.browser_download_url;
      link.title = '下载 ' + asset.name;
    }
  } catch {
    // Offline, rate-limited or blocked: keep the confirmed direct downloads.
  }
}
updateDownloadLinks();

const header = document.querySelector('.site-header');
const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#main-nav');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const mobileNavigation = matchMedia('(max-width: 860px)');
const easing = 'cubic-bezier(.22, 1, .36, 1)';

function setMenu(open) {
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? '关闭导航菜单' : '打开导航菜单');
  navigation.classList.toggle('is-open', open);
  navigation.inert = mobileNavigation.matches && !open;
}

setMenu(false);
menuButton.addEventListener('click', () => setMenu(menuButton.getAttribute('aria-expanded') !== 'true'));
navigation.addEventListener('click', (event) => {
  if (event.target.closest('a')) setMenu(false);
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
    setMenu(false);
    menuButton.focus();
  }
});
document.addEventListener('click', (event) => {
  if (!event.target.closest('.site-header')) setMenu(false);
});
header.addEventListener('focusout', (event) => {
  if (!header.contains(event.relatedTarget)) setMenu(false);
});
mobileNavigation.addEventListener('change', () => {
  if (mobileNavigation.matches && navigation.contains(document.activeElement)) menuButton.focus();
  setMenu(false);
});

const sectionLinks = [...header.querySelectorAll('a[href^="#"]')];
const sections = [...document.querySelectorAll('main > section[id]')];
const backToTop = document.querySelector('.back-to-top');
let scrollFrame = 0;

function updateScrollState() {
  scrollFrame = 0;
  const marker = Math.max(header.getBoundingClientRect().bottom + 28, innerHeight * .28);
  let current = sections[0].id;
  for (const section of sections) {
    if (section.getBoundingClientRect().top <= marker) current = section.id;
  }
  for (const link of sectionLinks) {
    if (link.hash === '#' + current) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  }
  const height = document.documentElement.scrollHeight - innerHeight;
  header.style.setProperty('--scroll-progress', Math.min(1, Math.max(0, scrollY / Math.max(1, height))));
  header.classList.toggle('is-scrolled', scrollY > 30);
  const showReturn = scrollY > innerHeight * .65;
  backToTop.classList.toggle('is-visible', showReturn);
  backToTop.inert = !showReturn;
}
function scheduleScrollUpdate() {
  if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScrollState);
}
addEventListener('scroll', scheduleScrollUpdate, { passive: true });
addEventListener('resize', scheduleScrollUpdate);
addEventListener('load', scheduleScrollUpdate);
new ResizeObserver(scheduleScrollUpdate).observe(document.body);
updateScrollState();

// Keep normal anchors, deep links and browser history; enhance only unmodified clicks.
let navigationTransition;
let navigationRevision = 0;
document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href^="#"]');
  if (!link || link.classList.contains('skip-link') || event.defaultPrevented || event.button !== 0
    || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const target = document.getElementById(link.hash.slice(1));
  if (!target || reducedMotion.matches || !document.startViewTransition) return;

  event.preventDefault();
  const revision = ++navigationRevision;
  navigationTransition?.skipTransition();
  document.documentElement.style.setProperty('--page-shift', target.getBoundingClientRect().top < 0 ? '-14px' : '14px');
  const transition = document.startViewTransition(() => {
    // A newer click owns the destination, even if an earlier snapshot is still pending.
    if (revision !== navigationRevision) return;
    if (location.hash !== link.hash) history.pushState(null, '', link.hash);
    target.scrollIntoView({ behavior: 'instant', block: 'start' });
    target.focus({ preventScroll: true });
    updateScrollState();
  });
  navigationTransition = transition;
  // Rapid navigation can intentionally skip a snapshot before it is ready.
  transition.ready.catch(() => {});
  transition.finished.then(() => {
    if (navigationTransition === transition) navigationTransition = undefined;
  });
});
// History traversal must also win over an unfinished navigation snapshot.
addEventListener('popstate', () => {
  navigationRevision++;
  navigationTransition?.skipTransition();
  // Restore the anchor after the browser's history scroll restoration has run.
  requestAnimationFrame(() => {
    const target = document.getElementById(location.hash.slice(1) || 'home');
    target?.scrollIntoView({ behavior: 'instant', block: 'start' });
    updateScrollState();
  });
});

const revealObserver = new IntersectionObserver((entries) => {
  for (const { target, isIntersecting } of entries) {
    if (!isIntersecting) continue;
    revealObserver.unobserve(target);
    if (reducedMotion.matches || navigationTransition) continue;
    const stagger = target.matches('.feature-card, .download-card')
      ? [...target.parentElement.children].indexOf(target) % 3 * 65 : 0;
    target.animate([{ opacity: 0, translate: '0 18px' }, { opacity: 1, translate: '0 0' }], {
      duration: 620, delay: stagger, easing, fill: 'backwards',
    });
  }
}, { threshold: .08, rootMargin: '0px 0px -30px 0px' });
document.querySelectorAll('.about-art, .about-copy, .section-heading, .feature-card, .desktop-window, .preview-controls, .download-intro, .download-card, .getting-started, .faq-heading, .faq-list, .community-section')
  .forEach((element) => revealObserver.observe(element));

reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches) {
    navigationTransition?.skipTransition();
    document.getAnimations().forEach((animation) => animation.cancel());
  }
});

const scenes = {
  hello: {
    prompt: '你好，Nori。',
    response: '你好呀。这里就是你的世界吗？\n那么，从今天开始，请多多指教。',
    caption: '新的故事，从这里开始。',
    label: 'A LITTLE LIGHT',
    note: '新的故事，从你好开始。',
  },
  break: {
    prompt: '今天有点累，想休息一下。',
    response: '那就先停一小会儿吧。\n去喝点水，看看窗外。Nori 在这里等你回来。',
    caption: '休息一下，也没有关系。',
    label: 'A LITTLE BREAK',
    note: '今天，也慢慢来。',
  },
  night: {
    prompt: '要睡了。晚安，Nori。',
    response: '晚安呀。今天也辛苦了。\n那些还没说完的故事，我们明天再慢慢聊。',
    caption: '明天，又是一次小小的重逢。',
    label: 'A QUIET NIGHT',
    note: '留一束微光，等明天。',
  },
};
const sceneButtons = [...document.querySelectorAll('[data-scene]')];
const prompt = document.querySelector('#preview-prompt');
const response = document.querySelector('#preview-response');
const caption = document.querySelector('#preview-caption');
const desktopScene = document.querySelector('.desktop-scene');
const previewChat = document.querySelector('#preview-chat');
const desktopNote = document.querySelector('.desktop-note');
const momentLabel = document.querySelector('#moment-label');
const momentNote = document.querySelector('#moment-note');
const sceneCounter = document.querySelector('#scene-counter');
let selectedScene = 0;

sceneButtons.forEach((button, index) => {
  button.addEventListener('click', () => {
    if (selectedScene === index) return;
    const direction = index > selectedScene ? 1 : -1;
    selectedScene = index;
    const scene = scenes[button.dataset.scene];
    sceneButtons.forEach((item) => {
      const active = item === button;
      item.classList.toggle('active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    // Update synchronously: rapid clicks never queue stale dialogue or live announcements.
    prompt.textContent = scene.prompt;
    response.textContent = scene.response;
    caption.textContent = scene.caption;
    momentLabel.textContent = scene.label;
    momentNote.textContent = scene.note;
    sceneCounter.textContent = String(index + 1).padStart(2, '0') + ' / 03';
    desktopScene.dataset.moment = button.dataset.scene;
    for (const element of [previewChat, desktopNote]) {
      element.getAnimations().forEach((animation) => animation.cancel());
      if (!reducedMotion.matches) element.animate([
        { opacity: .25, translate: '0 ' + direction * 9 + 'px' },
        { opacity: 1, translate: '0 0' },
      ], { duration: 360, easing });
    }
  });
});
