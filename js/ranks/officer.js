/*
 * OFFICER: how this rank plays (hunt and target).
 *   Hunt:   while no ship is wounded, fire at untried squares in a checkerboard
 *           pattern. Every ship is at least 2 long, so each one covers at least
 *           one checkerboard square and none can hide in the gaps.
 *   Target: after a hit, try the squares directly above, below, left and right.
 *           Once two hits on the same ship line up, keep firing along that line
 *           in both directions until the ship sinks.
 *   After a sink: go back to hunting, unless there are hits on a ship that
 *           hasn't sunk yet (a second ship was clipped). Finish those first.
 * The Officer never fires at the same square twice or off the board, and never
 * sees the player's board: it only learns miss, hit (with ship name) or sunk.
 * No screen code lives here.
 */
(function (root) {
  'use strict';

  var rules = (typeof module === 'object' && module.exports)
    ? require('../rules.js')
    : root.Battleship.rules;
  var SIZE = rules.SIZE;
  var DIRECTIONS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  function createNotes(rng) {
    var known = [];
    for (var r = 0; r < SIZE; r++) known.push(new Array(SIZE).fill(null));
    return {
      rng: rng || Math.random,
      known: known,          // null (untried), 'miss' or 'hit'
      openHits: {},          // ship name -> [{row, col}] hits on ships not yet sunk
      sunk: [],              // names of ships already sunk
      parity: (rng || Math.random)() < 0.5 ? 0 : 1
    };
  }

  function isUntried(ai, row, col) {
    return row >= 0 && row < SIZE && col >= 0 && col < SIZE &&
      ai.known[row][col] === null;
  }

  function shipSize(name) {
    for (var i = 0; i < rules.FLEET.length; i++) {
      if (rules.FLEET[i].name === name) return rules.FLEET[i].size;
    }
    return 2;
  }

  function pickRandom(ai, cells) {
    return cells[Math.floor(ai.rng() * cells.length)];
  }

  // How many squares in a straight line through (row, col) could still hold
  // this ship: untried squares plus squares already hit on this same ship.
  function roomAlong(ai, hits, row, col, dRow, dCol) {
    function usable(r, c) {
      if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return false;
      if (ai.known[r][c] === null) return true;
      return hits.some(function (h) { return h.row === r && h.col === c; });
    }
    var count = 1;
    var r = row + dRow;
    var c = col + dCol;
    while (usable(r, c)) { count++; r += dRow; c += dCol; }
    r = row - dRow;
    c = col - dCol;
    while (usable(r, c)) { count++; r -= dRow; c -= dCol; }
    return count;
  }

  function targetCandidates(ai, name) {
    var hits = ai.openHits[name];
    var size = shipSize(name);
    var candidates = [];

    if (hits.length >= 2) {
      var horizontal = hits[0].row === hits[1].row;
      var line = hits.slice().sort(function (a, b) {
        return horizontal ? a.col - b.col : a.row - b.row;
      });
      var first = line[0];
      var last = line[line.length - 1];
      // Gaps between hits on the same ship are certain hits (possible when
      // taking over from a rank that fired at random).
      var gaps = [];
      for (var i = 1; i < line.length; i++) {
        for (var k = (horizontal ? line[i - 1].col : line[i - 1].row) + 1;
          k < (horizontal ? line[i].col : line[i].row); k++) {
          var gap = horizontal ? { row: first.row, col: k } : { row: k, col: first.col };
          if (isUntried(ai, gap.row, gap.col)) gaps.push(gap);
        }
      }
      if (gaps.length) return gaps;
      var ends = horizontal
        ? [{ row: first.row, col: first.col - 1 }, { row: last.row, col: last.col + 1 }]
        : [{ row: first.row - 1, col: first.col }, { row: last.row + 1, col: last.col }];
      candidates = ends.filter(function (p) { return isUntried(ai, p.row, p.col); });
      if (candidates.length) return candidates;
    }

    hits.forEach(function (hit) {
      DIRECTIONS.forEach(function (d) {
        var row = hit.row + d[0];
        var col = hit.col + d[1];
        if (isUntried(ai, row, col) &&
            roomAlong(ai, hits, hit.row, hit.col, d[0], d[1]) >= size) {
          candidates.push({ row: row, col: col });
        }
      });
    });
    if (candidates.length) return candidates;

    hits.forEach(function (hit) {
      DIRECTIONS.forEach(function (d) {
        if (isUntried(ai, hit.row + d[0], hit.col + d[1])) {
          candidates.push({ row: hit.row + d[0], col: hit.col + d[1] });
        }
      });
    });
    return candidates;
  }

  function huntCandidates(ai) {
    var checkerboard = [];
    var any = [];
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (ai.known[r][c] !== null) continue;
        any.push({ row: r, col: c });
        if ((r + c) % 2 === ai.parity) checkerboard.push({ row: r, col: c });
      }
    }
    return checkerboard.length ? checkerboard : any;
  }

  // Which mode MacArthur is in right now: 'target' while any hit ship is
  // still afloat, otherwise 'hunt'.
  function mode(ai) {
    return Object.keys(ai.openHits).length ? 'target' : 'hunt';
  }

  // Picks MacArthur's next shot as { row, col }.
  function chooseShot(ai) {
    var names = Object.keys(ai.openHits);
    for (var i = 0; i < names.length; i++) {
      var candidates = targetCandidates(ai, names[i]);
      if (candidates.length) return pickRandom(ai, candidates);
    }
    var hunt = huntCandidates(ai);
    return hunt.length ? pickRandom(ai, hunt) : null;
  }

  // Tells MacArthur what happened, using the outcome from rules.fire.
  function recordResult(ai, row, col, outcome) {
    if (outcome.result === 'miss') {
      ai.known[row][col] = 'miss';
    } else if (outcome.result === 'hit' || outcome.result === 'sunk') {
      ai.known[row][col] = 'hit';
      var name = outcome.shipName;
      if (outcome.result === 'sunk') {
        delete ai.openHits[name];
        ai.sunk.push(name);
      } else {
        (ai.openHits[name] = ai.openHits[name] || []).push({ row: row, col: col });
      }
    }
  }

  // The shared opponent interface (see js/opponents.js).
  function create(rng) {
    rng = rng || Math.random;
    var ai = createNotes(rng);
    return {
      rank: 'officer',
      placeShips: function (board) { rules.placeFleetRandomly(board, rng); },
      chooseShot: function () { return chooseShot(ai); },
      recordResult: function (row, col, outcome) { recordResult(ai, row, col, outcome); },
      reset: function () { ai = createNotes(rng); },
      mode: function () { return mode(ai); },
      notes: function () { return ai; }
    };
  }

  var api = {
    id: 'officer',
    label: 'Officer',
    description: 'Get past the waves.',
    create: create,
    createNotes: createNotes,
    chooseShot: chooseShot,
    recordResult: recordResult,
    mode: mode
  };

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.Battleship = root.Battleship || {};
    root.Battleship.ranks = root.Battleship.ranks || {};
    root.Battleship.ranks.officer = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
