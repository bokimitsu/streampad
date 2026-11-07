# streampad

A userscript that makes AnimePahe usable on an Android TV projector with a DualShock 4: controller input, a 10-foot layout, player control and watch history. Personal project, built for Firefox for Android + Violentmonkey.

## Install

1. Install [Violentmonkey](https://addons.mozilla.org/firefox/addon/violentmonkey/) in Firefox.
2. Open the script: <https://raw.githubusercontent.com/bokimitsu/streampad/main/animepahe-tv.user.js> and confirm the install.

Violentmonkey checks that link for updates; every commit that changes the script raises its `@version`.

## Controls

See [CLAUDE.md](CLAUDE.md) for the full controller map and [docs/controller-map.md](docs/controller-map.md) for the measured DS4 indices. Keyboard equivalents live in `CONFIG.keys` at the top of the script.

| Key | Controller |
|---|---|
| Enter | Cross |
| Esc / Backspace | Circle |
| `e` | Square |
| `/`, `f` | Triangle |
| `[` `]` | L1 / R1 |
| `,` `.` | L2 / R2 |
| `m` | Share |
| `o` | Options (TV mode on/off) |
| `g` `s` | L3 / R3 |
| Arrows | D-pad |
| `` ` `` or L3+R3 | Debug overlay |

## Development

- `git config core.hooksPath .githooks` once after cloning — the pre-commit hook bumps `@version`.
- `tools/dev-server.ps1` serves the project on `http://localhost:8766/`; open `/snapshots/<page>.htm` to run the script on a saved page (snapshots are kept locally and not committed). A Content-Security-Policy blocks all external requests so testing never touches the live site.
- `tools/serve.ps1` serves the gamepad testers on port 8765 for the TV (`adb reverse tcp:8765 tcp:8765`, then open `http://localhost:8765/` in Firefox there).
