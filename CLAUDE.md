# LuckyCard

Scratch-card game prototype: all HTML, CSS and JS is in `index.html`; original SVG art is in `assets/`. No build step.

- Art paths live in `CONFIG` (`prizes[].img`, `art`, `rarities[].card`); render icons with `prizeIcon()` / `GEM`, never hard-coded emoji, so swapped art shows everywhere. An empty path falls back to the emoji.

- Balance values live in the `CONFIG` object at the top of the `<script>`.
- A card's whole board is dealt when it starts (`buildBoard`: 3 of the winner, ≤2 of each other prize, `BLANK` = -1 for the rest); the save holds `round.board` + `round.opened`. After a win there is no popup: reveal-all, ribbon, then the next card deals itself. Timers from a finished card check `cardGen` so they can't act on the next card. Tapping a tile runs `scratchOff` (strokes erase the cover canvas) and its sound/burst/match feedback lands when it finishes; a win pays out at once and `win(sym, delay)` celebrates after the scratch.
- Progress is saved in `localStorage` under the key `luckycard`. When adding fields to the save, keep old saves loading (default missing fields after `store.get()`).
- Leaderboard: Supabase REST when `CONFIG.leaderboard` has url/key (set to the live project; the key is the public publishable key), else `localStorage` key `luckycard-scores`. Tests route all `/rest/v1/` calls to an in-memory fake (`fakeSupabase` in `tests/check.js`): never let tests write to the real leaderboard. Player names come from other players: always escape them.
- Respect `prefers-reduced-motion`: give a gentler effect rather than none.

## Testing

`npm test` runs `tests/check.js`: plays the game in headless Chromium at phone size, checks the main flows (art loads, board makeup, scratch-off, tile-open burst, pair cheer, Open all, reveal-all, auto next card, old-save conversion, Get Cards limit, game over, leaderboard on-device and online against a fake Supabase, refresh resume, gem burst, win ribbon, empty state (tap to get cards), shop, reduced motion) and saves screenshots to `tests/screenshots/`. Run it after gameplay/UI changes and look at the screenshots. Extend it when adding features.

## Every push

1. Bump the version label in `index.html` (`<div class="version">vX.Y</div>`) so the user can tell which build they're testing.
2. Update `README.md` to reflect the change.
3. Run `npm test` first.
4. Rename the Claude Code session to match the new version, e.g. "LuckyCard v1.8" (`set_session_title`), if the tool is available.
