/*
 * GENERAL: how this rank plays (probability map).
 *   Before every shot, the General imagines every way each ship still afloat
 *   could lie on the board: across or down, anywhere it fits without crossing
 *   a miss, a sunk ship, or a hit on a different ship. Each untried square
 *   gets a score: the number of those possible positions that cover it.
 *   It fires at the square with the highest score. When several squares tie,
 *   it picks one of them at random, so it is not predictable.
 *   Damaged ships come first: a position that passes through the hits on a
 *   ship not yet sunk counts far more (it is almost certainly where that ship
 *   is), so the General finishes off ships it has already hit.
 * The General never fires at the same square twice or off the board, and never
 * sees the player's board: it only learns miss, hit (with ship name) or sunk.
 * No screen code lives here.
 */
(function (root) {
  'use strict';

  var rules = (typeof module === 'object' && module.exports)
    ? require('../rules.js')
    : root.Battleship.rules;
  var SIZE = rules.SIZE;
  // How much more a position through a damaged ship's hits counts, per hit.
  var HIT_WEIGHT = 1000;

  function createNotes(rng) {
    var known = [];
    for (var r = 0; r < SIZE; r++) known.push(new Array(SIZE).fill(null));
    return {
      rng: rng || Math.random,
      known: known,   // null (untried), 'miss', 'hit' (ship afloat) or 'sunk'
      openHits: {},   // ship name -> [{row, col}] hits on ships not yet sunk
      sunk: []        // names of ships already sunk
    };
  }

  function isUntried(ai, row, col) {
    return row >= 0 && row < SIZE && col >= 0 && col < SIZE && ai.known[row][col] === null;
  }

  // Score of one possible position for a ship, or 0 if it can't lie there.
  function positionWeight(ai, name, cells) {
    var own = ai.openHits[name] || [];
    var covered = 0;
    for (var i = 0; i < cells.length; i++) {
      var mark = ai.known[cells[i].row][cells[i].col];
      if (mark === 'miss' || mark === 'sunk') return 0;
      if (mark === 'hit') {
        var mine = own.some(function (h) { return h.row === cells[i].row && h.col === cells[i].col; });
        if (!mine) return 0; // that hit belongs to another ship
        covered++;
      }
    }
    // A damaged ship must cover every hit already made on it.
    if (covered < own.length) return 0;
    return Math.pow(HIT_WEIGHT, covered);
  }

  // The probability map: a score for every square (0 for squares already tried).
  function scoreMap(ai) {
    var scores = [];
    for (var r = 0; r < SIZE; r++) scores.push(new Array(SIZE).fill(0));
    rules.FLEET.forEach(function (ship) {
      if (ai.sunk.indexOf(ship.name) !== -1) return;
      [rules.HORIZONTAL, rules.VERTICAL].forEach(function (orientation) {
        for (var row = 0; row < SIZE; row++) {
          for (var col = 0; col < SIZE; col++) {
            var cells = rules.shipCells(row, col, ship.size, orientation);
            if (cells[cells.length - 1].row >= SIZE || cells[cells.length - 1].col >= SIZE) continue;
            var weight = positionWeight(ai, ship.name, cells);
            if (!weight) continue;
            cells.forEach(function (c) {
              if (ai.known[c.row][c.col] === null) scores[c.row][c.col] += weight;
            });
          }
        }
      });
    });
    return scores;
  }

  function chooseShot(ai) {
    var scores = scoreMap(ai);
    var best = [];
    var bestScore = 0;
    var untried = [];
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (!isUntried(ai, r, c)) continue;
        untried.push({ row: r, col: c });
        if (scores[r][c] > bestScore) { bestScore = scores[r][c]; best = []; }
        if (scores[r][c] === bestScore && bestScore > 0) best.push({ row: r, col: c });
      }
    }
    var pool = best.length ? best : untried;
    return pool.length ? pool[Math.floor(ai.rng() * pool.length)] : null;
  }

  function recordResult(ai, row, col, outcome) {
    if (row < 0 || row >= SIZE || col < 0 || col >= SIZE) return;
    if (outcome.result === 'miss') {
      ai.known[row][col] = 'miss';
    } else if (outcome.result === 'hit') {
      ai.known[row][col] = 'hit';
      (ai.openHits[outcome.shipName] = ai.openHits[outcome.shipName] || []).push({ row: row, col: col });
    } else if (outcome.result === 'sunk') {
      ai.known[row][col] = 'sunk';
      (ai.openHits[outcome.shipName] || []).forEach(function (h) { ai.known[h.row][h.col] = 'sunk'; });
      delete ai.openHits[outcome.shipName];
      ai.sunk.push(outcome.shipName);
    }
  }

  function mode(ai) {
    return Object.keys(ai.openHits).length ? 'target' : 'hunt';
  }

  // The shared opponent interface (see js/opponents.js).
  function create(rng) {
    rng = rng || Math.random;
    var ai = createNotes(rng);
    return {
      rank: 'general',
      placeShips: function (board) { rules.placeFleetRandomly(board, rng); },
      chooseShot: function () { return chooseShot(ai); },
      recordResult: function (row, col, outcome) { recordResult(ai, row, col, outcome); },
      reset: function () { ai = createNotes(rng); },
      mode: function () { return mode(ai); },
      notes: function () { return ai; }
    };
  }

  var api = {
    id: 'general',
    label: 'General',
    create: create,
    createNotes: createNotes,
    scoreMap: scoreMap,
    chooseShot: chooseShot,
    recordResult: recordResult,
    mode: mode
  };

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.Battleship = root.Battleship || {};
    root.Battleship.ranks = root.Battleship.ranks || {};
    root.Battleship.ranks.general = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
