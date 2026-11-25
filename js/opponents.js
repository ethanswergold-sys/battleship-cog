/*
 * The ranks MacArthur can play at, weakest first. Every rank is its own
 * strategy file in js/ranks/ with the same four actions:
 *   placeShips(board)               put its fleet on its own board
 *   chooseShot()                    -> { row, col } for its next shot
 *   recordResult(row, col, outcome) learn what that shot did (from rules.fire)
 *   reset()                         forget everything and start fresh
 * The game only ever talks to "the current opponent", so switching ranks means
 * changing one setting: the rank id (DEFAULT_RANK, or the player's choice in
 * the rank picker). Every battle starts fresh from newBattle().
 * No screen code lives here.
 */
(function (root) {
  'use strict';

  var isNode = typeof module === 'object' && module.exports;
  var rules = isNode ? require('./rules.js') : root.Battleship.rules;
  var ranks = isNode
    ? {
        rookie: require('./ranks/rookie.js'),
        officer: require('./ranks/officer.js'),
        general: require('./ranks/general.js')
      }
    : root.Battleship.ranks;

  // A new rank also needs its script tag in index.html and tests/run.html.
  var RANKS = [ranks.rookie, ranks.officer, ranks.general];
  var DEFAULT_RANK = 'officer';

  function find(id) {
    for (var i = 0; i < RANKS.length; i++) if (RANKS[i].id === id) return RANKS[i];
    return null;
  }

  function list() {
    return RANKS.map(function (r) { return { id: r.id, label: r.label, description: r.description }; });
  }

  // Creates the opponent for a rank. `history` (optional) is a list of shots
  // already fired ({ row, col, outcome }) for the new opponent to learn.
  function createOpponent(id, rng, history) {
    var rank = find(id) || find(DEFAULT_RANK);
    var opponent = rank.create(rng);
    (history || []).forEach(function (shot) {
      opponent.recordResult(shot.row, shot.col, shot.outcome);
    });
    return opponent;
  }

  // A brand-new battle against the chosen rank: empty boards for both sides,
  // MacArthur's fleet placed by a newly created opponent with no memory of any
  // earlier game, and no shots fired yet.
  function newBattle(id, rng) {
    var rank = find(id) || find(DEFAULT_RANK);
    var opponent = createOpponent(rank.id, rng);
    return {
      rank: rank.id,
      opponent: opponent,
      game: rules.createGame(rng, opponent.placeShips),
      computerShots: []
    };
  }

  var api = {
    DEFAULT_RANK: DEFAULT_RANK,
    list: list,
    find: find,
    createOpponent: createOpponent,
    newBattle: newBattle
  };

  if (isNode) {
    module.exports = api;
  } else {
    root.Battleship = root.Battleship || {};
    root.Battleship.opponents = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
