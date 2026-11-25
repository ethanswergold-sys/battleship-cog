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

  test('ranks are listed weakest first: Rookie, Officer, General', function () {
    assert.deepEqual(opponents.list().map(function (r) { return [r.id, r.label]; }), [
      ['rookie', 'Rookie'], ['officer', 'Officer'], ['general', 'General']
    ]);
    opponents.list().forEach(function (r) { assert.ok(r.description, r.label + ' has a description for the picker'); });
  });

  test('the rank picker starts on the Officer', function () {
    assert.equal(opponents.DEFAULT_RANK, 'officer');
  });

  test('each rank choice starts a battle against that rank', function () {
    opponents.list().forEach(function (rank) {
      var battle = opponents.newBattle(rank.id, rules.createRng(21));
      assert.equal(battle.rank, rank.id);
      assert.equal(battle.opponent.rank, rank.id, rank.label + ' opponent');
      assert.equal(battle.game.phase, 'placing');
      assert.ok(rules.isFleetComplete(battle.game.enemy), rank.label + ' placed its fleet');
      assert.equal(battle.game.player.ships.length, 0);
      assert.deepEqual(battle.computerShots, []);
    });
  });

  // Plays `turns` turns each of a battle, the way js/main.js does.
  function playTurns(battle, rng, turns) {
    rules.placeFleetRandomly(battle.game.player, rng);
    rules.startGame(battle.game, rng);
    for (var i = 0; i < turns && battle.game.phase === 'playing'; i++) {
      if (battle.game.turn === 'player') {
        rules.playerFire(battle.game, Math.floor(i / 10), i % 10);
      } else {
        var shot = battle.opponent.chooseShot();
        var outcome = rules.computerFire(battle.game, shot.row, shot.col);
        battle.opponent.recordResult(shot.row, shot.col, outcome);
        battle.computerShots.push({ row: shot.row, col: shot.col, outcome: outcome });
      }
    }
  }

  function shotCount(board) {
    var n = 0;
    board.shots.forEach(function (row) { row.forEach(function (s) { if (s) n++; }); });
    return n;
  }

  test('changing rank (or playing again) fully resets both boards and the opponent\'s memory', function () {
    var ids = opponents.list().map(function (r) { return r.id; });
    ids.forEach(function (from) {
      ids.forEach(function (to) {
        var rng = rules.createRng(31);
        var old = opponents.newBattle(from, rng);
        playTurns(old, rng, 40);
        assert.ok(old.computerShots.length > 0 && shotCount(old.game.enemy) > 0, 'the first battle was played');

        var fresh = opponents.newBattle(to, rng);
        assert.equal(fresh.opponent.rank, to);
        assert.notEqual(fresh.opponent, old.opponent, 'a new opponent, not the old one');
        assert.notEqual(fresh.game, old.game, 'a new game');
        assert.equal(fresh.game.phase, 'placing');
        assert.equal(fresh.game.player.ships.length, 0, 'your board is empty again');
        assert.equal(shotCount(fresh.game.player), 0, 'no shots on your board');
        assert.equal(shotCount(fresh.game.enemy), 0, 'no shots on MacArthur\'s board');
        assert.ok(rules.isFleetComplete(fresh.game.enemy), 'MacArthur placed a new fleet');
        assert.deepEqual(fresh.computerShots, []);

        // The new opponent remembers nothing: over a whole board of misses it
        // fires at all 100 squares, including the ones fired at last battle.
        if (fresh.opponent.mode) assert.notEqual(fresh.opponent.mode(), 'target', 'not still chasing an old hit');
        var seen = {};
        for (var i = 0; i < 100; i++) {
          var s = fresh.opponent.chooseShot();
          assert.ok(s && !seen[s.row + ',' + s.col], from + ' -> ' + to + ' fires at a fresh square');
          seen[s.row + ',' + s.col] = true;
          fresh.opponent.recordResult(s.row, s.col, { result: 'miss' });
        }
      });
    });
  });

  test('an unknown rank choice starts a battle against the Officer', function () {
    assert.equal(opponents.newBattle('admiral', rules.createRng(1)).opponent.rank, 'officer');
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

  test('an unknown rank falls back to the Officer', function () {
    assert.equal(opponents.createOpponent('admiral', rules.createRng(1)).rank, 'officer');
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
    [['rookie', 'officer'], ['officer', 'rookie'], ['rookie', 'general'], ['officer', 'general'], ['general', 'rookie']].forEach(function (pair) {
      var first = pair[0];
      var second = pair[1];
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

  test('an Officer taking over fills the gap between two hits on the same ship first', function () {
    var board = rules.createBoard();
    rules.placeShip(board, 'Cruiser', 0, 0, H);
    var history = [
      { row: 0, col: 0, outcome: rules.fire(board, 0, 0) },
      { row: 0, col: 2, outcome: rules.fire(board, 0, 2) }
    ];
    var opponent = opponents.createOpponent('officer', rules.createRng(12), history);
    assert.deepEqual(opponent.chooseShot(), { row: 0, col: 1 });
    var vertical = rules.createBoard();
    rules.placeShip(vertical, 'Carrier', 2, 5, rules.VERTICAL);
    history = [
      { row: 2, col: 5, outcome: rules.fire(vertical, 2, 5) },
      { row: 6, col: 5, outcome: rules.fire(vertical, 6, 5) }
    ];
    opponent = opponents.createOpponent('officer', rules.createRng(13), history);
    var shot = opponent.chooseShot();
    assert.ok(shot.col === 5 && shot.row > 2 && shot.row < 6, JSON.stringify(shot));
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

  test('no rank repeats a shot or fires off the board (1,000 games each)', function () {
    ['rookie', 'officer', 'general'].forEach(function (id) { averageShots(id, 1000, 2026); });
  });

  test('each rank averages fewer shots than the one below it', function () {
    var rookie = averageShots('rookie', 500, 11);
    var officerAvg = averageShots('officer', 500, 11);
    var general = averageShots('general', 500, 11);
    assert.ok(officerAvg < rookie - 25, 'Officer ' + officerAvg.toFixed(1) + ' vs Rookie ' + rookie.toFixed(1));
    assert.ok(general < officerAvg - 3, 'General ' + general.toFixed(1) + ' vs Officer ' + officerAvg.toFixed(1));
  });

  // ----- General -----

  var general = isNode ? require('../js/ranks/general.js') : window.Battleship.ranks.general;

  test('General: on an empty board, the middle scores higher than the corners', function () {
    var scores = general.scoreMap(general.createNotes(rules.createRng(1)));
    assert.ok(scores[4][4] > scores[0][0] && scores[5][5] > scores[9][9]);
    assert.equal(scores[0][0], scores[9][9], 'the map is symmetrical');
  });

  test('General: fires at a highest-scoring square, breaking ties at random', function () {
    var picks = {};
    for (var seed = 1; seed <= 40; seed++) {
      var ai = general.createNotes(rules.createRng(seed));
      var scores = general.scoreMap(ai);
      var best = Math.max.apply(null, scores.map(function (row) { return Math.max.apply(null, row); }));
      var shot = general.chooseShot(ai);
      assert.equal(scores[shot.row][shot.col], best);
      picks[shot.row + ',' + shot.col] = true;
    }
    assert.ok(Object.keys(picks).length > 1, 'not always the same opening square');
  });

  test('General: no ship can lie across a miss or a sunk ship', function () {
    var ai = general.createNotes(rules.createRng(2));
    // Misses all around A1 leave no room for any ship there.
    general.recordResult(ai, 0, 1, { result: 'miss' });
    general.recordResult(ai, 1, 0, { result: 'miss' });
    assert.equal(general.scoreMap(ai)[0][0], 0);
    // A sunk Destroyer at A2-A3 and a miss at B1 also leave no room at A1.
    var ai2 = general.createNotes(rules.createRng(3));
    general.recordResult(ai2, 0, 1, { result: 'hit', shipName: 'Destroyer' });
    general.recordResult(ai2, 0, 2, { result: 'sunk', shipName: 'Destroyer' });
    general.recordResult(ai2, 1, 0, { result: 'miss' });
    assert.equal(general.scoreMap(ai2)[0][0], 0);
    assert.equal(general.mode(ai2), 'hunt');
  });

  test('General: after a hit, it fires next to the damaged ship', function () {
    for (var seed = 1; seed <= 20; seed++) {
      var ai = general.createNotes(rules.createRng(seed));
      general.recordResult(ai, 4, 4, { result: 'hit', shipName: 'Cruiser' });
      assert.equal(general.mode(ai), 'target');
      assert.ok(isNeighbor(general.chooseShot(ai), { row: 4, col: 4 }));
    }
  });

  test('General: with two hits in a line, it keeps to that line', function () {
    var ai = general.createNotes(rules.createRng(4));
    general.recordResult(ai, 2, 7, { result: 'hit', shipName: 'Carrier' });
    general.recordResult(ai, 3, 7, { result: 'hit', shipName: 'Carrier' });
    var shot = general.chooseShot(ai);
    assert.equal(shot.col, 7);
    assert.ok(shot.row === 1 || shot.row === 4);
  });

  test('General: fills the gap between two hits on the same ship first', function () {
    var ai = general.createNotes(rules.createRng(5));
    general.recordResult(ai, 0, 0, { result: 'hit', shipName: 'Cruiser' });
    general.recordResult(ai, 0, 2, { result: 'hit', shipName: 'Cruiser' });
    assert.deepEqual(general.chooseShot(ai), { row: 0, col: 1 });
  });

  test('General: after sinking one ship it finishes another ship it already hit', function () {
    var ai = general.createNotes(rules.createRng(6));
    general.recordResult(ai, 8, 8, { result: 'hit', shipName: 'Submarine' });
    general.recordResult(ai, 2, 2, { result: 'hit', shipName: 'Destroyer' });
    general.recordResult(ai, 2, 3, { result: 'sunk', shipName: 'Destroyer' });
    assert.equal(general.mode(ai), 'target');
    assert.ok(isNeighbor(general.chooseShot(ai), { row: 8, col: 8 }));
  });

  test('General: choosing a shot takes well under 100 milliseconds', function () {
    var rng = rules.createRng(7);
    var slowest = 0;
    for (var g = 0; g < 20; g++) {
      var board = rules.createBoard();
      rules.placeFleetRandomly(board, rng);
      var opponent = opponents.createOpponent('general', rng);
      while (!rules.allSunk(board)) {
        var start = Date.now();
        var shot = opponent.chooseShot();
        slowest = Math.max(slowest, Date.now() - start);
        opponent.recordResult(shot.row, shot.col, rules.fire(board, shot.row, shot.col));
      }
    }
    assert.ok(slowest < 100, 'slowest shot took ' + slowest + ' ms');
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
