/*
 * Plays 1,000 games per rank against randomly placed fleets and prints the
 * average, fewest and most shots each rank needed to sink the whole fleet.
 * Run with `node tests/simulate.js` (optionally: `node tests/simulate.js 5000`).
 */
'use strict';

var rules = require('../js/rules.js');
var opponents = require('../js/opponents.js');

var GAMES = Number(process.argv[2]) || 1000;
var rng = rules.createRng(20261125);

console.log('| Rank | Games | Average shots | Fewest | Most |');
console.log('|---|---|---|---|---|');
opponents.list().forEach(function (rank) {
  var total = 0, fewest = Infinity, most = 0;
  for (var g = 0; g < GAMES; g++) {
    var board = rules.createBoard();
    rules.placeFleetRandomly(board, rng);
    var opponent = opponents.createOpponent(rank.id, rng);
    var fired = {}, shots = 0;
    while (!rules.allSunk(board)) {
      var shot = opponent.chooseShot();
      var key = shot.row + ',' + shot.col;
      if (fired[key]) throw new Error(rank.label + ' repeated ' + rules.formatCoordinate(shot.row, shot.col));
      fired[key] = true;
      var outcome = rules.fire(board, shot.row, shot.col);
      if (outcome.result === 'invalid') throw new Error(rank.label + ' fired off the board');
      opponent.recordResult(shot.row, shot.col, outcome);
      shots++;
    }
    total += shots;
    fewest = Math.min(fewest, shots);
    most = Math.max(most, shots);
  }
  console.log('| ' + rank.label + ' | ' + GAMES + ' | ' + (total / GAMES).toFixed(1) + ' | ' + fewest + ' | ' + most + ' |');
});
