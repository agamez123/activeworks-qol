# ASM Toolkit

A Manifest V3 Chrome extension for [Active Swim Manager](https://sports.active.com/),
the roster and meet tool my swim club runs on. I coach 34 swimmers there, and
the site kept getting in my way. The People grid shows 20 rows a page and can't
filter by training group. Top times and meet entries don't export in any format
a coach can use. So I built the missing features myself.

Built with TypeScript, React, Plasmo, Papa Parse, and the Chrome Extension APIs.

## What it does

**Training group column.** Adds a color-coded Group column to the People grid,
plus a filter bar that lists every swimmer in a group on one page. Clicking a
name opens that swimmer's profile.

**Group sync and editing.** One button in the popup pulls the roster and
training groups from every meet the club has attended this year. The popup also
lets you create, rename, and delete groups or move a swimmer to another one.
Your manual changes survive the next sync.

**Top times export.** Automates what used to be a copy-and-paste job. The
extension requests the Top Times By Name report as CSV from the site's report
server, tags each swim with the swimmer's training group, and downloads only
the groups you pick.

**Meet entry export.** On a meet's Entry By Name page, one click turns the
entry list into a CSV. You choose the columns and their order, and the
extension remembers the choice.

**Themes.** Dark mode and 11 other color themes, applied across the whole site
and synced to your Chrome profile.

## How it works

The site has no public API, so the extension works with what the page already
does.

- **Borrowing the page's credentials.** The site's JSON services reject any
  request without a CSRF token. `contents/pageContext.ts` runs in the page's
  MAIN world at `document_start` and wraps `fetch` and `XMLHttpRequest` to read
  the token and agency ID off the site's own requests. It writes both to a data
  attribute on `<html>`, since the DOM is the only thing the page and isolated
  content scripts share. No club ID is hardcoded.
- **Full rosters from partial data.** A swimmer only appears in the attendance
  list of meets they entered, so a junior swimmer entered only in development
  meets never shows up in the club's latest meet. The sync fetches attendance
  for every meet this year in parallel with `Promise.allSettled`, so one failed
  request doesn't blank the roster, then merges the results by swimmer ID.
- **Parsing a report with no stable headers.** SSRS flattens the report into
  CSV with internal column names like `Textbox72`. `lib/csvFormat.ts` ignores
  the headers and identifies each column by the shape of its values. Times look
  like `1:41.71S` and dates like `2026/7/12`. The most distinctive patterns
  claim their column first, so a lone `F`, which could mean a final or a
  gender, can't land in the wrong one.
- **Keeping up with a single-page app.** The site redraws its grids without a
  page load. Seven content scripts watch the DOM with `MutationObserver` and
  re-inject their UI after each redraw. They also listen to
  `chrome.storage.onChanged`, so an edit in the popup shows up on open tabs
  right away.

## Project layout

```
contents/     7 content scripts injected into sports.active.com
components/   popup UI: theme picker and training group editor
lib/          sync, CSV parsing, and storage shared by the scripts and popup
popup.tsx     extension popup
```

## Run it locally

```bash
npm install
npm run dev
```

Open `chrome://extensions`, turn on developer mode, and load the unpacked
extension from `build/chrome-mv3-dev`. You need an Active Swim Manager staff
login to see the features.

## Build for release

```bash
npm run build
npm run package
```

`build` writes the production bundle to `build/chrome-mv3-prod`, and `package`
zips it for the Chrome Web Store.
