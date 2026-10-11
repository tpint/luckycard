// Browser check for LuckyCard: plays the game in headless Chromium at phone size,
// checks the main flows, and saves screenshots to tests/screenshots/.
// Run: npm test   (first time: npm install && npx playwright install chromium)
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const url = 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');
const shots = path.join(__dirname, 'screenshots');
fs.mkdirSync(shots, { recursive: true });
const shot = (page, name, opts = {}) => page.screenshot({ path: path.join(shots, name + '.png'), ...opts });

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };

async function openGame(browser, saveData, options = {}) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, ...options });
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  page.on('console', m => m.type() === 'error' && !m.text().includes('navigator.vibrate') && page.errors.push(m.text()));
  await page.goto(url);
  await page.evaluate(s => localStorage.setItem('luckycard', JSON.stringify(s)), saveData);
  await page.reload();
  await page.waitForTimeout(800);
  return page;
}
const playUntilWin = async page => {
  while (!(await page.$('.tile.win'))) await page.locator('.tile:not(.revealed)').first().click();
};
const tileState = page => page.evaluate(() => [...document.querySelectorAll('.tile')].map(t => t.dataset.sym ?? '-').join(''));
const freshSave = cards => ({ bag: 0, cards, played: 0, wins: [0, 0, 0], upgrades: {} });

(async () => {
  // CHROMIUM_PATH lets the test use an already-installed Chromium (e.g. in cloud sandboxes)
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

  // --- Normal motion: refresh resume, gem burst, popup, empty state, shop ---
  const page = await openGame(browser, freshSave(['immortal', 'rare']));
  await shot(page, '1-start');
  check(await page.$('.card.current') !== null, 'current card is highlighted in the tray');

  const tiles = page.locator('.tile:not(.revealed)');
  await tiles.nth(0).click();
  await page.waitForTimeout(120);
  const fx = await page.evaluate(() => ({ shards: document.querySelectorAll('.fx.shard').length, sparks: document.querySelectorAll('.fx.spark').length, ring: document.querySelectorAll('.fx.ring').length }));
  check(fx.shards > 0 && fx.sparks > 0 && fx.ring === 1, `opening a tile bursts shards, sparkles and a ring (${JSON.stringify(fx)})`);
  check(await page.$('.tile.opened') !== null, 'opened tile bounces in');
  await shot(page, '1b-tile-open-burst');
  await page.waitForTimeout(900);
  check(await page.locator('.fx').count() === 0, 'open effects clean themselves up');
  await tiles.nth(3).click();
  const before = await tileState(page);
  await page.reload(); await page.waitForTimeout(800);
  check(before === await tileState(page), 'opened tiles survive a refresh');
  check(await page.textContent('#rarity') === 'Immortal', 'card rarity survives a refresh');
  await shot(page, '2-after-refresh');

  await playUntilWin(page);
  await page.waitForTimeout(950);
  const flying = await page.locator('.fly-gem').count();
  check(flying === 26, `immortal win sends 26 gems flying (got ${flying})`);
  await shot(page, '3-gems-flying');
  await page.waitForSelector('#overlay.show', { timeout: 5000 });
  await page.waitForTimeout(800);
  const bag = +(await page.textContent('#bagCount'));
  const popup = await page.textContent('#popReward');
  check(bag > 0 && popup === `💎 × ${bag}`, `counter and popup agree (${bag}, "${popup}")`);
  await shot(page, '4-popup');

  await page.click('#popBtn'); await page.waitForTimeout(300);
  await playUntilWin(page);
  await page.waitForSelector('#overlay.show', { timeout: 5000 });
  await page.click('#popBtn'); await page.waitForTimeout(600);
  const height = (await page.locator('#ticket').boundingBox()).height;
  check(height > 250, `empty ticket keeps its size (${Math.round(height)}px)`);
  await shot(page, '5-empty');

  await page.click('#shopBtn'); await page.waitForTimeout(300);
  check(await page.locator('.upgrade').count() === 3, 'shop shows 3 upgrades');
  await shot(page, '6-shop');
  check(page.errors.length === 0, `no page errors ${page.errors.length ? JSON.stringify(page.errors) : ''}`);
  await page.close();

  // --- Opening the 2nd copy of a symbol cheers "So close!" (card set up so the first two tiles are a pair) ---
  const seq = [0, 0, 1, 2, 2, 0];
  const cpage = await openGame(browser, { ...freshSave([]), round: { rarity: 'rare', winner: 0, sequence: seq, step: 0, counts: [0, 0, 0], tiles: Array(16).fill(null), done: false } });
  await cpage.locator('.tile').nth(0).click();
  await cpage.waitForTimeout(150);
  check(await cpage.locator('.fx.cheer').count() === 0, 'first copy of a symbol: no cheer');
  await cpage.waitForTimeout(800);
  await cpage.locator('.tile').nth(5).click();
  await cpage.waitForTimeout(250);
  check(await cpage.locator('.fx.cheer', { hasText: 'So close!' }).count() === 1, 'a pair shows the "So close!" cheer');
  await shot(cpage, '2b-so-close');
  check(cpage.errors.length === 0, 'pair cheer: no page errors');
  await cpage.close();

  // --- Get Cards limit, game over, leaderboard on this device (keeps upgrades on New game) ---
  const gpage = await openGame(browser, { ...freshSave(['rare']), bag: 50, refillsUsed: 1, upgrades: { luck: 2 } });
  check(await gpage.textContent('#refillsLeft') === '1 left', 'Get Cards shows refills left');
  const finishCard = async p => { await playUntilWin(p); await p.waitForSelector('#overlay.show', { timeout: 5000 }); await p.click('#popBtn'); await p.waitForTimeout(300); };
  await finishCard(gpage);
  check(!(await gpage.$('#over.show')), 'out of cards with a refill left: not game over yet');
  await gpage.click('#getCards'); await gpage.waitForTimeout(200);
  check(await gpage.isDisabled('#getCards') && await gpage.textContent('#refillsLeft') === '0 left', 'Get Cards is disabled after the last refill');
  await shot(gpage, '7-no-refills');
  for (let i = 0; i < 3; i++) {
    await playUntilWin(gpage);
    await gpage.waitForSelector('#overlay.show', { timeout: 5000 });
    if (i === 2) check(await gpage.textContent('#popBtn') === 'See results', 'last card\'s popup says "See results"');
    await gpage.click('#popBtn'); await gpage.waitForTimeout(300);
  }
  check(!!(await gpage.$('#over.show')), 'game over shows when cards and refills run out');
  const g = await gpage.evaluate(() => JSON.parse(localStorage.getItem('luckycard')));
  check(g.runGems > 0 && g.runGems === g.bag - 50 && +(await gpage.textContent('#runGems')) === g.runGems, `game over shows 💎 earned this game (${g.runGems})`);
  await shot(gpage, '8-game-over');
  await gpage.fill('#nameIn', '<i>Tester</i>');
  await gpage.click('#submitScore');
  await gpage.waitForSelector('#overBoard .ranks li.me', { timeout: 3000 });
  check(await gpage.textContent('#overBoard li.me .nm') === '<i>Tester</i>', 'submitted score is highlighted; names are shown as text, not HTML');
  check(await gpage.isHidden('#scoreForm'), 'name form hides after submitting');
  await shot(gpage, '9-leaderboard');
  await gpage.reload(); await gpage.waitForTimeout(800);
  check(!!(await gpage.$('#over.show')) && await gpage.isHidden('#scoreForm') && !!(await gpage.waitForSelector('#overBoard li.me')), 'game over + leaderboard survive a refresh without re-submitting');
  await gpage.click('#overShop'); await gpage.waitForTimeout(200);
  check(await gpage.isVisible('#shop .upgrade'), 'shop opens on top of the game over screen');
  await gpage.click('#shopClose');
  await gpage.click('#newGame'); await gpage.waitForTimeout(500);
  const n = await gpage.evaluate(() => JSON.parse(localStorage.getItem('luckycard')));
  check(n.bag === 0 && n.runGems === 0 && n.upgrades.luck === 2 && n.round && n.cards.length === 2 && !(await gpage.$('#over.show'))
    && await gpage.textContent('#refillsLeft') === '2 left', 'New game resets 💎, cards and refills but keeps upgrades');
  await gpage.click('#lbBtn');
  await gpage.waitForSelector('#lbBoard li.me', { timeout: 3000 });
  await gpage.waitForTimeout(300);
  check((await gpage.textContent('#lbBoard .lb-src')).includes('this device'), '🏆 shows the leaderboard (this device when not set up online)');
  await shot(gpage, '10-leaderboard-button');
  check(gpage.errors.length === 0, `game over: no page errors ${gpage.errors.length ? JSON.stringify(gpage.errors) : ''}`);
  await gpage.close();

  // --- Online leaderboard against a fake Supabase ---
  const opage = await openGame(browser, { ...freshSave([]), refillsUsed: 2, runGems: 40 });
  const db = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, name: 'Pro' + i, score: 100 + i, created_at: i }));
  let posts = 0, sawKey = true;
  await opage.route('https://lb.test/rest/v1/**', async route => {
    const req = route.request(), u = new URL(req.url());
    if (req.headers().apikey !== 'test-key') sawKey = false;
    if (req.method() === 'POST') {
      if (++posts === 1) return route.fulfill({ status: 503, body: 'down' }); // first try fails
      const row = { ...JSON.parse(req.postData()), id: db.length + 1, created_at: db.length };
      db.push(row);
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify([row]) });
    }
    if (req.method() === 'HEAD') {
      const gt = +u.searchParams.get('score').replace('gt.', '');
      return route.fulfill({ status: 200, headers: { 'content-range': `*/${db.filter(r => r.score > gt).length}`, 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range' } });
    }
    const limit = +u.searchParams.get('limit');
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([...db].sort((a, b) => b.score - a.score || a.created_at - b.created_at).slice(0, limit)) });
  });
  await opage.evaluate(() => { CONFIG.leaderboard.url = 'https://lb.test/'; CONFIG.leaderboard.key = 'test-key'; });
  check(!!(await opage.$('#over.show')), 'online: game over shows for a finished game');
  await opage.fill('#nameIn', 'Me');
  await opage.click('#submitScore'); await opage.waitForTimeout(300);
  check((await opage.textContent('#overBoard')).includes('Couldn’t send'), 'online: a failed submit says so and keeps the form');
  await opage.click('#submitScore');
  await opage.waitForSelector('#overBoard li.me', { timeout: 3000 });
  const top = await opage.locator('#overBoard li:not(.gap)').count();
  check(top === 11 && await opage.textContent('#overBoard li.me .pos') === '#13', `online: top 10 plus your rank when you're outside it (rows ${top}, ${await opage.textContent('#overBoard li.me .pos')})`);
  check(sawKey && (await opage.textContent('#overBoard .lb-src')) === 'All players', 'online: requests carry the API key; board says "All players"');
  await shot(opage, '11-online-leaderboard');
  check(opage.errors.filter(e => !e.includes('Failed to load resource')).length === 0, 'online: no page errors');
  await opage.close();

  // --- Reduced motion: no flying gems, counter glows and counts up ---
  const rpage = await openGame(browser, { ...freshSave(['immortal']), bag: 100 }, { reducedMotion: 'reduce' });
  await rpage.locator('.tile').first().click();
  await rpage.waitForTimeout(100);
  check(await rpage.$('.tile.glow') !== null && await rpage.locator('.fx.shard, .fx.spark, .fx.ring').count() === 0,
    'reduced motion: opened tile glows, no flying shards or sparkles');
  await playUntilWin(rpage);
  let sawGems = false, sawShine = false;
  for (let t = 0; t < 12; t++) {
    if (await rpage.locator('.fly-gem').count()) sawGems = true;
    if (await rpage.$('.bag.shine')) sawShine = true;
    await rpage.waitForTimeout(100);
  }
  check(!sawGems && sawShine, 'reduced motion: counter glows instead of flying gems');
  await rpage.waitForSelector('#overlay.show', { timeout: 3000 });
  await rpage.waitForTimeout(700);
  check(+(await rpage.textContent('#bagCount')) > 100, 'reduced motion: reward still added');
  check(rpage.errors.length === 0, 'reduced motion: no page errors');

  await browser.close();
  console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed. Screenshots: tests/screenshots/');
  process.exit(failures ? 1 : 0);
})();
