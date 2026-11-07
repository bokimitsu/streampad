# DualShock 4 on the projector — Gamepad API map

Measured 2026-11-07 with `tools/gamepad-tester/` (raw reports in `tools/gamepad-tester/reports/`, not in git).

| | |
|---|---|
| Device | XGIMI XK03H, Android TV 11 (32-bit, armeabi-v7a) |
| Browser | Firefox for Android 159.0.1 (`Mozilla/5.0 (Android 11; Mobile; rv:159.0) Gecko/159.0 Firefox/159.0`) |
| Controller | DualShock 4 v2 (USB/BT `054c:09cc`), Bluetooth |
| `gamepad.mapping` | `"standard"` |
| `gamepad.id` | `"Wireless Controller"` on one connection, `"Wireless Controller Touchpad"` on another — **do not match on `id`** |
| Size | 17 buttons, 4 axes |

**Result: the Gamepad API works and Android reports the W3C standard layout.** The script can use standard indices.

## Buttons

| Index | DS4 control | Notes |
|---|---|---|
| 0 | Cross (X) | |
| 1 | Circle | Does **not** trigger Android/Firefox Back (no key event, no history navigation) |
| 2 | Square | |
| 3 | Triangle | |
| 4 | L1 | |
| 5 | R1 | |
| 6 | L2 | **Analog**: `buttons[6].value` 0–1 (42 distinct values seen) |
| 7 | R2 | **Analog**: `buttons[7].value` 0–1 (36 distinct values seen) |
| 8 | Share | |
| 9 | Options | |
| 10 | L3 (left stick click) | |
| 11 | R3 (right stick click) | |
| 12 | D-pad Up | Reported as a button, not an axis/hat |
| 13 | D-pad Down | |
| 14 | D-pad Left | |
| 15 | D-pad Right | |
| 16 | PS | Not tested on purpose: on Android TV it opens the system home screen and sends Firefox to the background. Don't map it. |

No controller button produced a `keydown`/`keyup` event in the page, so gamepad input and keyboard shortcuts can't collide.

## Axes

| Index | Control | Range | Direction |
|---|---|---|---|
| 0 | Left stick X | −1 … 1 | right = + |
| 1 | Left stick Y | −1 … 1 | down = + |
| 2 | Right stick X | −1 … 1 | right = + |
| 3 | Right stick Y | −1 … 1 | down = + |

- All four rest at 0. Idle noise up to ±0.03 → use a **radial dead zone of ~0.15**.
- Each stick moved only its own pair of axes; the triggers moved no axes (checked one control at a time).
- Diagonals overshoot the unit circle (radius up to 1.11 measured) → **clamp the stick vector length to 1** before using it for speed or angle.

## Timing

- New input values reach the page about **16 times per second** while a stick is moving; the page itself draws at ~45–53 fps on this hardware.
- So the cursor and scroll wheel must **integrate the latest stick value every animation frame** (velocity × frame time) rather than move once per input update, otherwise motion steps visibly at 16 Hz.
- With the controller idle, `gamepad.timestamp` doesn't change; don't use it as a liveness signal on its own.

## Gotchas found during testing

1. **First press required.** `navigator.getGamepads()` is empty until a button is pressed after the page loads. Show a "press any button" hint.
2. **Secure context required.** The Gamepad API is only available on HTTPS or `localhost`. The live site is HTTPS, so this only matters for dev pages served from the PC (use `adb reverse tcp:8765 tcp:8765` and open `http://localhost:8765/`).
3. **Reconnect needs a Firefox restart.** When the DS4 disconnected (flat battery) and reconnected, Android picked it up again (new input device id) but Firefox never exposed it to pages again — not after button presses, not after reloading. Only force-stopping and reopening Firefox fixed it. The script should detect "no gamepad for a while after it had one" and tell the user to restart Firefox.
4. **Touchpad is a separate system pointer.** Android exposes "Wireless Controller Touchpad" as its own pointer device, so touching it moves the Android mouse cursor and taps can click, independently of the script.
5. **One test glitch, explained.** The first guided run recorded "left stick right → axis 2" and a weak right-stick reading; the isolated re-test showed clean, full-range axes, so that was the other stick being touched during the step, not a mapping problem.
