# AnimePahe TV — controller + 10-foot layout userscript

## Goal

Turn the AnimePahe website into something that feels like a proper streaming app on my Android TV projector (XGIMI), controlled entirely with a PS4 (DualShock 4) controller. This is a personal project for my own device.

Target setup:
- Firefox for Android, sideloaded on the projector
- Violentmonkey (userscript manager) and uBlock Origin installed in that Firefox
- DualShock 4 paired to the projector over Bluetooth
- Development and first testing on my desktop Firefox with the same extensions

Output: **one userscript** (`animepahe-tv.user.js`) that contains layout CSS, controller handling, player control and watch history. No separate Stylus theme.

## Ground rules

- The site has an anti-bot check. **Do not automate the live site or try to get around that check.** Build and test against HTML snapshots I save into `/snapshots`. If you need a page or state I haven't saved, ask me for it.
- Never guess selectors. Derive them from the snapshots and keep them all in one `SELECTORS` config block at the top of the script, so a site change is a one-place fix.
- The site's domain changes from time to time (currently `animepahe.pw`). Keep the list of site domains and the player iframe domain(s) in config and in the `@match` lines, easy to edit.
- Ask before any `adb` action that installs, uninstalls or changes settings on the projector.
- Keep `/snapshots` out of git (`.gitignore`).
- Work in the phases below. After each phase: stop, summarise what changed, tell me exactly what to test on the TV, and wait for my feedback.

## Phase 0 — Check the controller works in Firefox on the TV (do this first)

Build a tiny standalone HTML gamepad tester that shows every button index, every axis value, the gamepad `id` and its `mapping` field, live. Serve it from my desktop over the local network so I can open it in Firefox on the projector.

Record the actual DS4 button/axis indices as seen on the TV in `docs/controller-map.md`. Android may not report the "standard" layout, so the script's button map must be based on what this test shows.

**If Firefox on the TV does not see the controller through the Gamepad API, stop and report.** The plan changes in that case.

## Phase 1 — Skeleton and deployment

- Git repo; the userscript must be installable in Violentmonkey from a raw URL, with `@updateURL` / `@downloadURL` set and the `@version` bumped on every change, so the TV picks up updates.
- Help me (with confirmation) get Firefox, Violentmonkey and uBlock Origin onto the projector if not already there.
- Script structure: independent modules — core (page detection, config, storage, logging), layout, input, navigation, player bridge, history. **Each module is wrapped so that if it fails, the others and the site itself still work.**
- Options button (and a keyboard key) toggles the whole enhancement on/off; the state persists.
- A debug overlay (toggle with a button combo and a keyboard key) showing raw controller input, detected page type and the currently focused element.
- Every controller action also has a keyboard shortcut for desktop testing. All mappings live in one config object.

## The four pages

1. **Home / Latest Releases** — grid of 12 posters, 3 per row, title + episode number on each; pagination bar at the bottom (« ‹ page › »). Posters go straight to the player.
2. **Index** (the "anime" nav link) — letter bar (# A–Z) and a long two-column list of titles with BD/DVD badges. Each season/movie is a separately and fully named entry.
3. **Show page** (`/anime/{id}`, episode pages via `?page=N`) — banner, poster, title, tabs **Summary / Relations / Recommendations**, long synopsis, info sidebar, then "Episodes (N)" with asc/desc buttons, occasional notice banners (e.g. "Remastered Edition by…"), episode cards (thumbnail, duration, episode number, BD/DVD badge), **30 episodes per page** with the same pagination bar as Home.
4. **Player page** — the video is in a cross-origin iframe (Kwik). Below it: dropdowns (server, **Episode**, quality, Download) — only the Episode dropdown matters. Below that, the show title with episode number ("Show Name - 56"), which links to the show page. Prev/next episode arrows appear at the left/right edges of the player on mouse hover.

## Layout (10-foot UI)

General:
- Safe margins around the screen edge (around 5%) since projectors can crop.
- Larger text everywhere; keep the site's dark look and pink accent.
- Very visible focus state: slight scale-up plus a pink outline matching the logo colour.
- No heavy effects (no backdrop blur, no big shadows or animations) — TV hardware is slow; smooth cursor movement matters more.

Per page:
- **Home:** clean poster grid with the focus state; search hidden until called up.
- **Index:** **the letter bar is frozen (sticky) at the top** while the list scrolls; bigger list text.
- **Show page:** synopsis clamped to about 3 lines with an expand control; the episode section moved up so the first row of episodes is visible as soon as the page opens.
- **Player:** custom fullscreen (see Player section). Side arrows hidden visually but still in the DOM and clickable by the script.

## Controller map

| Input | Browsing pages | Player page |
|---|---|---|
| Right stick | Cursor that snaps magnetically to clickable elements, with acceleration | Show/move cursor |
| Left stick rotation | Scroll wheel (clockwise = down) | — |
| D-pad | Move focus one item at a time (spatial navigation) | ←/→ seek (10 s default), ↑/↓ volume |
| Cross (X) | Click / select | Play/pause |
| Circle | Back; closes any open overlay or dropdown first | Back |
| L1 / R1 | Previous/next page (Home pagination, show-page episode pages). **Index only:** move the highlight along the letter bar, Cross loads the letter | Previous/next episode |
| L2 / R2 | Show page: cycle Summary / Relations / Recommendations | — |
| Share | Section picker: highlights Home / Anime index / History; move with L1/R1 or D-pad, Cross goes | Same |
| Triangle | Focus search (opens the Android keyboard) | Toggle fullscreen |
| Square | Show page: toggle asc/desc | Open the Episode dropdown (D-pad to move, Cross to pick) |
| L3 (left stick click) | — | Go to the show page (the title link) |
| R3 (right stick click) | — | Skip forward 85 s (intro skip) |
| Options | Toggle the enhancement on/off | Same |

Details:
- **Snapping:** the cursor is drawn by the script (a page cannot move the system cursor). It pulls toward the nearest clickable element in the direction of movement; Cross clicks the element under it.
- **Scroll wheel:** compute the stick angle each frame and scroll by the change in angle. Only count rotation when the stick is pushed most of the way out (around 70%) to avoid jitter on release.
- The browser only exposes the controller after a first button press; handle that gracefully (a small "press any button" hint is fine).

## Player

- **Bridge:** the same userscript runs on both the site and the player iframe domain. The top page sends commands (play/pause, seek, volume, skip, fullscreen state) via `postMessage` with strict origin checks; the iframe script carries them out on the `<video>` element and reports position/duration back every few seconds. Identify the player library from the snapshot.
- **Fullscreen:** do not use the player's own fullscreen button — it fullscreens only the iframe, which hides the page's prev/next arrows. Instead fullscreen the whole top page and stretch the iframe to fill it with CSS, hiding everything else. L1/R1 must keep working in fullscreen.
- **After moving to another episode** (which loads a new page), automatically restore the stretched layout and start playback. Test whether a controller press counts as a user action for re-entering true browser fullscreen; if not, fall back to the stretched layout and tell me. (I will allow autoplay with sound for the site in Firefox settings.)

## Watch history

The site's URLs rotate (roughly daily), so history must be based on **what** was watched, not **where**.

Storage: Violentmonkey's `GM_setValue` / `GM_getValue` (shared between the top page and the player iframe because it is the same script).

For each show, store:
- Full show title exactly as displayed
- Episode number **as displayed, as a string** (can be decimal, e.g. "12.5")
- Extra identifiers shown on the page (type, season/year) to tell similar titles apart
- Poster/thumbnail URL if available (may expire; fall back to a placeholder)
- Last known show URL and player URL (best effort only)
- Playback position, duration, last-updated time, watched flag (over ~90% watched)

Title parsing: the player shows "Show Name - 56". Titles themselves can contain " - " (e.g. "Season 2: Digression - Hinata Sakaguchi"), so split on the **last** " - " followed by a number.

Episode numbering: numbers are not per-season. A Season 2 can start at episode 13, and some shows run to 50+ episodes in one entry. **Never calculate an episode's page from its number.** Find episodes by the number shown on the card.

Features:
- **History page:** drawn by the script as an overlay on the home page, reachable at `#history` and from the Share section picker. Entries sorted by most recent, with poster, title, episode and progress bar.
- **Resuming:** Cross on a history entry opens the site's search with the full title prefilled. **Do not navigate automatically** — I pick the right result myself.
- **Show page:** if the show is in history, highlight the last-watched episode card and mark watched episodes (checkmark or partial progress bar). If the last-watched episode isn't on the current page, show a small hint like "Episode 32 is on page 2 — press R1".
- **"Next up"** means the next card in list order, not episode number + 1.
- Optional "Continue watching" row at the top of Home, using the same data.
- Export/import history as a JSON file; cap storage to a sensible size.

## Order of work

0. Gamepad check on the TV → stop and report.
1. Skeleton, deployment pipeline, on/off toggle, debug overlay.
2. Input and navigation on all pages: cursor + snapping, D-pad spatial navigation, scroll wheel, L1/R1, L2/R2, Share section picker.
3. Layout for each page.
4. Player bridge, custom fullscreen, episode navigation in fullscreen.
5. Watch history and the history page.

After each phase, stop, summarise, list what I should test on the TV, and wait.
