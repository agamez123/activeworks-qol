# Activeworks QOL

A browser extension that adds quality-of-life improvements to
[ACTIVE Network's Swimming portal](https://sports.active.com/) (Activeworks),
for club staff managing swimmers.

## Features

- **Dark mode** — a site-wide dark theme, toggleable from the extension
  popup.
- **Training group column** — adds a color-coded "Group" column to the
  People grid, and a filter bar that lets you view every swimmer in a given
  training group at once (the native grid only pages 20 rows at a time and
  has no group filter of its own).

## Development

```bash
npm install
npm run dev
```

Then load the unpacked extension from `build/chrome-mv3-dev` in your
browser's extensions page (with developer mode enabled).

## Production build

```bash
npm run build
```

Produces a production bundle in `build/chrome-mv3-prod`, ready to zip and
submit to the Chrome Web Store.

Built with [Plasmo](https://docs.plasmo.com/).
