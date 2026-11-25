# battleship-cog

Classic Battleship in the browser: you against the computer opponent, MacArthur.
Plain HTML, CSS and JavaScript with no frameworks, no build step and no backend,
so it runs on GitHub Pages straight from the repo root, or by double-clicking
`index.html` on your own computer.

## How to play

1. **Place your fleet:** pick a ship and click (or tap) a square on *Your fleet*. Turn ships with the
   Rotate button, the Shift key or R, or press Randomize. Click a placed ship to move it.
2. **Start game:** a coin flip decides who shoots first.
3. **Call your shot:** type a square like `D4` and press Enter, or click a square on *MacArthur's waters*.
   One shot per turn. White peg = miss, red peg = hit.
4. Sink all five of MacArthur's ships before he sinks yours. If you lose, you can reveal where his
   remaining ships were. Play again keeps your win/loss tally until you close the window.
5. **Opponent rank:** pick how well MacArthur plays from the *Opponent rank* menu at the top:
   *Rookie* fires at random, *Officer* hunts and then targets, *General* works out where ships are most
   likely to be. You can change it at any time; mid-game,
   the new rank takes over from MacArthur's next shot and never fires at a square already tried.

Everything works with a mouse, a touchscreen or the keyboard alone (Tab, arrow keys and Enter), and
screen readers announce every shot.

## Hosting

GitHub Pages: Settings → Pages → deploy from the `main` branch, root folder. No build step.

## Project layout

| File | What it does |
|---|---|
| `index.html` | The page: both boards, controls and messages. |
| `css/styles.css` | Look and layout for phones and laptops. |
| `js/ui.js` | Draws the screen and handles clicks, taps and keys. Makes no rule decisions. |
| `js/main.js` | Starts the game and connects the rules and MacArthur to the screen. |
| `js/rules.js` | The game rules: placing ships, firing shots, hits, misses, sinking, turns, winning. No screen code. |
| `js/opponents.js` | The list of ranks MacArthur can play at, and the one place that creates "the current opponent". |
| `js/ranks/rookie.js` | Rookie rank: fires at random untried squares and ignores hits. No screen code. |
| `js/ranks/officer.js` | Officer rank: hunt-and-target strategy. No screen code. |
| `js/ranks/general.js` | General rank: probability map of where the remaining ships could be. No screen code. |
| `tests/rules.test.js` | Automated checks for the rules. |
| `tests/opponents.test.js` | Automated checks for the ranks, including thousands of simulated games. |
| `tests/simulate.js` | Plays 1,000 games per rank and prints a table of average, fewest and most shots: `node tests/simulate.js`. |
| `tests/run.html` | Open in any browser to run the automated checks. |
| `tests/harness.js` | The small test runner used by `tests/run.html`. |

## Running the tests

- **In a browser:** double-click `tests/run.html`. Every check shows PASS or FAIL.
- **From a terminal (Node 18 or newer):** `node --test tests/*.test.js`
- **On GitHub:** the tests run automatically on every pull request.
