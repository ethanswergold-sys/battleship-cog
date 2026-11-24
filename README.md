# battleship-cog

Classic Battleship in the browser: you against the computer opponent, MacArthur.
Plain HTML, CSS and JavaScript with no frameworks, no build step and no backend,
so it runs on GitHub Pages straight from the repo root, or by double-clicking
`index.html` on your own computer.

## Project layout

| File | What it does |
|---|---|
| `js/rules.js` | The game rules: placing ships, firing shots, hits, misses, sinking, turns, winning. No screen code. |
| `js/computer.js` | MacArthur, the computer opponent (hunt-and-target strategy). No screen code. |
| `tests/rules.test.js` | Automated checks for the rules. |
| `tests/computer.test.js` | Automated checks for MacArthur, including 2,000 simulated games. |
| `tests/run.html` | Open in any browser to run the automated checks. |
| `tests/harness.js` | The small test runner used by `tests/run.html`. |

## Running the tests

- **In a browser:** double-click `tests/run.html`. Every check shows PASS or FAIL.
- **From a terminal (Node 18 or newer):** `node --test tests/*.test.js`
- **On GitHub:** the tests run automatically on every pull request.
