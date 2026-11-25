/*
 * The ranks MacArthur can play at, weakest first. Every rank is its own
 * strategy file in js/ranks/ with the same four actions:
 *   placeShips(board)               put its fleet on its own board
 *   chooseShot()                    -> { row, col } for its next shot
 *   recordResult(row, col, outcome) learn what that shot did (from rules.fire)
 *   reset()                         forget everything and start fresh
 * The game only ever talks to "the current opponent", so switching ranks means
 * changing one setting: the rank id (DEFAULT_RANK, or the rank dropdown).
 * No screen code lives here.
 */
(function (root) {
  'use strict';

  var isNode = typeof module === 'object' && module.exports;
  var ranks = isNode
    ? { rookie: require('./ranks/rookie.js'), officer: require('./ranks/officer.js') }
    : root.Battleship.ranks;

  // Add the General here (and its script tag in index.html) when it exists.
  var RANKS = [ranks.rookie, ranks.officer];
  var DEFAULT_RANK = 'rookie';

  function find(id) {
    for (var i = 0; i < RANKS.length; i++) if (RANKS[i].id === id) return RANKS[i];
    return null;
  }

  function list() {
    return RANKS.map(function (r) { return { id: r.id, label: r.label }; });
  }

  // Creates the opponent for a rank. `history` is the list of shots already
  // fired this game ({ row, col, outcome }); the new opponent learns them, so
  // a rank switched in mid-game carries on without repeating a square.
  function createOpponent(id, rng, history) {
    var rank = find(id) || find(DEFAULT_RANK);
    var opponent = rank.create(rng);
    (history || []).forEach(function (shot) {
      opponent.recordResult(shot.row, shot.col, shot.outcome);
    });
    return opponent;
  }

  var api = { DEFAULT_RANK: DEFAULT_RANK, list: list, find: find, createOpponent: createOpponent };

  if (isNode) {
    module.exports = api;
  } else {
    root.Battleship = root.Battleship || {};
    root.Battleship.opponents = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
