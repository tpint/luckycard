# LuckyCard

A scratch-card game prototype in a single HTML file. Each card is a 4×4 grid of tiles; tap tiles to open them and find **3 matching patterns** to win that prize. Every card wins (100% win rate) — the prize tier and card rarity decide how much.

## Play

Open `index.html` in a browser. No build step or dependencies.

Progress (💎 total, remaining cards, the card in play with its opened tiles, upgrades, stats) is saved in the browser's `localStorage`. Use **reset progress** at the bottom of the page to start over.

## How it works

- **Prizes:** 1st 🍰 (3 💎), 2nd 🍩 (2 💎), 3rd 🍬 (1 💎). Odds per card: 10% / 30% / 60%.
- **Card rarity** multiplies the reward:

  | Rarity    | Drop rate | Multiplier |
  |-----------|-----------|------------|
  | Rare      | 40%       | ×1         |
  | Epic      | 30%       | ×2         |
  | Legendary | 20%       | ×5         |
  | Immortal  | 10%       | ×20        |

- You start with 3 cards; **Get Cards** adds 3 more (free in the prototype).
- The tray shows every card you hold. The card being played right now is first, with a gold glow and a **NOW** tag.
- Opening a tile feels juicy: the foil cover spins off in shards, the symbol bounces in, sparkles and a ring burst out with a scratch sound and a chime. The burst grows as a symbol gets closer to a match, and the 2nd copy of a symbol (a pair) pops a pink **So close!** cheer with a double haptic tap. With reduce motion on, the tile just glows softly and the cheer fades in place.
- On a win, 💎 burst out of the winning tiles and fly into the counter — more gems for higher rarities (`gems` in `CONFIG.rarities`). If the device has reduce motion turned on (e.g. Windows "Animation effects" off), the counter glows and counts up instead.

## Upgrades

Tap **⬆ Upgrades** (top right) to spend 💎. Each level costs more than the last.

| Upgrade          | Effect per level                                   | Max | At max level                   |
|------------------|----------------------------------------------------|-----|--------------------------------|
| 🍀 Lucky Draw    | Shifts card rarity odds away from Rare             | 10  | Rare 25 / Epic 31 / Legendary 25 / Immortal 19% |
| 🎯 Top Prize Chance | Raises 1st and 2nd prize odds, lowers 3rd        | 5   | 🍰 25 / 🍩 45 / 🍬 30%          |
| 💎 Bigger Prizes | +1 to every prize's base reward (before rarity ×)  | 5   | 🍰 8 / 🍩 7 / 🍬 6              |

Lucky Draw only affects newly drawn cards, not cards already in the tray. **reset progress** also resets upgrades.

## Tuning

All balance values live in the `CONFIG` object at the top of the `<script>` in `index.html`: grid size, starting cards, refill size, prize odds and rewards, rarity drop rates and multipliers, upgrade costs and effects (`CONFIG.upgrades`), and how often near-misses appear.

## Versioning

The version shown at the bottom-left of the page is set by hand in `index.html` (`<div class="version">`). Bump it on every push so you can tell which build you're testing.

## Development

- **Codespaces:** on GitHub, **Code → Codespaces → Create codespace on main**. The `.devcontainer` sets up Node, the Live Preview extension (open `index.html` → "Show Preview"), Claude Code, and Playwright with Chromium. Forwarded port 3000 lets you open the game on a phone.
- **Tests:** `npm test` plays the game in a headless browser at phone size, checks the main flows (tile-open burst, pair cheer, refresh resume, gem burst, popup, empty state, shop, reduced motion) and saves screenshots to `tests/screenshots/`. Locally, run `npm install && npx playwright install chromium` once first. To use a Chromium that's already installed, set `CHROMIUM_PATH` to its executable.
- **Before every push:** bump the version label, update this README, run `npm test` (see `CLAUDE.md`).
