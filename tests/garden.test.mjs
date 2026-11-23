import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { after, before, test } from 'node:test';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium, devices } from 'playwright-core';

const origin = 'http://127.0.0.1:4173';
const base = origin + '/GlowWords/';
let browser;
let server;
before(async () => {
  server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--base', '/GlowWords/', '--host', '127.0.0.1', '--strictPort'], { stdio: 'inherit' });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await fetch(base).then(r => r.ok).catch(() => false)) break;
    await delay(100);
  }
  browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-fake-device-for-media-stream'] });
});
after(async () => { await browser?.close(); server?.kill(); });

async function openPuzzle(t, { dismissInstallOffer = true, beforeVisit, mockClock = false, ...options } = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...options });
  t.after(() => context.close());
  if (beforeVisit) await context.addInitScript(beforeVisit);
  const page = await context.newPage();
  if (mockClock) await page.clock.install();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, []));
  await page.goto(base);
  if (dismissInstallOffer) await page.getByRole('button', { name: 'Not now', exact: true }).click();
  await page.locator('[data-cell]').first().waitFor();
  return { page, context };
}

async function solve(page, wordCount) {
  await page.getByRole('grid').scrollIntoViewIfNeeded();
  const moves = await page.evaluate(() => {
    const cells = [...document.querySelectorAll('[data-cell]')];
    const size = Math.sqrt(cells.length);
    const center = cell => {
      const box = cell.getBoundingClientRect();
      return [box.x + box.width / 2, box.y + box.height / 2];
    };
    return [...document.querySelectorAll('.word-chips button')].map(button => {
      const word = button.textContent.trim();
      for (const cell of cells) {
        for (const dr of [-1, 0, 1]) for (const dc of [-1, 0, 1]) {
          if (!dr && !dc) continue;
          let end;
          if ([...word].every((letter, i) => {
            const row = Number(cell.dataset.row) + dr * i;
            const col = Number(cell.dataset.col) + dc * i;
            if (row < 0 || col < 0 || row >= size || col >= size) return false;
            end = cells[row * size + col];
            return end.textContent === letter;
          })) return [center(cell), center(end)];
        }
      }
      throw Error('Word missing from board: ' + word);
    });
  });
  for (const [start, end] of moves.slice(0, wordCount)) {
    await page.mouse.move(...start);
    await page.mouse.down();
    await page.mouse.move(...end, { steps: 6 });
    await page.mouse.up();
  }
}

test('settings and practice pause the current puzzle, and new settings survive reload', async t => {
  const { page } = await openPuzzle(t, { mockClock: true });
  const board = page.getByRole('grid');
  const original = await board.textContent();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('dialog', { name: 'Puzzle settings' }).waitFor();
  const time = await page.locator('.timer').textContent();
  await page.getByLabel('Reading level').selectOption('5-6');
  await page.clock.runFor(3200);
  assert.equal(await page.locator('.timer').textContent(), time);
  await page.keyboard.press('Escape');
  assert.equal(await board.textContent(), original);
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Settings');
  await page.getByRole('button', { name: /^Pause and practice/ }).first().click();
  await page.locator('.practice-card').waitFor();
  const practiceTime = await page.locator('.timer').textContent();
  await page.clock.runFor(2200);
  assert.equal(await page.locator('.timer').textContent(), practiceTime);
  await page.getByRole('button', { name: 'Return to game', exact: true }).last().click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Reading level').selectOption('5-6');
  await page.getByLabel('Time', { exact: true }).selectOption('60');
  await page.getByRole('button', { name: 'Start new puzzle' }).click();
  await page.waitForFunction(() => document.querySelectorAll('[data-cell]').length === 64);
  await page.getByRole('button', { name: 'Turn sound off' }).click();
  await page.reload();
  await page.getByRole('gridcell').first().waitFor();
  assert.equal(await page.getByRole('gridcell').count(), 64);
  assert.equal(await page.getByRole('button', { name: 'Turn sound on' }).count(), 1);
  await page.clock.runFor(61000);
  await page.getByRole('heading', { name: 'Time’s up!' }).waitFor();
  assert.equal(await page.locator('.win-confetti').count(), 0);
});

test('sharing the public game link pauses the puzzle until the native sheet closes', async t => {
  const { page } = await openPuzzle(t, { beforeVisit: () => {
    Object.defineProperty(navigator, 'share', { value: data => new Promise((resolve, reject) => {
      window.shareRequest = { data, active: navigator.userActivation.isActive, resolve, reject };
    }) });
  } });
  const share = page.getByRole('button', { name: 'Share Glow Words' });
  await share.click();
  assert.deepEqual(await page.evaluate(() => window.shareRequest.data),
    { title: 'Glow Words', url: 'https://words.chrisawad.com/' });
  assert.ok(await page.evaluate(() => window.shareRequest.active));
  const time = await page.locator('.timer').textContent();
  await delay(1250);
  assert.equal(await page.locator('.timer').textContent(), time);
  await page.evaluate(() => window.shareRequest.reject(new DOMException('Canceled', 'AbortError')));
  await page.waitForFunction(previous => document.querySelector('.timer').textContent !== previous, time);
  assert.equal(await page.getByRole('dialog').count(), 0);
  await share.click();
  await page.evaluate(() => window.shareRequest.resolve());
  assert.equal(await page.getByRole('dialog').count(), 0);
  await share.click();
  await page.evaluate(() => window.shareRequest.reject(new DOMException('Blocked', 'NotAllowedError')));
  await page.getByRole('dialog', { name: 'Share Glow Words' }).waitFor();
});

test('sharing without a system sheet supports clipboard and manual copying', async t => {
  const { page, context } = await openPuzzle(t, { beforeVisit: () => {
    Object.defineProperty(navigator, 'share', { value: undefined });
  } });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const share = page.locator('header').getByRole('button', { name: 'Share Glow Words' });
  const icon = share.locator('svg');
  const label = share.getByText('Share', { exact: true });
  for (const [width, height] of [[320, 640], [351, 640], [375, 812], [390, 844], [412, 915], [421, 915], [568, 320], [686, 320], [740, 360], [844, 390], [1024, 768], [1280, 800]]) {
    await page.setViewportSize({ width, height });
    assert.ok(await icon.isVisible() && await label.isVisible(), `share icon and label at ${width} × ${height}`);
    const [buttonBox, iconBox, labelBox] = await Promise.all([share.boundingBox(), icon.boundingBox(), label.boundingBox()]);
    assert.ok(buttonBox.x <= iconBox.x && iconBox.x + iconBox.width <= labelBox.x
      && labelBox.x + labelBox.width <= buttonBox.x + buttonBox.width, 'share icon beside label inside button');
    assert.ok(await page.locator('.hud').evaluate(hud => {
      const header = hud.parentElement.getBoundingClientRect();
      return [...hud.children].every(control => {
        const box = control.getBoundingClientRect();
        return box.left >= header.left - 1 && box.right <= header.right + 1
          && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight;
      });
    }), `header at ${width} × ${height}`);
    await share.click({ trial: true });
  }
  await share.click();
  const dialog = page.getByRole('dialog', { name: 'Share Glow Words' });
  const field = dialog.getByLabel('Game link');
  const url = 'https://words.chrisawad.com/';
  assert.equal(await field.inputValue(), url);
  await dialog.getByRole('button', { name: 'Copy link' }).click();
  await dialog.getByText('Link copied.').waitFor();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), url);
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { value: undefined }));
  await dialog.getByRole('button', { name: 'Copy link' }).click();
  await dialog.getByText(/selected link/).waitFor();
  assert.ok(await field.evaluate(input => input === document.activeElement
    && input.selectionStart === 0 && input.selectionEnd === input.value.length));
  await page.keyboard.press('Escape');
  assert.ok(await share.evaluate(button => button === document.activeElement));
});

test('finding every word plays the shared celebration once and replay clears the trail', async t => {
  const { page } = await openPuzzle(t);
  await page.evaluate(() => {
    window.voices = 0;
    window.spoken = [];
    speechSynthesis.speak = utterance => window.spoken.push(utterance.text);
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) { window.voices++; return start.apply(this, args); };
  });
  const words = await page.locator('.word-chips button').allTextContents();
  await solve(page);
  await page.getByRole('dialog', { name: 'You found every spark!' }).waitFor();
  await page.waitForFunction(() => window.voices === 1);
  const expectedSpeech = words.flatMap(word => [word.toLowerCase(), ...word, word.toLowerCase()]);
  await page.waitForFunction(length => window.spoken.length === length, expectedSpeech.length);
  assert.deepEqual(await page.evaluate(() => window.spoken), expectedSpeech);
  assert.equal(await page.locator('.found-word').count(), 8);
  assert.equal(await page.locator('.win-confetti').count(), 1);
  await page.getByRole('button', { name: 'Play another puzzle' }).click();
  await page.getByRole('gridcell').first().waitFor();
  assert.equal(await page.locator('.found-word').count(), 0);
  assert.equal(await page.locator('dialog').count(), 0);
});

test('small-screen win respects mute and reduced motion', async t => {
  const { page } = await openPuzzle(t, { viewport: { width: 320, height: 640 }, reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Turn sound off' }).click();
  await page.evaluate(() => {
    window.contexts = 0;
    const Audio = window.AudioContext;
    window.AudioContext = class extends Audio { constructor(...args) { super(...args); window.contexts++; } };
  });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await solve(page);
  await page.getByRole('dialog', { name: 'You found every spark!' }).waitFor();
  assert.equal(await page.evaluate(() => window.contexts), 0);
  assert.equal(await page.locator('.win-confetti').evaluate(canvas => canvas.width), 300);
  await page.keyboard.press('Escape');
  const replay = page.getByRole('button', { name: 'Play another puzzle' });
  await replay.waitFor();
  await page.setViewportSize({ width: 740, height: 360 });
  const replayBox = await replay.boundingBox();
  assert.ok(replayBox.y >= 0 && replayBox.y + replayBox.height <= 360);
  await replay.click();
  await page.getByRole('gridcell').first().waitFor();
  assert.equal(await page.locator('.found-word').count(), 0);
});

test('landscape keeps the board, controls and practice actions in reach after rotation', async t => {
  const { page } = await openPuzzle(t, { viewport: { width: 390, height: 844 }, hasTouch: true });
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Reading level').selectOption('13+');
  await page.getByRole('button', { name: 'Start new puzzle' }).click();
  await page.waitForFunction(() => document.querySelectorAll('[data-cell]').length === 256);
  const letters = await page.getByRole('grid').textContent();
  for (const [width, height] of [[740, 360], [568, 320], [844, 390]]) {
    await page.setViewportSize({ width, height });
    const board = await page.getByRole('grid').boundingBox();
    assert.ok(board.width >= height * .89, JSON.stringify(board));
    assert.ok(board.y >= 0 && board.y + board.height <= height);
    assert.equal(await page.getByRole('grid').textContent(), letters);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight));
    const word = page.locator('.word-chips button').last();
    await word.click();
    for (const action of ['.practice-listen', '.practice-record', '.practice-return']) {
      const box = await page.locator(action).boundingBox();
      assert.ok(box.y >= 0 && box.y + box.height <= height, action);
    }
    await page.locator('.practice-return').click();
  }
});

test('landscape board side changes mid-puzzle and survives rotation and reload', async t => {
  const phone = { width: 740, height: 360 };
  const tablet = { width: 1024, height: 768 };
  const { page } = await openPuzzle(t, { viewport: phone });
  const board = page.getByRole('region', { name: 'Letter garden' });
  const trail = page.getByRole('region', { name: 'Word trail' });
  const settings = page.getByRole('button', { name: 'Settings', exact: true });
  const side = page.getByLabel('Landscape board side');
  async function checkSide(expected, viewport) {
    await page.setViewportSize(viewport);
    const [boardBox, trailBox] = await Promise.all([board.boundingBox(), trail.boundingBox()]);
    const [left, right] = expected === 'left' ? [boardBox, trailBox] : [trailBox, boardBox];
    assert.ok(left.x + left.width <= right.x);
    if (viewport.height <= 580) {
      const controls = await page.locator('.game-header').boundingBox();
      assert.ok(Math.abs(controls.x - trailBox.x) < 1);
    }
  }
  await checkSide('right', tablet);
  await checkSide('right', phone);
  await solve(page, 1);
  const letters = await page.getByRole('grid').textContent();
  await settings.click();
  assert.equal(await side.inputValue(), 'right');
  await side.selectOption('left');
  await page.getByRole('button', { name: 'Back to current puzzle' }).click();
  await checkSide('left', phone);
  assert.equal(await page.getByRole('grid').textContent(), letters);
  assert.equal(await page.locator('.found-word').count(), 1);
  await page.setViewportSize({ width: 390, height: 844 });
  const [top, bottom] = await Promise.all([board.boundingBox(), trail.boundingBox()]);
  assert.ok(top.y + top.height <= bottom.y);
  await checkSide('left', tablet);
  await page.reload();
  await page.getByRole('gridcell').first().waitFor();
  await checkSide('left', phone);
  await settings.click();
  assert.equal(await side.inputValue(), 'left');
  await side.selectOption('right');
  await page.getByRole('button', { name: 'Start new puzzle' }).click();
  await page.getByRole('gridcell').first().waitFor();
  await checkSide('right', phone);
});

test('plain HTTP explains microphone access and keeps read-aloud available', async t => {
  const { page } = await openPuzzle(t);
  await page.route('http://lan-preview.test/**', async route => {
    const url = new URL(route.request().url());
    const response = await page.request.get(origin + url.pathname + url.search);
    await route.fulfill({ response });
  });
  await page.goto('http://lan-preview.test/GlowWords/');
  await page.getByRole('button', { name: 'Not now' }).click();
  await page.getByRole('button', { name: /^Pause and practice/ }).first().click();
  assert.equal(await page.evaluate(() => isSecureContext), false);
  assert.equal(await page.getByRole('button', { name: /Say the word/ }).isDisabled(), true);
  assert.match(await page.locator('#practice-message').innerText(), /HTTPS/);
  await page.evaluate(() => { speechSynthesis.speak = utterance => { window.heard = utterance.text; }; });
  await page.locator('.practice-listen').click();
  assert.ok(await page.evaluate(() => window.heard?.length > 0));
  assert.match(await page.locator('.practice-return').innerText(), /\+10 seconds/);
});

test('saying a word works with recognition alone and awards the speaking bonus', async t => {
  const { page, context } = await openPuzzle(t);
  await context.grantPermissions(['microphone'], { origin });
  await page.evaluate(() => {
    Object.defineProperty(window, 'MediaRecorder', { configurable: true, value: undefined });
    window.SpeechRecognition = class {
      start() { window.recognizer = this; }
      abort() {}
    };
  });
  const first = page.locator('.word-chips button').first();
  const word = await first.textContent();
  await first.click();
  await page.getByRole('button', { name: /Say the word/ }).click();
  await page.waitForFunction(() => !!window.recognizer);
  await page.evaluate(() => window.recognizer.onstart());
  await page.getByText('Go! I’m listening', { exact: true }).waitFor();
  await page.evaluate(text => window.recognizer.onresult({ results: [[{ transcript: 'other' }, { transcript: text }]] }), word.toLowerCase());
  await page.getByRole('heading', { name: 'You said it!' }).waitFor();
  await page.waitForFunction(() => !document.querySelector('.practice-card'));
  assert.ok(+((await page.locator('.timer strong').innerText()).split(':')[1]) >= 15);
});

test('a browser without recognition can record the word and play it back', async t => {
  const { page, context } = await openPuzzle(t);
  await context.grantPermissions(['microphone'], { origin });
  await page.evaluate(() => { window.SpeechRecognition = undefined; window.webkitSpeechRecognition = undefined; });
  await page.locator('.word-chips button').first().click();
  await page.getByRole('button', { name: /Say the word/ }).click();
  await page.getByRole('button', { name: /Stop recording/ }).waitFor();
  // Give the virtual microphone time to produce an audio frame.
  await delay(300);
  await page.getByRole('button', { name: /Stop recording/ }).click();
  await page.locator('.practice-review audio').waitFor();
  assert.match(await page.locator('.practice-review audio').getAttribute('src'), /^blob:/);
  await page.getByRole('button', { name: 'That sounded great!' }).click();
  await page.getByRole('heading', { name: 'You said it!' }).waitFor();
});

test('Android players can get install help from Settings without a native prompt', async t => {
  const { page, context } = await openPuzzle(t, {
    ...devices['Pixel 7'], dismissInstallOffer: false,
    beforeVisit: () => {
      Object.defineProperty(navigator, 'install', { value: undefined });
      Object.defineProperty(navigator, 'getInstalledRelatedApps', { value: async () => [] });
      window.addEventListener('beforeinstallprompt', event => {
        event.preventDefault();
        event.stopImmediatePropagation();
      });
      // A past installation can suppress the offer without confirming a current install.
      localStorage.setItem('glowwords.installConfirmed', '1');
    },
  });
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Puzzle settings' });
  await settings.getByText('How to install', { exact: true }).click();
  await settings.getByText('Open in Chrome', { exact: true }).waitFor();
  await settings.getByText(/paste the link into its address bar/).waitFor();
  await settings.getByText('Add to Home screen', { exact: true }).waitFor();
  await settings.getByText(/open the app drawer/).waitFor();
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await settings.getByRole('button', { name: 'Copy link' }).click();
  await settings.getByText('Link copied.').waitFor();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'https://words.chrisawad.com/');
  await settings.getByRole('button', { name: 'Back to current puzzle' }).click();
  await page.getByRole('button', { name: 'Install Glow Words' }).click();
  const install = page.getByRole('dialog', { name: 'Install Glow Words' });
  await install.getByText('Open in Chrome', { exact: true }).waitFor();
  assert.equal(await install.getByRole('button', { name: 'Install app', exact: true }).count(), 0);
});

test('install dialog offers help, consumes native prompts once and hides after install', async t => {
  const { page } = await openPuzzle(t, { mockClock: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' });
  await page.evaluate(() => Object.defineProperty(navigator, 'install', { configurable: true, value: undefined }));
  await page.getByRole('button', { name: 'Install Glow Words' }).click();
  await page.getByRole('dialog', { name: 'Install Glow Words' }).waitFor();
  // Chromium may issue a real install event. Use an explicit one to exercise cancellation.
  const sendPrompt = outcome => page.evaluate(value => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    event.prompt = async () => { window.prompts = (window.prompts ?? 0) + 1; };
    event.userChoice = Promise.resolve({ outcome: value });
    window.dispatchEvent(event);
  }, outcome);
  await sendPrompt('dismissed');
  await page.getByRole('button', { name: 'Install app', exact: true }).click();
  await page.getByText('Installation canceled.').waitFor();
  await page.getByText('Add to Home Screen', { exact: true }).waitFor();
  const time = await page.locator('.timer').textContent();
  await page.clock.runFor(3000);
  assert.equal(await page.locator('.timer').textContent(), time);
  await sendPrompt('accepted');
  await page.getByRole('button', { name: 'Install app', exact: true }).click();
  await page.getByText('Glow Words is installed.').waitFor();
  assert.equal(await page.evaluate(() => window.prompts), 2);
  await page.getByRole('button', { name: 'Back to puzzle' }).click();
  assert.equal(await page.getByRole('button', { name: 'Install Glow Words' }).count(), 0);
});

test('automatic install offer pauses play and appears once per tab session', async t => {
  const { page } = await openPuzzle(t, { dismissInstallOffer: false, mockClock: true });
  const offer = page.getByRole('dialog', { name: 'Install Glow Words' });
  await offer.waitFor();
  const time = await page.locator('.timer').textContent();
  await page.clock.runFor(3200);
  assert.equal(await page.locator('.timer').textContent(), time);
  await offer.getByRole('button', { name: 'Not now' }).click();
  await page.getByRole('gridcell').first().waitFor();
  await page.reload();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Start new puzzle' }).click();
  await page.getByRole('gridcell').first().waitFor();
  await page.getByRole('button', { name: 'Install Glow Words' }).click();
  await offer.getByRole('button', { name: 'Back to puzzle' }).click();
});

test('waits for an installed-app check before offering installation', async t => {
  const { page } = await openPuzzle(t, {
    ...devices['Pixel 7'],
    dismissInstallOffer: false,
    beforeVisit: () => {
      Object.defineProperty(navigator, 'getInstalledRelatedApps', { value: () => new Promise(resolve => {
        window.finishInstallCheck = () => resolve([{ platform: 'webapp', id: new URL('./', location.href).href }]);
      }) });
    },
  });
  assert.equal(await page.getByRole('dialog').count(), 0);
  await page.evaluate(() => window.finishInstallCheck());
  await page.waitForFunction(() => !document.querySelector('.install-button'));
  assert.equal(await page.getByRole('dialog').count(), 0);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByText('Where to find Glow Words', { exact: true }).click();
  await page.getByText(/open the app drawer/).waitFor();
  assert.equal(await page.getByText('How to install', { exact: true }).count(), 0);
});

test('automatic offer uses the browser install API only in the button gesture', async t => {
  const { page } = await openPuzzle(t, {
    dismissInstallOffer: false,
    beforeVisit: () => {
      Object.defineProperty(navigator, 'install', { configurable: true, value: async () => {
        window.wasActivated = navigator.userActivation.isActive;
      } });
    },
  });
  await page.getByRole('dialog', { name: 'Install Glow Words' }).waitFor();
  assert.equal(await page.evaluate(() => window.wasActivated), undefined);
  await page.getByRole('button', { name: 'Install app', exact: true }).click();
  await page.getByRole('gridcell').first().waitFor();
  assert.equal(await page.getByRole('button', { name: 'Install Glow Words' }).count(), 0);
  assert.equal(await page.evaluate(() => window.wasActivated), true);
});

test('Pages-scoped manifest, artwork, fonts, sound and puzzle load offline', async t => {
  const { page, context } = await openPuzzle(t);
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  const cache = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    const name = (await caches.keys()).find(name => name.startsWith('glowwords:' + registration.scope + ':'));
    return (await (await caches.open(name)).keys()).map(request => request.url);
  });
  assert.ok(cache.every(url => url.startsWith(base)));
  for (const ext of ['.js', '.css', '.woff2', '.wav', '.webp', '.png', '.webmanifest']) assert.ok(cache.some(url => url.endsWith(ext)), ext);
  const manifest = await page.evaluate(async () => (await fetch(document.querySelector('link[rel=manifest]').href)).json());
  const launcherIcon = manifest.icons.find(icon => icon.purpose === 'maskable');
  assert.ok(launcherIcon, 'The home-screen launcher needs a maskable icon');
  const launcherUrl = new URL(launcherIcon.src, base);
  assert.ok(cache.includes(launcherUrl.href));
  const iconResponse = await context.request.get(launcherUrl.href);
  assert.equal(iconResponse.status(), 200);
  const iconHash = createHash('sha256').update(await iconResponse.body()).digest('hex').slice(0, 8);
  assert.ok(launcherUrl.pathname.endsWith(`.${iconHash}.png`), 'New icon artwork needs a new URL for installed apps');
  const protocol = await context.newCDPSession(page);
  const { appId } = await protocol.send('Page.getAppId');
  assert.equal(appId, base);
  assert.equal(new URL(manifest.start_url, base).href, base);
  assert.equal(new URL(manifest.scope, base).href, base);
  await context.setOffline(true);
  await page.goto(base + '?offline=1');
  await page.getByRole('gridcell').first().waitFor();
  assert.equal(await page.getByRole('gridcell').count(), 100);
  await page.evaluate(() => document.fonts.ready);
  assert.ok(await page.evaluate(() => document.fonts.check('bold 16px Fredoka')));
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Start new puzzle' }).click();
  await page.getByRole('gridcell').first().waitFor();
});

test('Chromium installs the Pages app in a fresh regular profile', async t => {
  const context = await chromium.launchPersistentContext('', { executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  t.after(() => context.close());
  const page = await context.newPage();
  await page.goto(base);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  const protocol = await context.newCDPSession(page);
  assert.deepEqual((await protocol.send('Page.getInstallabilityErrors')).installabilityErrors, []);
  await protocol.send('PWA.install', { manifestId: base, installUrlOrBundleUrl: base });
  await protocol.send('PWA.changeAppUserSettings', { manifestId: base, displayMode: 'standalone' });
  const opening = context.waitForEvent('page');
  await protocol.send('PWA.launch', { manifestId: base });
  const installedGame = await opening;
  await installedGame.getByRole('gridcell').first().waitFor();
  assert.equal(await installedGame.evaluate(() => matchMedia('(display-mode: standalone)').matches), true);
  assert.equal(await installedGame.getByRole('button', { name: 'Install Glow Words' }).count(), 0);
  await installedGame.getByRole('button', { name: 'Settings', exact: true }).click();
  await installedGame.getByText('Where to find Glow Words', { exact: true }).click();
  await installedGame.getByText(/computer’s apps/).waitFor();
  const returningTab = await context.newPage();
  await returningTab.goto(base);
  await returningTab.getByRole('gridcell').first().waitFor();
  await returningTab.getByRole('button', { name: 'Settings', exact: true }).click();
  await returningTab.getByRole('dialog', { name: 'Puzzle settings' }).waitFor();
});
