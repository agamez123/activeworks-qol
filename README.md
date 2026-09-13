# ASM Toolkit

A browser extension for club staff who manage swimmers in
[Active Swim Manager](https://sports.active.com/). It adds the small features
the site is missing.

## Features

- **Dark mode.** A site-wide dark theme you can turn on from the extension
  popup.
- **Training group column.** Adds a color-coded "Group" column to the People
  grid, plus a filter bar that shows every swimmer in a training group at
  once. The native grid shows 20 rows per page and can't filter by group.

## Development

```bash
npm install
npm run dev
```

Open your browser's extensions page, turn on developer mode, and load the
unpacked extension from `build/chrome-mv3-dev`.

## Production build

```bash
npm run build
```

This writes a production bundle to `build/chrome-mv3-prod`. Zip it and submit
it to the Chrome Web Store.

Built with [Plasmo](https://docs.plasmo.com/).
