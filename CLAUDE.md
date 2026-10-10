# LuckyCard

Single-file scratch-card game prototype: everything (HTML, CSS, JS) is in `index.html`. No build step.

- Balance values live in the `CONFIG` object at the top of the `<script>`.
- Progress is saved in `localStorage` under the key `luckycard`. When adding fields to the save, keep old saves loading (default missing fields after `store.get()`).
- Respect `prefers-reduced-motion`: give a gentler effect rather than none.

## Testing

`npm test` runs `tests/check.js`: plays the game in headless Chromium at phone size, checks the main flows (refresh resume, gem burst, popup, empty state, shop, reduced motion) and saves screenshots to `tests/screenshots/`. Run it after gameplay/UI changes and look at the screenshots. Extend it when adding features.

## Every push

1. Bump the version label in `index.html` (`<div class="version">vX.Y</div>`) so the user can tell which build they're testing.
2. Update `README.md` to reflect the change.
3. Run `npm test` first.
