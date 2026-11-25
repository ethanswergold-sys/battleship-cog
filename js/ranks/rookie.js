/*
 * ROOKIE: how this rank plays.
 *   Fires at a random square it hasn't tried yet, every single turn.
 *   It does not follow up on hits: after hitting a ship, its next shot is just
 *   as random as before. It never fires at the same square twice or off the
 *   board, and never sees the player's board.
 * No screen code lives here.
 */
(function (root) {
  'use strict';

  var rules = (typeof module === 'object' && module.exports)
    ? require('../rules.js')
    : root.Battleship.rules;
  var SIZE = rules.SIZE;

  function emptyGrid() {
    var grid = [];
    for (var r = 0; r < SIZE; r++) grid.push(new Array(SIZE).fill(false));
    return grid;
  }

  // The shared opponent interface (see js/opponents.js).
  function create(rng) {
    rng = rng || Math.random;
    var tried = emptyGrid();
    return {
      rank: 'rookie',
      placeShips: function (board) { rules.placeFleetRandomly(board, rng); },
      chooseShot: function () {
        var open = [];
        for (var r = 0; r < SIZE; r++) {
          for (var c = 0; c < SIZE; c++) if (!tried[r][c]) open.push({ row: r, col: c });
        }
        return open.length ? open[Math.floor(rng() * open.length)] : null;
      },
      // The Rookie only remembers where it fired, never what it found there.
      recordResult: function (row, col) {
        if (row >= 0 && row < SIZE && col >= 0 && col < SIZE) tried[row][col] = true;
      },
      reset: function () { tried = emptyGrid(); },
      mode: function () { return 'random'; }
    };
  }

  var api = {
    id: 'rookie',
    label: 'Rookie',
    description: 'Fires at random squares and never follows up a hit. Easy.',
    create: create
  };

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.Battleship = root.Battleship || {};
    root.Battleship.ranks = root.Battleship.ranks || {};
    root.Battleship.ranks.rookie = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
