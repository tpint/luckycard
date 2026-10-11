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
  await fakeSupabase(page);
  await page.goto(url);
  await page.evaluate(s => localStorage.setItem('luckycard', JSON.stringify(s)), saveData);
  await page.reload();
  await page.waitForTimeout(800);
  return page;
}
// Every page talks to an in-memory fake of Supabase's REST API, so tests never touch the real leaderboard.
// page.fake: { db (rows), failNextPost, keys (apikey headers seen) }
async function fakeSupabase(page) {
  const fake = page.fake = { db: [], failNextPost: false, keys: new Set() };
  const cors = { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range' };
  await page.route('**/rest/v1/**', async route => {
    const req = route.request(), u = new URL(req.url()), db = fake.db;
    fake.keys.add(req.headers().apikey);
    if (req.method() === 'POST') {
      if (fake.failNextPost) { fake.failNextPost = false; return route.fulfill({ status: 503, headers: cors, body: 'down' }); }
      const row = { ...JSON.parse(req.postData()), id: db.length + 1, created_at: db.length };
      db.push(row);
      return route.fulfill({ status: 201, headers: cors, contentType: 'application/json', body: JSON.stringify([row]) });
    }
    if (req.method() === 'HEAD') {
      const gt = +u.searchParams.get('score').replace('gt.', '');
      return route.fulfill({ status: 200, headers: { ...cors, 'content-range': `*/${db.filter(r => r.score > gt).length}` } });
    }
    const limit = +u.searchParams.get('limit');
    return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify([...db].sort((a, b) => b.score - a.score || a.created_at - b.created_at).slice(0, limit)) });
  });
}
const playUntilWin = async page => {
  while (!(await page.$('.tile.win'))) await page.locator('.tile:not(.revealed)').first().click();
};
// After a win the next card deals itself (or the empty / game over state shows)
const waitNextCard = p => p.waitForFunction(() => !document.querySelector('.tile.win'), null, { timeout: 8000 });
const tileState = page => page.evaluate(() => [...document.querySelectorAll('.tile')].map(t => t.dataset.sym ?? '-').join(''));
const freshSave = cards => ({ bag: 0, cards, played: 0, wins: [0, 0, 0], upgrades: {} });

(async () => {
  // CHROMIUM_PATH lets the test use an already-installed Chromium (e.g. in cloud sandboxes)
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

  // --- Normal motion: refresh resume, gem burst, reveal-all, auto next card, empty state, shop ---
  const page = await openGame(browser, freshSave(['immortal', 'rare']));
  await shot(page, '1-start');
  check(await page.$('.card.current') !== null, 'current card is highlighted in the tray');
  const art = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll('img.ico')];
    return { n: imgs.length, broken: imgs.filter(i => !i.complete || !i.naturalWidth).map(i => i.src), cards: [...document.querySelectorAll('.card.art')].length };
  });
  check(art.n > 0 && art.broken.length === 0 && art.cards === 2, `art images load (${art.n} icons, ${art.cards} card backs${art.broken.length ? ', broken: ' + art.broken : ''})`);

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
  check(await page.locator('.tile.revealed').count() === 16, 'after a win the whole card reveals itself');
  check(await page.isVisible('#banner') && !(await page.$('.overlay.show')), 'win shows a banner on the card, no popup to tap');
  await shot(page, '3-gems-flying');
  await page.waitForTimeout(1300);
  const bag = +(await page.textContent('#bagCount'));
  check(bag > 0 && +(await page.textContent('#bannerGems')) === bag && +(await page.textContent('#runCount')) === bag,
    `banner, 💎 counter and "This game" counter agree (${bag})`);
  await shot(page, '4-win-banner');
  await waitNextCard(page);
  check(await page.textContent('#rarity') === 'Rare' && !(await page.isVisible('#banner')), 'next card deals itself without a tap');
  check((await page.textContent('#stats')).startsWith('Played 1'), 'stats count the win');

  await playUntilWin(page);
  await page.waitForTimeout(700);
  const tapAt = Date.now();
  await page.click('#ticket');
  await waitNextCard(page);
  check(Date.now() - tapAt < 500 && await page.isVisible('#empty'), 'tapping a finished card skips straight ahead');
  await page.waitForTimeout(1500);
  const height = (await page.locator('#ticket').boundingBox()).height;
  check(height > 250, `empty ticket keeps its size (${Math.round(height)}px)`);
  await shot(page, '5-empty');

  await page.click('#shopBtn'); await page.waitForTimeout(300);
  check(await page.locator('.upgrade').count() === 3, 'shop shows 3 upgrades');
  await shot(page, '6-shop');
  check(page.errors.length === 0, `no page errors ${page.errors.length ? JSON.stringify(page.errors) : ''}`);
  await page.close();

  // --- Real board: every tile has its symbol from the start; blanks, "So close!", Open all ---
  const b = Array(16).fill(-1); b[0] = 0; b[5] = 0; b[9] = 0; b[3] = 1; b[7] = 2; b[8] = 2;
  const cpage = await openGame(browser, { ...freshSave([]), round: { rarity: 'rare', winner: 0, board: b, opened: Array(16).fill(false), counts: [0, 0, 0], done: false } });
  const boards = await cpage.evaluate(() => Array.from({ length: 300 }, (_, k) => ({ w: k % 3, b: buildBoard(k % 3) })));
  const count = (b, s) => b.filter(x => x === s).length;
  check(boards.every(({ w, b }) => b.length === 16 && [0, 1, 2].every(s => s === w ? count(b, s) === 3 : count(b, s) <= 2)),
    'every new board: 16 tiles, exactly 3 of the winner, at most 2 of each other prize, the rest blank');
  await cpage.locator('.tile').nth(15).click();
  await cpage.waitForTimeout(150);
  check(await cpage.$('.tile:nth-child(16) .face .blank') !== null && await cpage.locator('.fx.cheer').count() === 0, 'a "no prize" tile shows a blank');
  await cpage.locator('.tile').nth(0).click();
  await cpage.waitForTimeout(150);
  check(await cpage.locator('.fx.cheer').count() === 0, 'first copy of a symbol: no cheer');
  await cpage.waitForTimeout(800);
  await cpage.locator('.tile').nth(5).click();
  await cpage.waitForTimeout(250);
  check(await cpage.locator('.fx.cheer', { hasText: 'So close!' }).count() === 1, 'a pair shows the "So close!" cheer (tiles open in any order)');
  await shot(cpage, '2b-so-close');
  await cpage.waitForTimeout(800);
  await cpage.click('#openAll');
  await cpage.waitForSelector('.tile.win', { timeout: 5000 });
  const won = await cpage.evaluate(() => [...document.querySelectorAll('.tile.win')].map(t => [...t.parentNode.children].indexOf(t)).join());
  check(won === '0,5,9', `Open all scratches the card until the prize is found (wins on tiles ${won})`);
  await cpage.waitForTimeout(1200);
  check(await cpage.locator('.tile.revealed').count() === 16, 'Open all: the rest of the card reveals itself');
  await shot(cpage, '2c-reveal-all');
  check(cpage.errors.length === 0, 'real board: no page errors');
  await cpage.close();

  // --- A card saved by an older version (symbols handed out in tap order) still plays ---
  const old = { rarity: 'epic', winner: 1, sequence: [2, 1, 1, 0, 1], step: 2, counts: [0, 2, 1], tiles: [2, 1, ...Array(14).fill(null)], done: false };
  const mpage = await openGame(browser, { ...freshSave([]), round: old });
  const m = await mpage.evaluate(() => JSON.parse(localStorage.getItem('luckycard')).round);
  check(m.board.length === 16 && m.board[0] === 2 && m.board[1] === 1 && m.board.filter(x => x === 1).length === 3 && m.opened.filter(Boolean).length === 2
    && await mpage.locator('.tile.revealed').count() === 2, 'old in-progress card is converted to a full board');
  await playUntilWin(mpage);
  check(+(await mpage.evaluate(() => JSON.parse(localStorage.getItem('luckycard')).wins[1])) === 1 && mpage.errors.length === 0, 'old card: still wins its prize');
  await mpage.close();

  // --- Get Cards limit, game over, leaderboard (keeps upgrades on New game) ---
  const gpage = await openGame(browser, { ...freshSave(['rare']), bag: 50, refillsUsed: 1, upgrades: { luck: 2 } });
  check(await gpage.textContent('#refillsLeft') === '1 left', 'Get Cards shows refills left');
  const finishCard = async p => { await playUntilWin(p); await waitNextCard(p); await p.waitForTimeout(200); };
  await finishCard(gpage);
  check(!(await gpage.$('#over.show')), 'out of cards with a refill left: not game over yet');
  await gpage.click('#getCards'); await gpage.waitForTimeout(200);
  check(await gpage.isDisabled('#getCards') && await gpage.textContent('#refillsLeft') === '0 left', 'Get Cards is disabled after the last refill');
  await shot(gpage, '7-no-refills');
  for (let i = 0; i < 3; i++) await finishCard(gpage);
  check(!!(await gpage.waitForSelector('#over.show', { timeout: 3000 })), 'game over shows by itself when cards and refills run out');
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
  check(n.bag === g.bag && n.runGems === 0 && n.upgrades.luck === 2 && n.round && n.cards.length === 2 && !(await gpage.$('#over.show'))
    && await gpage.textContent('#refillsLeft') === '2 left' && +(await gpage.textContent('#bagCount')) === g.bag && await gpage.textContent('#runCount') === '0',
    `New game keeps 💎 (${n.bag}) and upgrades; resets cards, refills and "This game"`);
  await gpage.click('#lbBtn');
  await gpage.waitForSelector('#lbBoard li.me', { timeout: 3000 });
  await gpage.waitForTimeout(300);
  check(await gpage.textContent('#lbBoard .lb-src') === 'All players' && gpage.fake.db.length === 1, '🏆 shows the online leaderboard with your score');
  await shot(gpage, '10-leaderboard-button');
  check(gpage.errors.length === 0, `game over: no page errors ${gpage.errors.length ? JSON.stringify(gpage.errors) : ''}`);
  await gpage.close();

  // --- Online leaderboard against a fake Supabase ---
  const opage = await openGame(browser, { ...freshSave([]), refillsUsed: 2, runGems: 40 });
  opage.fake.db.push(...Array.from({ length: 12 }, (_, i) => ({ id: i + 1, name: 'Pro' + i, score: 100 + i, created_at: i })));
  opage.fake.failNextPost = true; // first submit fails
  check(!!(await opage.$('#over.show')), 'online: game over shows for a finished game');
  await opage.fill('#nameIn', 'Me');
  await opage.click('#submitScore'); await opage.waitForTimeout(300);
  check((await opage.textContent('#overBoard')).includes('Couldn’t send'), 'online: a failed submit says so and keeps the form');
  await opage.click('#submitScore');
  await opage.waitForSelector('#overBoard li.me', { timeout: 3000 });
  const top = await opage.locator('#overBoard li:not(.gap)').count();
  check(top === 11 && await opage.textContent('#overBoard li.me .pos') === '#13', `online: top 10 plus your rank when you're outside it (rows ${top}, ${await opage.textContent('#overBoard li.me .pos')})`);
  const keys = [...opage.fake.keys];
  check(keys.length === 1 && keys[0].startsWith('sb_publishable_') && (await opage.textContent('#overBoard .lb-src')) === 'All players', `online: requests carry the publishable key; board says "All players" (${keys})`);
  await shot(opage, '11-online-leaderboard');
  check(opage.errors.filter(e => !e.includes('Failed to load resource')).length === 0, 'online: no page errors');
  await opage.close();

  // --- With url/key cleared, scores stay on this device ---
  const dpage = await openGame(browser, { ...freshSave([]), refillsUsed: 2, runGems: 12 });
  await dpage.evaluate(() => { CONFIG.leaderboard.url = ''; CONFIG.leaderboard.key = ''; });
  await dpage.fill('#nameIn', 'Local');
  await dpage.click('#submitScore');
  await dpage.waitForSelector('#overBoard li.me', { timeout: 3000 });
  check((await dpage.textContent('#overBoard .lb-src')).includes('this device') && dpage.fake.db.length === 0
    && (await dpage.evaluate(() => JSON.parse(localStorage.getItem('luckycard-scores')).length)) === 1, 'no url/key: score is saved on this device, nothing sent online');
  check(dpage.errors.length === 0, 'on-device: no page errors');
  await dpage.close();

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
  await waitNextCard(rpage);
  check(+(await rpage.textContent('#bagCount')) > 100 && await rpage.isVisible('#empty'), 'reduced motion: reward still added, then moves on by itself');
  check(rpage.errors.length === 0, 'reduced motion: no page errors');

  await browser.close();
  console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed. Screenshots: tests/screenshots/');
  process.exit(failures ? 1 : 0);
})();
