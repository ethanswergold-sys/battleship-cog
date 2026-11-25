/* Automated tests for the opponent ranks (js/opponents.js, js/ranks/*.js). Run with `node --test tests/*.test.js` or open tests/run.html. */
(function () {
  'use strict';

  var isNode = typeof module === 'object' && module.exports;
  var rules = isNode ? require('../js/rules.js') : window.Battleship.rules;
  var opponents = isNode ? require('../js/opponents.js') : window.Battleship.opponents;
  var officer = isNode ? require('../js/ranks/officer.js') : window.Battleship.ranks.officer;
  var test = isNode ? require('node:test').test : window.TestHarness.test;
  var assert = isNode ? require('node:assert/strict') : window.TestHarness.assert;

  // The Officer's step-by-step notes, tested directly.
  var computer = {
    createComputer: officer.createNotes,
    chooseShot: officer.chooseShot,
    recordResult: officer.recordResult,
    mode: officer.mode
  };

  var H = rules.HORIZONTAL;
  var V = rules.VERTICAL;

  function shoot(ai, board) {
    var shot = computer.chooseShot(ai);
    var outcome = rules.fire(board, shot.row, shot.col);
    computer.recordResult(ai, shot.row, shot.col, outcome);
    return { shot: shot, outcome: outcome };
  }

  // Plays MacArthur against a board until every ship sinks. Returns the shot count.
  function playOut(ai, board) {
    var shots = 0;
    while (!rules.allSunk(board)) {
      var turn = shoot(ai, board);
      assert.ok(turn.outcome.result !== 'repeat', 'repeated ' + rules.formatCoordinate(turn.shot.row, turn.shot.col));
      assert.ok(turn.outcome.result !== 'invalid', 'fired off the board');
      shots++;
      assert.ok(shots <= 100, 'took more than 100 shots');
    }
    return shots;
  }

  function isNeighbor(a, b) {
    return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
  }

  test('Officer: MacArthur starts out hunting on a checkerboard pattern', function () {
    var ai = computer.createComputer(rules.createRng(1));
    assert.equal(computer.mode(ai), 'hunt');
    var board = rules.createBoard();
    rules.placeShip(board, 'Destroyer', 9, 8, H);
    var parity = null;
    for (var i = 0; i < 30; i++) {
      var turn = shoot(ai, board);
      if (turn.outcome.result !== 'miss') break;
      var p = (turn.shot.row + turn.shot.col) % 2;
      if (parity === null) parity = p;
      assert.equal(p, parity, 'hunt shots stay on one checkerboard colour');
    }
  });

  test('Officer: after a hit, MacArthur fires at a square next to it', function () {
    var ai = computer.createComputer(rules.createRng(2));
    computer.recordResult(ai, 4, 4, { result: 'hit', shipName: 'Cruiser' });
    assert.equal(computer.mode(ai), 'target');
    for (var n = 0; n < 20; n++) {
      assert.ok(isNeighbor(computer.chooseShot(ai), { row: 4, col: 4 }));
    }
  });

  test('Officer: after two hits in a row, MacArthur keeps firing along that line', function () {
    var ai = computer.createComputer(rules.createRng(3));
    computer.recordResult(ai, 4, 4, { result: 'hit', shipName: 'Battleship' });
    computer.recordResult(ai, 4, 5, { result: 'hit', shipName: 'Battleship' });
    for (var n = 0; n < 20; n++) {
      var shot = computer.chooseShot(ai);
      assert.equal(shot.row, 4, 'stays on row E');
      assert.ok(shot.col === 3 || shot.col === 6, 'fires at either end of the line');
    }
  });

  test('Officer: when one end of the line is a miss, MacArthur turns to the other end', function () {
    var ai = computer.createComputer(rules.createRng(4));
    computer.recordResult(ai, 2, 7, { result: 'hit', shipName: 'Carrier' });
    computer.recordResult(ai, 3, 7, { result: 'hit', shipName: 'Carrier' });
    computer.recordResult(ai, 4, 7, { result: 'miss' });
    assert.deepEqual(computer.chooseShot(ai), { row: 1, col: 7 });
  });

  test('Officer: MacArthur skips directions where the ship could not fit', function () {
    var ai = computer.createComputer(rules.createRng(5));
    // Hit at A1 (corner). Misses at A2 leave only downward room for the Carrier.
    computer.recordResult(ai, 0, 1, { result: 'miss' });
    computer.recordResult(ai, 0, 0, { result: 'hit', shipName: 'Carrier' });
    assert.deepEqual(computer.chooseShot(ai), { row: 1, col: 0 });
  });

  test('Officer: after sinking a ship, MacArthur goes back to hunting', function () {
    var ai = computer.createComputer(rules.createRng(6));
    computer.recordResult(ai, 5, 5, { result: 'hit', shipName: 'Destroyer' });
    computer.recordResult(ai, 5, 6, { result: 'sunk', shipName: 'Destroyer' });
    assert.equal(computer.mode(ai), 'hunt');
    assert.deepEqual(ai.sunk, ['Destroyer']);
    var shot = computer.chooseShot(ai);
    assert.equal((shot.row + shot.col) % 2, ai.parity, 'next shot is a checkerboard hunt shot');
  });

  test('Officer: if it hits a second ship while targeting, MacArthur finishes that one too', function () {
    var ai = computer.createComputer(rules.createRng(7));
    var board = rules.createBoard();
    // Two ships side by side so targeting one will likely clip the other.
    rules.placeShip(board, 'Cruiser', 4, 2, H);
    rules.placeShip(board, 'Submarine', 5, 2, H);
    // Start with a known hit on the Cruiser.
    var outcome = rules.fire(board, 4, 3);
    computer.recordResult(ai, 4, 3, outcome);
    var safety = 0;
    while (!(board.ships[0].hits === 3 && board.ships[1].hits === 3)) {
      if (computer.mode(ai) === 'hunt' && board.ships[1].hits === 0) {
        // Never clipped the Submarine; that's fine, stop here.
        assert.equal(board.ships[0].hits, 3);
        return;
      }
      shoot(ai, board);
      assert.ok(++safety < 100);
    }
    assert.equal(computer.mode(ai), 'hunt');
  });

  test('Officer: MacArthur only learns from shot results, never from the player\'s board', function () {
    var ai = computer.createComputer(rules.createRng(8));
    var board = rules.createBoard();
    rules.placeFleetRandomly(board, rules.createRng(9));
    var before = JSON.stringify(board);
    computer.chooseShot(ai);
    assert.equal(JSON.stringify(board), before, 'choosing a shot does not touch the board');
    assert.equal(computer.chooseShot.length, 1, 'chooseShot is only given MacArthur\'s own notes');
  });

  test('Officer: MacArthur never repeats a shot and always finishes within 100 shots (2,000 games)', function () {
    var rng = rules.createRng(2026);
    var total = 0;
    var worst = 0;
    var games = 2000;
    for (var g = 0; g < games; g++) {
      var board = rules.createBoard();
      rules.placeFleetRandomly(board, rng);
      var shots = playOut(computer.createComputer(rng), board);
      total += shots;
      worst = Math.max(worst, shots);
    }
    var average = total / games;
    // Random guessing averages about 96 shots to sink the whole fleet.
    assert.ok(average < 60, 'average shots ' + average.toFixed(1));
    assert.ok(worst <= 100);
  });

  test('Officer: MacArthur plays a full game through the game rules', function () {
    var rng = rules.createRng(11);
    var game = rules.createGame(rng);
    rules.placeFleetRandomly(game.player, rng);
    rules.startGame(game, rng);
    var ai = computer.createComputer(rng);
    var guard = 0;
    while (game.phase === 'playing') {
      if (game.turn === 'computer') {
        var shot = computer.chooseShot(ai);
        computer.recordResult(ai, shot.row, shot.col, rules.computerFire(game, shot.row, shot.col));
      } else {
        game.turn = 'computer'; // the player passes in this simulation
      }
      assert.ok(++guard < 300);
    }
    assert.equal(game.winner, 'computer');
  });
  // ----- Shared opponent structure -----

  function shootWith(opponent, board) {
    var shot = opponent.chooseShot();
    var outcome = rules.fire(board, shot.row, shot.col);
    opponent.recordResult(shot.row, shot.col, outcome);
    return { shot: shot, outcome: outcome };
  }

  // Plays one rank against a board until every ship sinks, checking every
  // shot is on the board and new. Returns the number of shots.
  function playRank(opponent, board) {
    var fired = {};
    var shots = 0;
    while (!rules.allSunk(board)) {
      var turn = shootWith(opponent, board);
      var key = turn.shot.row + ',' + turn.shot.col;
      assert.ok(turn.shot.row >= 0 && turn.shot.row < 10 && turn.shot.col >= 0 && turn.shot.col < 10, 'off the board');
      assert.ok(!fired[key], 'repeated ' + rules.formatCoordinate(turn.shot.row, turn.shot.col));
      fired[key] = true;
      shots++;
      assert.ok(shots <= 100, 'took more than 100 shots');
    }
    return shots;
  }

  function averageShots(id, games, seed) {
    var rng = rules.createRng(seed);
    var total = 0;
    for (var g = 0; g < games; g++) {
      var board = rules.createBoard();
      rules.placeFleetRandomly(board, rng);
      total += playRank(opponents.createOpponent(id, rng), board);
    }
    return total / games;
  }

  test('ranks are listed weakest first, starting with the Rookie', function () {
    assert.deepEqual(opponents.list(), [{ id: 'rookie', label: 'Rookie' }, { id: 'officer', label: 'Officer' }]);
    assert.equal(opponents.DEFAULT_RANK, 'rookie');
    assert.equal(opponents.find('general'), null, 'the General is not built yet');
  });

  test('every rank has the same four actions', function () {
    opponents.list().forEach(function (rank) {
      var opponent = opponents.createOpponent(rank.id, rules.createRng(1));
      assert.equal(opponent.rank, rank.id);
      ['placeShips', 'chooseShot', 'recordResult', 'reset'].forEach(function (action) {
        assert.equal(typeof opponent[action], 'function', rank.label + ' can ' + action);
      });
    });
  });

  test('an unknown rank falls back to the Rookie', function () {
    assert.equal(opponents.createOpponent('admiral', rules.createRng(1)).rank, 'rookie');
  });

  test('every rank places a complete, legal fleet on its own board', function () {
    opponents.list().forEach(function (rank) {
      var board = rules.createBoard();
      opponents.createOpponent(rank.id, rules.createRng(2)).placeShips(board);
      assert.ok(rules.isFleetComplete(board), rank.label);
    });
  });

  test('the game lets the current opponent place its ships', function () {
    var placed = null;
    var game = rules.createGame(rules.createRng(3), function (board) {
      placed = board;
      rules.placeFleetRandomly(board, rules.createRng(4));
    });
    assert.equal(placed, game.enemy);
    assert.ok(rules.isFleetComplete(game.enemy));
  });

  test('reset makes every rank forget its shots', function () {
    opponents.list().forEach(function (rank) {
      var opponent = opponents.createOpponent(rank.id, rules.createRng(5));
      for (var r = 0; r < 10; r++) {
        for (var c = 0; c < 10; c++) if (!(r === 0 && c === 0)) opponent.recordResult(r, c, { result: 'miss' });
      }
      assert.deepEqual(opponent.chooseShot(), { row: 0, col: 0 }, rank.label + ' has one square left');
      opponent.reset();
      var seen = {};
      for (var i = 0; i < 30; i++) {
        var s = opponent.chooseShot();
        seen[s.row + ',' + s.col] = true;
        opponent.recordResult(s.row, s.col, { result: 'miss' });
      }
      assert.equal(Object.keys(seen).length, 30, rank.label + ' fires at fresh squares again');
    });
  });

  test('a rank switched in mid-game never repeats a square already fired at', function () {
    ['rookie', 'officer'].forEach(function (first) {
      var second = first === 'rookie' ? 'officer' : 'rookie';
      var rng = rules.createRng(6);
      var board = rules.createBoard();
      rules.placeFleetRandomly(board, rng);
      var history = [];
      var opponent = opponents.createOpponent(first, rng);
      for (var i = 0; i < 40; i++) {
        var turn = shootWith(opponent, board);
        history.push({ row: turn.shot.row, col: turn.shot.col, outcome: turn.outcome });
      }
      opponent = opponents.createOpponent(second, rng, history);
      while (!rules.allSunk(board)) {
        var next = shootWith(opponent, board);
        assert.notEqual(next.outcome.result, 'repeat', first + ' -> ' + second + ' repeated a square');
        assert.ok(history.length++ < 100);
      }
    });
  });

  test('an Officer taking over mid-game finishes off a ship the Rookie wounded', function () {
    var board = rules.createBoard();
    rules.placeShip(board, 'Carrier', 4, 2, H);
    var history = [{ row: 4, col: 4, outcome: rules.fire(board, 4, 4) }];
    var opponent = opponents.createOpponent('officer', rules.createRng(7), history);
    assert.ok(isNeighbor(opponent.chooseShot(), { row: 4, col: 4 }));
  });

  // ----- Rookie -----

  test('Rookie: fires at random squares, not a checkerboard', function () {
    var rookie = opponents.createOpponent('rookie', rules.createRng(8));
    var colours = [0, 0];
    for (var i = 0; i < 60; i++) {
      var s = rookie.chooseShot();
      colours[(s.row + s.col) % 2]++;
      rookie.recordResult(s.row, s.col, { result: 'miss' });
    }
    assert.ok(colours[0] > 10 && colours[1] > 10, JSON.stringify(colours));
  });

  test('Rookie: does not follow up on a hit', function () {
    var nextToHit = 0;
    for (var seed = 1; seed <= 200; seed++) {
      var rookie = opponents.createOpponent('rookie', rules.createRng(seed));
      rookie.recordResult(4, 4, { result: 'hit', shipName: 'Cruiser' });
      if (isNeighbor(rookie.chooseShot(), { row: 4, col: 4 })) nextToHit++;
    }
    // 4 of the 99 open squares are next to the hit: about 8 in 200 by chance.
    assert.ok(nextToHit < 25, 'shot next to the hit ' + nextToHit + ' times in 200');
  });

  test('Rookie: uses every square exactly once over a whole board', function () {
    var rookie = opponents.createOpponent('rookie', rules.createRng(9));
    var seen = {};
    for (var i = 0; i < 100; i++) {
      var s = rookie.chooseShot();
      assert.ok(!seen[s.row + ',' + s.col], 'repeat');
      seen[s.row + ',' + s.col] = true;
      rookie.recordResult(s.row, s.col, { result: 'miss' });
    }
    assert.equal(rookie.chooseShot(), null, 'nothing left to fire at');
  });

  // ----- Both ranks over many games -----

  test('neither rank repeats a shot or fires off the board (1,000 games each)', function () {
    ['rookie', 'officer'].forEach(function (id) { averageShots(id, 1000, 2026); });
  });

  test('the Officer averages clearly fewer shots than the Rookie', function () {
    var rookie = averageShots('rookie', 500, 11);
    var officerAvg = averageShots('officer', 500, 11);
    assert.ok(officerAvg < rookie - 25, 'Officer ' + officerAvg.toFixed(1) + ' vs Rookie ' + rookie.toFixed(1));
  });

  test('the Officer plays a full game through the game rules', function () {
    var rng = rules.createRng(11);
    var ai = opponents.createOpponent('officer', rng);
    var game = rules.createGame(rng, ai.placeShips);
    rules.placeFleetRandomly(game.player, rng);
    rules.startGame(game, rng);
    var guard = 0;
    while (game.phase === 'playing') {
      if (game.turn === 'computer') {
        var shot = ai.chooseShot();
        ai.recordResult(shot.row, shot.col, rules.computerFire(game, shot.row, shot.col));
      } else {
        game.turn = 'computer';
      }
      assert.ok(++guard < 300);
    }
    assert.equal(game.winner, 'computer');
  });
})();
