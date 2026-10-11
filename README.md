# LuckyCard

A scratch-card game prototype: one HTML file plus its art in `assets/`. Each card is a 4×4 grid of tiles; tap tiles to open them and find **3 matching patterns** to win that prize. Every card wins (100% win rate) — the prize tier and card rarity decide how much.

## Play

Open `index.html` in a browser (keep the `assets/` folder next to it). No build step or dependencies.

Progress (💎 total, remaining cards, Get Cards left, the card in play with its opened tiles, upgrades, stats) is saved in the browser's `localStorage`; the on-device leaderboard is under `luckycard-scores`. Use **reset progress** at the bottom of the page to start over.

## How it works

- **Prizes:** 1st 🍰 (3 💎), 2nd 🍩 (2 💎), 3rd 🍬 (1 💎). Odds per card: 10% / 30% / 60%.
- **Card rarity** multiplies the reward:

  | Rarity    | Drop rate | Multiplier |
  |-----------|-----------|------------|
  | Rare      | 40%       | ×1         |
  | Epic      | 30%       | ×2         |
  | Legendary | 20%       | ×5         |
  | Immortal  | 10%       | ×20        |

- You start with 3 cards; **Get Cards** adds 3 more (free in the prototype) and can be used **2 times per game** (the button shows how many are left).
- **Game over:** when you're out of cards and Get Cards is used up, the game ends. Enter your name to put the 💎 you earned this game on the 🏆 leaderboard (spending 💎 on upgrades doesn't lower your score). **New game** resets 💎, cards and Get Cards but **keeps your upgrades**, so spend your 💎 in the shop before starting over.
- **🏆 Leaderboard** (button next to Get Cards): top 10 scores, with your latest score highlighted and its rank shown even if it's outside the top 10.
- The tray shows every card you hold. The card being played right now is first, with a gold glow and a **NOW** tag.
- Opening a tile feels juicy: the foil cover spins off in shards, the symbol bounces in, sparkles and a ring burst out with a scratch sound and a chime. The burst grows as a symbol gets closer to a match, and the 2nd copy of a symbol (a pair) pops a pink **So close!** cheer with a double haptic tap. With reduce motion on, the tile just glows softly and the cheer fades in place.
- On a win, 💎 burst out of the winning tiles and fly into the counter — more gems for higher rarities (`gems` in `CONFIG.rarities`). If the device has reduce motion turned on (e.g. Windows "Animation effects" off), the counter glows and counts up instead.

## Upgrades

Tap **⬆ Upgrades** (top right) to spend 💎. Each level costs more than the last.

| Upgrade | 💎 cost per level | Total to max |
|---|---|---|
| 🍀 Lucky Draw | 10 · 16 · 26 · 41 · 66 · 105 · 168 · 268 · 429 · 687 | 1816 (was 3632) |
| 🎯 Top Prize Chance | 13 · 21 · 36 · 61 · 104 | 235 (was 472) |
| 💎 Bigger Prizes | 20 · 36 · 65 · 117 · 210 | 448 (was 895) |

| Upgrade          | Effect per level                                   | Max | At max level                   |
|------------------|----------------------------------------------------|-----|--------------------------------|
| 🍀 Lucky Draw    | Shifts card rarity odds away from Rare             | 10  | Rare 25 / Epic 31 / Legendary 25 / Immortal 19% |
| 🎯 Top Prize Chance | Raises 1st and 2nd prize odds, lowers 3rd        | 5   | 🍰 25 / 🍩 45 / 🍬 30%          |
| 💎 Bigger Prizes | +1 to every prize's base reward (before rarity ×)  | 5   | 🍰 8 / 🍩 7 / 🍬 6              |

Lucky Draw only affects newly drawn cards, not cards already in the tray. Upgrades carry over to a **New game**; **reset progress** resets them too (the leaderboard is kept).

## Online leaderboard (Supabase)

The game is connected to the project `bftlvlwqueaqjjcgbfbb` and ranks **all players** together (the board says "All players"). If `CONFIG.leaderboard` url/key are empty, scores are stored on the device instead ("Scores on this device"). To set up a new project:

1. Create a free project at [supabase.com](https://supabase.com).
2. In the project, open **SQL Editor** and run:

   ```sql
   create table scores (
     id bigint generated always as identity primary key,
     name text not null check (char_length(name) between 1 and 16),
     score int not null check (score between 0 and 100000),
     created_at timestamptz not null default now()
   );
   alter table scores enable row level security;
   create policy "anyone can read scores" on scores for select using (true);
   create policy "anyone can add scores" on scores for insert with check (true);
   -- the game only reads and adds scores: drop Supabase's default extra privileges
   revoke all on scores from anon, authenticated;
   grant select, insert on scores to anon, authenticated;
   ```

3. In **Project Settings → API Keys**, copy the **Publishable key** (`sb_publishable_…`, or the legacy **anon** key) and put it with the project URL into `CONFIG.leaderboard` in `index.html`. Never use the **secret** / **service_role** key: it gives full control of the database.

   ```js
   leaderboard: { url: 'https://xxxx.supabase.co', key: 'sb_publishable_...', size: 10 },
   ```

The publishable key is meant to be public, but since the game runs in the browser, someone determined could post a fake score; fine for a prototype, and you can delete rows in Supabase's **Table Editor**.

## Art

All graphics are original SVG files in `assets/`, drawn for LuckyCard:

| File | Used for |
|---|---|
| `cake.svg`, `donut.svg`, `candy.svg` | Prize symbols (tiles, prize boxes, popup, stats) |
| `gem.svg` | 💎 everywhere (counter, rewards, flying gems, shop, leaderboard) |
| `cover.svg` | Scratch-off tile cover |
| `card-rare.svg`, `card-epic.svg`, `card-legendary.svg`, `card-immortal.svg` | Card backs in the tray |

**To use your own art:** put your file in `assets/` and change its path in `CONFIG` (`prizes[].img`, `art.gem`, `art.cover`, `rarities[].card`). PNG, WebP or SVG all work; square images with a transparent background look best (about 256×256 for symbols and the cover, 84×116 for card backs). Set a path to `''` to go back to the emoji / built-in drawing.

## Tuning

All balance values live in the `CONFIG` object at the top of the `<script>` in `index.html`: art file paths, grid size, starting cards, refill size, prize odds and rewards, rarity drop rates and multipliers, upgrade costs and effects (`CONFIG.upgrades`), how many times Get Cards can be used (`maxRefills`), the leaderboard (`leaderboard`), and how often near-misses appear.

## Versioning

The version shown at the bottom-left of the page is set by hand in `index.html` (`<div class="version">`). Bump it on every push so you can tell which build you're testing.

## Development

- **Codespaces:** on GitHub, **Code → Codespaces → Create codespace on main**. The `.devcontainer` sets up Node, the Live Preview extension (open `index.html` → "Show Preview"), Claude Code, and Playwright with Chromium. Forwarded port 3000 lets you open the game on a phone.
- **Tests:** `npm test` plays the game in a headless browser at phone size, checks the main flows (art loads, tile-open burst, pair cheer, Get Cards limit, game over, leaderboard online and on-device against a fake Supabase (tests never send scores to the real leaderboard), refresh resume, gem burst, popup, empty state, shop, reduced motion) and saves screenshots to `tests/screenshots/`. Locally, run `npm install && npx playwright install chromium` once first. To use a Chromium that's already installed, set `CHROMIUM_PATH` to its executable.
- **Before every push:** bump the version label, update this README, run `npm test` (see `CLAUDE.md`).
