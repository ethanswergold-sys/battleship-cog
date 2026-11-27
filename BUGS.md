# Bugs and fixes

Every problem found and fixed while building the game, oldest first. Each entry says how it was found,
how to reproduce it, what went wrong and how it was fixed. "Automated reviewer" means the review bot that
checks every pull request.

| # | Problem | Severity | Fixed in |
|---|---|---|---|
| 1 | The game wouldn't open by double-clicking `index.html` | Medium | [#1](https://github.com/ethanswergold-sys/battleship-cog/pull/1) (design) |
| 2 | Four keyboard and screen-reader problems | Medium | [#3](https://github.com/ethanswergold-sys/battleship-cog/pull/3) |
| 3 | Officer missed a certain hit after a rank switch | Low | [#4](https://github.com/ethanswergold-sys/battleship-cog/pull/4) |
| 4 | A typed shot carried into the next battle | Low | [#6](https://github.com/ethanswergold-sys/battleship-cog/pull/6) |
| 5 | Pasted names could get cut short | Low | [#7](https://github.com/ethanswergold-sys/battleship-cog/pull/7) |
| 6 | Plain rank descriptions (style) | — | [#9](https://github.com/ethanswergold-sys/battleship-cog/pull/9) |
| 7 | The game looked plain (style) | — | [#10](https://github.com/ethanswergold-sys/battleship-cog/pull/10) |
| 8 | Gaps in revealed ships | Low | [#10](https://github.com/ethanswergold-sys/battleship-cog/pull/10) |
| 9 | No tab icon, and a hidden error on every page load | Low | [#11](https://github.com/ethanswergold-sys/battleship-cog/pull/11) |
| 10 | You couldn't see both boards on a phone | Medium | [#12](https://github.com/ethanswergold-sys/battleship-cog/pull/12) |

---

### 1. The game wouldn't open by double-clicking `index.html`
- **Severity:** Medium. Offline play from a folder wouldn't have worked; the website was unaffected.
- **Found by:** the project owner, reading the plan before any code was written.
- **Steps to reproduce:** under the first plan, double-click `index.html` on your computer.
- **Expected:** the game opens and plays.
- **Actual:** the browser would have refused to load the game's files without a web server.
- **Root cause:** the plan loaded the files the "modern" way (JavaScript modules), which browsers block for files opened from disk.
- **Fix:** the files load the "classic" way (plain script tags in a fixed order), which works from a folder and from the website.
- **Verified:** the game and `tests/run.html` open by double-click in Chrome.

### 2. Four keyboard and screen-reader problems
- **Severity:** Medium for keyboard and screen-reader players; mouse players were unaffected.
- **Found by:** automated reviewer.
- **Steps to reproduce:** place ships with the keyboard only and press Shift+Tab; pick a ship; type a shot; finish a game with a screen reader on.
- **Expected:** Shift+Tab moves backward; focus stays on the picked ship; the cursor returns to the shot box after MacArthur fires; the final shot is read aloud.
- **Actual:** Shift+Tab also rotated the ship; focus was lost after picking a ship; you had to click back into the shot box; the final shot wasn't read.
- **Root cause:** Shift counted as "rotate" even when combined with Tab; the page didn't say where focus should go after each action; the final shot wasn't on the end screen.
- **Fix:** Shift rotates only when pressed on its own; focus stays on the ship; the cursor goes back to the shot box; the end screen shows "Final shot: …".
- **Verified:** retested with the keyboard only in Chrome. No new automated test.

### 3. Officer missed a certain hit after a rank switch
- **Severity:** Low. MacArthur played slightly worse; the rules weren't broken.
- **Found by:** automated reviewer.
- **Steps to reproduce:** on Rookie, let MacArthur hit both ends of a ship but not the middle, then switch to Officer.
- **Expected:** the Officer fires at the gap between the two hits.
- **Actual:** the Officer could fire past the ends instead.
- **Root cause:** when taking over, the Officer only looked outward from the hits, not between them.
- **Fix:** the Officer checks the gaps between hits first.
- **Verified:** a new automated test, plus a rerun of the browser rank-switch test.

### 4. A typed shot carried into the next battle
- **Severity:** Low. Only one of your own typed squares carried over.
- **Found by:** automated reviewer.
- **Steps to reproduce:** type a square in the shot box without firing, press New game, start the battle and press Fire.
- **Expected:** the shot box is empty in the new battle.
- **Actual:** the old square was still there and could be fired.
- **Root cause:** New game reset the boards but not the shot box.
- **Fix:** New game clears the shot box.
- **Verified:** the steps above in Chrome; automated tests pass. No new automated test.

### 5. Pasted names could get cut short
- **Severity:** Low. Display only.
- **Found by:** automated reviewer.
- **Steps to reproduce:** paste a name that starts with several spaces and is close to 20 characters long.
- **Expected:** the spaces are dropped and the whole name is kept.
- **Actual:** the end of the name could be cut off.
- **Root cause:** the name box cut the text at 20 characters before the leading spaces were removed.
- **Fix:** spaces are removed first, then the 20-character limit is applied.
- **Verified:** checked in Chrome. No new automated test.

### 6. Plain rank descriptions (style request)
- **Found by:** the project owner.
- **Before:** "Easy / Medium / Hard" descriptions in the rank picker.
- **After:** "Find your Sea Legs.", "Get past the waves." and "Command the open ocean."
- **Verified:** the picker still fits an upright phone screen; checked on the live site.

### 7. The game looked plain (style request)
- **Found by:** the project owner, comparing it with reference screenshots.
- **Before:** a basic web-page look.
- **After:** a naval look: navy ocean background, stencil BATTLESHIP title with an anchor emblem, sea-green boards with drawn ships, glowing red hit pegs and white splash misses, steel panels and brass buttons. All drawn in code; no outside images.
- **Verified:** full games at laptop and phone size; automated tests pass; checked on the live site.

### 8. Gaps in revealed ships
- **Severity:** Low. Visual only, after the game had ended.
- **Found by:** automated reviewer.
- **Steps to reproduce:** lose a game after partly hitting one of MacArthur's ships, then reveal his ships.
- **Expected:** each revealed ship is drawn as one whole hull.
- **Actual:** squares you had hit showed as gaps in the hull.
- **Root cause:** the drawing code skipped the hull on squares that already had a hit peg.
- **Fix:** hit squares get the hull too, under the peg.
- **Verified:** checked the reveal in Chrome. No new automated test.

### 9. No tab icon, and a hidden error on every page load
- **Severity:** Low. Players never saw the error.
- **Found by:** QA testing in Chrome.
- **Steps to reproduce:** open the live game, press F12, open the Console tab and refresh.
- **Expected:** no errors, and a game icon on the tab.
- **Actual:** a red "404 favicon.ico" error and a plain default tab icon.
- **Root cause:** the page never named a tab icon, so the browser looked for one that didn't exist.
- **Fix:** an anchor icon drawn in code (`favicon.svg`).
- **Verified:** the icon loads and the live-site console shows no errors.

### 10. You couldn't see both boards on a phone
- **Severity:** Medium. Phone players had to scroll back and forth every turn.
- **Found by:** the project owner, playing on a phone.
- **Steps to reproduce:** start a battle on a phone held upright.
- **Expected:** MacArthur's board and your fleet are both visible.
- **Actual:** only one board fit on the screen at a time.
- **Root cause:** both boards were full width and stacked under the title and shot panel: about 1,600 pixels of page on an 844-pixel screen.
- **Fix:** on phones, MacArthur's board stays full size for tapping and your fleet becomes a small board beside the shot box.
- **Verified:** measured in Chrome at 7 phone sizes; laptop screenshots identical before and after; checked on the live site. Not tested on a physical phone.

---

## Known minor issues (not planned)

- **Double-clicking a square during placement** places the ship and then picks it straight back up, because the second click lands on the new ship and clicking a placed ship means "move it".
- **Opening `index.html` from your own computer** logs a hidden console message about loading the title lettering early. The lettering still loads and the game looks the same.
