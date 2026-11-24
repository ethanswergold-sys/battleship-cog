/* Automated tests for js/computer.js (MacArthur). Run with `node --test tests/*.test.js` or open tests/run.html. */
(function () {
  'use strict';

  var isNode = typeof module === 'object' && module.exports;
  var rules = isNode ? require('../js/rules.js') : window.Battleship.rules;
  var computer = isNode ? require('../js/computer.js') : window.Battleship.computer;
  var test = isNode ? require('node:test').test : window.TestHarness.test;
  var assert = isNode ? require('node:assert/strict') : window.TestHarness.assert;

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

  test('MacArthur starts out hunting on a checkerboard pattern', function () {
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

  test('after a hit, MacArthur fires at a square next to it', function () {
    var ai = computer.createComputer(rules.createRng(2));
    computer.recordResult(ai, 4, 4, { result: 'hit', shipName: 'Cruiser' });
    assert.equal(computer.mode(ai), 'target');
    for (var n = 0; n < 20; n++) {
      assert.ok(isNeighbor(computer.chooseShot(ai), { row: 4, col: 4 }));
    }
  });

  test('after two hits in a row, MacArthur keeps firing along that line', function () {
    var ai = computer.createComputer(rules.createRng(3));
    computer.recordResult(ai, 4, 4, { result: 'hit', shipName: 'Battleship' });
    computer.recordResult(ai, 4, 5, { result: 'hit', shipName: 'Battleship' });
    for (var n = 0; n < 20; n++) {
      var shot = computer.chooseShot(ai);
      assert.equal(shot.row, 4, 'stays on row E');
      assert.ok(shot.col === 3 || shot.col === 6, 'fires at either end of the line');
    }
  });

  test('when one end of the line is a miss, MacArthur turns to the other end', function () {
    var ai = computer.createComputer(rules.createRng(4));
    computer.recordResult(ai, 2, 7, { result: 'hit', shipName: 'Carrier' });
    computer.recordResult(ai, 3, 7, { result: 'hit', shipName: 'Carrier' });
    computer.recordResult(ai, 4, 7, { result: 'miss' });
    assert.deepEqual(computer.chooseShot(ai), { row: 1, col: 7 });
  });

  test('MacArthur skips directions where the ship could not fit', function () {
    var ai = computer.createComputer(rules.createRng(5));
    // Hit at A1 (corner). Misses at A2 leave only downward room for the Carrier.
    computer.recordResult(ai, 0, 1, { result: 'miss' });
    computer.recordResult(ai, 0, 0, { result: 'hit', shipName: 'Carrier' });
    assert.deepEqual(computer.chooseShot(ai), { row: 1, col: 0 });
  });

  test('after sinking a ship, MacArthur goes back to hunting', function () {
    var ai = computer.createComputer(rules.createRng(6));
    computer.recordResult(ai, 5, 5, { result: 'hit', shipName: 'Destroyer' });
    computer.recordResult(ai, 5, 6, { result: 'sunk', shipName: 'Destroyer' });
    assert.equal(computer.mode(ai), 'hunt');
    assert.deepEqual(ai.sunk, ['Destroyer']);
    var shot = computer.chooseShot(ai);
    assert.equal((shot.row + shot.col) % 2, ai.parity, 'next shot is a checkerboard hunt shot');
  });

  test('if it hits a second ship while targeting, MacArthur finishes that one too', function () {
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

  test('MacArthur only learns from shot results, never from the player\'s board', function () {
    var ai = computer.createComputer(rules.createRng(8));
    var board = rules.createBoard();
    rules.placeFleetRandomly(board, rules.createRng(9));
    var before = JSON.stringify(board);
    computer.chooseShot(ai);
    assert.equal(JSON.stringify(board), before, 'choosing a shot does not touch the board');
    assert.equal(computer.chooseShot.length, 1, 'chooseShot is only given MacArthur\'s own notes');
  });

  test('MacArthur never repeats a shot and always finishes within 100 shots (2,000 games)', function () {
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

  test('MacArthur plays a full game through the game rules', function () {
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
})();
