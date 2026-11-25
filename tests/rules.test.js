/* Automated tests for js/rules.js. Run with `node --test tests/*.test.js` or open tests/run.html. */
(function () {
  'use strict';

  var isNode = typeof module === 'object' && module.exports;
  var rules = isNode ? require('../js/rules.js') : window.Battleship.rules;
  var test = isNode ? require('node:test').test : window.TestHarness.test;
  var assert = isNode ? require('node:assert/strict') : window.TestHarness.assert;

  var H = rules.HORIZONTAL;
  var V = rules.VERTICAL;

  function shipsAt(board, row, col) {
    return board.ships.filter(function (s) {
      return s.cells.some(function (c) { return c.row === row && c.col === col; });
    }).length;
  }

  // Places the whole fleet in rows A, C, E, G, I starting at column 1.
  function placeFleetInRows(board) {
    rules.FLEET.forEach(function (entry, i) {
      rules.placeShip(board, entry.name, i * 2, 0, H);
    });
  }

  function readyGame() {
    var game = rules.createGame(rules.createRng(1));
    placeFleetInRows(game.player);
    rules.startGame(game, rules.createRng(2));
    return game;
  }

  // Ships and board

  test('the standard fleet has the five classic ships', function () {
    assert.deepEqual(
      rules.FLEET.map(function (s) { return s.name + ':' + s.size; }),
      ['Carrier:5', 'Battleship:4', 'Cruiser:3', 'Submarine:3', 'Destroyer:2']
    );
  });

  test('a new board is 10 by 10 with no shots and no ships', function () {
    var board = rules.createBoard();
    assert.equal(board.shots.length, 10);
    board.shots.forEach(function (row) {
      assert.equal(row.length, 10);
      row.forEach(function (cell) { assert.equal(cell, null); });
    });
    assert.equal(board.ships.length, 0);
  });

  // Placement

  test('a ship can be placed horizontally', function () {
    var board = rules.createBoard();
    assert.deepEqual(rules.placeShip(board, 'Cruiser', 3, 2, H), { ok: true });
    assert.deepEqual(board.ships[0].cells, [
      { row: 3, col: 2 }, { row: 3, col: 3 }, { row: 3, col: 4 }
    ]);
  });

  test('a ship can be placed vertically', function () {
    var board = rules.createBoard();
    assert.deepEqual(rules.placeShip(board, 'Destroyer', 8, 9, V), { ok: true });
    assert.deepEqual(board.ships[0].cells, [{ row: 8, col: 9 }, { row: 9, col: 9 }]);
  });

  test('a ship cannot hang off the right edge', function () {
    var board = rules.createBoard();
    assert.deepEqual(rules.placeShip(board, 'Carrier', 0, 6, H), { ok: false, reason: 'off-board' });
    assert.equal(board.ships.length, 0);
  });

  test('a ship cannot hang off the bottom edge', function () {
    var board = rules.createBoard();
    assert.deepEqual(rules.placeShip(board, 'Battleship', 7, 0, V), { ok: false, reason: 'off-board' });
  });

  test('a ship cannot start outside the board', function () {
    var board = rules.createBoard();
    assert.equal(rules.placeShip(board, 'Destroyer', -1, 0, H).reason, 'off-board');
    assert.equal(rules.placeShip(board, 'Destroyer', 0, 10, V).reason, 'off-board');
  });

  test('a ship that fits exactly against the edge is allowed', function () {
    var board = rules.createBoard();
    assert.ok(rules.placeShip(board, 'Carrier', 9, 5, H).ok);
    assert.ok(rules.placeShip(board, 'Battleship', 0, 9, V).ok);
  });

  test('ships cannot overlap', function () {
    var board = rules.createBoard();
    rules.placeShip(board, 'Carrier', 4, 0, H);
    assert.deepEqual(rules.placeShip(board, 'Submarine', 2, 3, V), { ok: false, reason: 'overlap' });
    assert.equal(board.ships.length, 1);
  });

  test('ships may sit right next to each other', function () {
    var board = rules.createBoard();
    assert.ok(rules.placeShip(board, 'Carrier', 4, 0, H).ok);
    assert.ok(rules.placeShip(board, 'Battleship', 5, 0, H).ok);
  });

  test('only horizontal or vertical placement is accepted (no diagonals)', function () {
    var board = rules.createBoard();
    assert.equal(rules.placeShip(board, 'Cruiser', 0, 0, 'diagonal').reason, 'bad-orientation');
  });

  test('each ship can only be placed once', function () {
    var board = rules.createBoard();
    rules.placeShip(board, 'Cruiser', 0, 0, H);
    assert.equal(rules.placeShip(board, 'Cruiser', 5, 5, H).reason, 'already-placed');
  });

  test('unknown ships are rejected', function () {
    var board = rules.createBoard();
    assert.equal(rules.placeShip(board, 'Rowboat', 0, 0, H).reason, 'unknown-ship');
  });

  test('a ship can be picked up and placed again before play starts', function () {
    var board = rules.createBoard();
    rules.placeShip(board, 'Cruiser', 0, 0, H);
    assert.ok(rules.removeShip(board, 'Cruiser').ok);
    assert.ok(rules.placeShip(board, 'Cruiser', 5, 5, V).ok);
  });

  test('the fleet is only complete once all five ships are placed', function () {
    var board = rules.createBoard();
    rules.placeShip(board, 'Carrier', 0, 0, H);
    assert.equal(rules.isFleetComplete(board), false);
    assert.deepEqual(rules.unplacedShips(board).map(function (s) { return s.name; }),
      ['Battleship', 'Cruiser', 'Submarine', 'Destroyer']);
    rules.clearShips(board);
    placeFleetInRows(board);
    assert.equal(rules.isFleetComplete(board), true);
  });

  test('random placement is always complete and legal (500 boards)', function () {
    var rng = rules.createRng(42);
    for (var n = 0; n < 500; n++) {
      var board = rules.createBoard();
      rules.placeFleetRandomly(board, rng);
      assert.equal(board.ships.length, 5);
      assert.ok(rules.isFleetComplete(board));
      var occupied = 0;
      for (var r = 0; r < 10; r++) {
        for (var c = 0; c < 10; c++) {
          var count = shipsAt(board, r, c);
          assert.ok(count <= 1, 'ships overlap at ' + rules.formatCoordinate(r, c));
          occupied += count;
        }
      }
      assert.equal(occupied, 17, 'every ship square is on the board');
      board.ships.forEach(function (ship) {
        var rows = ship.cells.map(function (cell) { return cell.row; });
        var cols = ship.cells.map(function (cell) { return cell.col; });
        var straight = rows.every(function (x) { return x === rows[0]; }) ||
          cols.every(function (x) { return x === cols[0]; });
        assert.ok(straight, ship.name + ' is not in a straight line');
      });
    }
  });

  test('randomize replaces ships already on the board', function () {
    var board = rules.createBoard();
    rules.placeShip(board, 'Carrier', 0, 0, H);
    rules.placeFleetRandomly(board, rules.createRng(7));
    assert.equal(board.ships.length, 5);
  });

  test('the same seed gives the same random fleet', function () {
    var a = rules.createBoard();
    var b = rules.createBoard();
    rules.placeFleetRandomly(a, rules.createRng(99));
    rules.placeFleetRandomly(b, rules.createRng(99));
    assert.deepEqual(a.ships, b.ships);
  });

  // Shots

  test('a shot at an empty square is a miss and is recorded', function () {
    var board = rules.createBoard();
    rules.placeShip(board, 'Destroyer', 0, 0, H);
    assert.deepEqual(rules.fire(board, 5, 5), { result: 'miss' });
    assert.equal(board.shots[5][5], 'miss');
  });

  test('a shot at a ship is a hit and names the ship', function () {
    var board = rules.createBoard();
    rules.placeShip(board, 'Cruiser', 3, 3, H);
    var outcome = rules.fire(board, 3, 4);
    assert.equal(outcome.result, 'hit');
    assert.equal(outcome.shipName, 'Cruiser');
    assert.equal(board.shots[3][4], 'hit');
  });

  test('hitting every square of a ship sinks it', function () {
    var board = rules.createBoard();
    rules.placeShip(board, 'Destroyer', 0, 0, H);
    rules.placeShip(board, 'Cruiser', 5, 5, V);
    assert.equal(rules.fire(board, 0, 0).result, 'hit');
    var outcome = rules.fire(board, 0, 1);
    assert.equal(outcome.result, 'sunk');
    assert.equal(outcome.shipName, 'Destroyer');
    assert.equal(outcome.allSunk, false);
  });

  test('firing at the same square twice is rejected and changes nothing', function () {
    var board = rules.createBoard();
    rules.placeShip(board, 'Destroyer', 0, 0, H);
    rules.fire(board, 0, 0);
    assert.deepEqual(rules.fire(board, 0, 0), { result: 'repeat' });
    assert.equal(board.ships[0].hits, 1);
    rules.fire(board, 9, 9);
    assert.deepEqual(rules.fire(board, 9, 9), { result: 'repeat' });
  });

  test('a shot off the board is rejected', function () {
    var board = rules.createBoard();
    assert.deepEqual(rules.fire(board, 10, 0), { result: 'invalid' });
    assert.deepEqual(rules.fire(board, 0, -1), { result: 'invalid' });
  });

  test('sinking the last ship reports that the whole fleet is sunk', function () {
    var board = rules.createBoard();
    rules.placeShip(board, 'Destroyer', 0, 0, H);
    rules.fire(board, 0, 0);
    var outcome = rules.fire(board, 0, 1);
    assert.equal(outcome.allSunk, true);
    assert.equal(rules.allSunk(board), true);
  });

  // Coordinates

  test('coordinates are read from letter + number in upper or lower case', function () {
    assert.deepEqual(rules.parseCoordinate('A1'), { row: 0, col: 0 });
    assert.deepEqual(rules.parseCoordinate('d4'), { row: 3, col: 3 });
    assert.deepEqual(rules.parseCoordinate('D4'), { row: 3, col: 3 });
    assert.deepEqual(rules.parseCoordinate('j10'), { row: 9, col: 9 });
    assert.deepEqual(rules.parseCoordinate('  D 4 '), { row: 3, col: 3 });
    assert.deepEqual(rules.parseCoordinate('e-7'), { row: 4, col: 6 });
  });

  test('coordinates outside A-J and 1-10 are rejected', function () {
    ['K1', 'A0', 'A11', '4D', 'DD', '', 'A', '10', 'A 1 0', null].forEach(function (text) {
      assert.equal(rules.parseCoordinate(text), null, 'should reject ' + JSON.stringify(text));
    });
  });

  test('coordinates are written as letter + number', function () {
    assert.equal(rules.formatCoordinate(0, 0), 'A1');
    assert.equal(rules.formatCoordinate(3, 3), 'D4');
    assert.equal(rules.formatCoordinate(9, 9), 'J10');
  });

  test('every square round-trips through text and back', function () {
    for (var r = 0; r < 10; r++) {
      for (var c = 0; c < 10; c++) {
        assert.deepEqual(rules.parseCoordinate(rules.formatCoordinate(r, c)), { row: r, col: c });
      }
    }
  });

  // Game flow

  test('a new game hides a complete random fleet for MacArthur and waits for placement', function () {
    var game = rules.createGame(rules.createRng(3));
    assert.equal(game.phase, 'placing');
    assert.ok(rules.isFleetComplete(game.enemy));
    assert.equal(game.player.ships.length, 0);
  });

  test('play cannot start until all five of the player\'s ships are placed', function () {
    var game = rules.createGame(rules.createRng(3));
    rules.placeShip(game.player, 'Carrier', 0, 0, H);
    assert.deepEqual(rules.startGame(game), { ok: false, reason: 'fleet-incomplete' });
    assert.equal(game.phase, 'placing');
  });

  test('once play starts, ships cannot be moved, removed or re-randomized', function () {
    var game = readyGame();
    assert.equal(game.phase, 'playing');
    assert.equal(rules.removeShip(game.player, 'Carrier').reason, 'locked');
    assert.equal(rules.clearShips(game.player).reason, 'locked');
    assert.equal(rules.placeFleetRandomly(game.player).reason, 'locked');
    assert.equal(rules.placeFleetRandomly(game.enemy).reason, 'locked');
  });

  test('the coin flip picks both the player and MacArthur over many games', function () {
    var rng = rules.createRng(5);
    var counts = { player: 0, computer: 0 };
    for (var n = 0; n < 200; n++) {
      var game = rules.createGame(rng);
      placeFleetInRows(game.player);
      var started = rules.startGame(game, rng);
      counts[started.firstTurn]++;
      assert.equal(game.turn, started.firstTurn);
    }
    assert.ok(counts.player > 60 && counts.computer > 60, JSON.stringify(counts));
  });

  test('turns alternate after every hit or miss: one shot per turn', function () {
    var game = readyGame();
    game.turn = 'player';
    rules.playerFire(game, 9, 9);
    assert.equal(game.turn, 'computer');
    var ship = game.enemy.ships[0].cells[0];
    rules.computerFire(game, 0, 0); // hits the player's Carrier
    assert.equal(game.turn, 'player');
    var outcome = rules.playerFire(game, ship.row, ship.col);
    assert.equal(outcome.result, 'hit');
    assert.equal(game.turn, 'computer', 'a hit does not earn an extra shot');
  });

  test('nobody can fire out of turn', function () {
    var game = readyGame();
    game.turn = 'player';
    assert.deepEqual(rules.computerFire(game, 0, 0), { result: 'not-your-turn' });
    game.turn = 'computer';
    assert.deepEqual(rules.playerFire(game, 0, 0), { result: 'not-your-turn' });
  });

  test('nobody can fire before the game starts', function () {
    var game = rules.createGame(rules.createRng(3));
    assert.deepEqual(rules.playerFire(game, 0, 0), { result: 'not-playing' });
  });

  test('a repeated shot does not use up the turn', function () {
    var game = readyGame();
    game.turn = 'player';
    rules.playerFire(game, 9, 9);
    rules.computerFire(game, 9, 9);
    assert.equal(rules.playerFire(game, 9, 9).result, 'repeat');
    assert.equal(game.turn, 'player');
  });

  test('sinking all of MacArthur\'s ships wins the game', function () {
    var game = readyGame();
    var cells = [];
    game.enemy.ships.forEach(function (s) { cells = cells.concat(s.cells); });
    var last;
    cells.forEach(function (cell) {
      game.turn = 'player';
      last = rules.playerFire(game, cell.row, cell.col);
    });
    assert.equal(last.allSunk, true);
    assert.equal(game.phase, 'over');
    assert.equal(game.winner, 'player');
    assert.deepEqual(rules.computerFire(game, 0, 9), { result: 'not-playing' });
  });

  test('MacArthur wins by sinking all of the player\'s ships', function () {
    var game = readyGame();
    game.player.ships.forEach(function (s) {
      s.cells.forEach(function (cell) {
        game.turn = 'computer';
        rules.computerFire(game, cell.row, cell.col);
      });
    });
    assert.equal(game.phase, 'over');
    assert.equal(game.winner, 'computer');
  });

  test('a new game after a finished one starts completely fresh', function () {
    var game = readyGame();
    rules.playerFire(game, 0, 0);
    var fresh = rules.createGame(rules.createRng(8));
    assert.equal(fresh.phase, 'placing');
    assert.equal(fresh.winner, null);
    assert.equal(fresh.player.ships.length, 0);
    assert.equal(fresh.player.locked, false);
    fresh.enemy.shots.forEach(function (row) {
      row.forEach(function (cell) { assert.equal(cell, null); });
    });
  });

  // Announcements

  test('the player\'s shots are announced as Miss, Hit + ship name, and You sank the ...', function () {
    assert.equal(rules.shotMessage('player', 3, 3, { result: 'miss' }), 'D4: Miss.');
    assert.equal(rules.shotMessage('player', 3, 3, { result: 'hit', shipName: 'Cruiser' }), 'D4: Hit! Cruiser.');
    assert.equal(rules.shotMessage('player', 3, 3, { result: 'sunk', shipName: 'Cruiser' }),
      'D4: Hit! You sank the Cruiser!');
    assert.equal(rules.shotMessage('player', 3, 3, { result: 'repeat' }),
      'You already fired at D4. Pick another square.');
  });

  test('MacArthur\'s shots are announced by name', function () {
    assert.equal(rules.COMPUTER_NAME, 'MacArthur');
    assert.equal(rules.shotMessage('computer', 0, 9, { result: 'miss' }), 'MacArthur fires at A10: Miss.');
    assert.equal(rules.shotMessage('computer', 0, 9, { result: 'hit', shipName: 'Battleship' }),
      'MacArthur fires at A10: Hit! Your Battleship.');
    assert.equal(rules.shotMessage('computer', 0, 9, { result: 'sunk', shipName: 'Battleship' }),
      'MacArthur fires at A10: Hit! MacArthur sank your Battleship!');
  });

  test('the player\'s name is tidied up and kept to 20 characters', function () {
    assert.equal(rules.cleanPlayerName('  Ethan  '), 'Ethan');
    assert.equal(rules.cleanPlayerName('Admiral   Grace\tHopper'), 'Admiral Grace Hopper');
    assert.equal(rules.cleanPlayerName('A very long name that goes on'), 'A very long name tha');
    assert.equal(rules.cleanPlayerName('   '), '');
    assert.equal(rules.cleanPlayerName(null), '');
    assert.equal(rules.cleanPlayerName('Zo\u00eb \ud83d\udea2'), 'Zo\u00eb \ud83d\udea2');
  });

  test('possessive names read naturally', function () {
    assert.equal(rules.possessive('Ethan'), 'Ethan\u2019s');
    assert.equal(rules.possessive('You'), 'Your');
  });
})();
