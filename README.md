# LuckyCard

A scratch-card game prototype in a single HTML file. Each card is a 4×4 grid of tiles; tap tiles to open them and find **3 matching patterns** to win that prize. Every card wins (100% win rate) — the prize tier and card rarity decide how much.

## Play

Open `index.html` in a browser. No build step or dependencies.

Progress (bag total, remaining cards, stats) is saved in the browser's `localStorage`. Use **reset progress** at the bottom of the page to start over.

## How it works

- **Prizes:** 1st 👑 (3 📜), 2nd 💧 (2 📜), 3rd 🧤 (1 📜). Odds per card: 10% / 30% / 60%.
- **Card rarity** multiplies the reward:

  | Rarity    | Drop rate | Multiplier |
  |-----------|-----------|------------|
  | Rare      | 40%       | ×1         |
  | Epic      | 30%       | ×2         |
  | Legendary | 20%       | ×5         |
  | Immortal  | 10%       | ×20        |

- You start with 5 cards; **Get Cards** adds 5 more (free in the prototype).

## Tuning

All balance values live in the `CONFIG` object at the top of the `<script>` in `index.html`: grid size, starting cards, refill size, prize odds and rewards, rarity drop rates and multipliers, and how often near-misses appear.

## Versioning

The version shown at the bottom-left of the page is set by hand in `index.html` (`<div class="version">`). Bump it on every push so you can tell which build you're testing.
