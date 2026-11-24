/*
 * Battleship game rules. No screen code lives here: every function takes
 * plain data and returns plain data, so the rules can be tested on their own.
 * Loaded as a classic <script> (works when index.html is opened by
 * double-click) and also usable from Node for automated tests.
 */
(function (root) {
  'use strict';

  var SIZE = 10;
  var ROW_LETTERS = 'ABCDEFGHIJ';
  var COMPUTER_NAME = 'MacArthur';
  var FLEET = [
    { name: 'Carrier', size: 5 },
    { name: 'Battleship', size: 4 },
    { name: 'Cruiser', size: 3 },
    { name: 'Submarine', size: 3 },
    { name: 'Destroyer', size: 2 }
  ];
  var HORIZONTAL = 'horizontal';
  var VERTICAL = 'vertical';

  // Small seeded random number generator (mulberry32) so tests are repeatable.
  function createRng(seed) {
    var state = seed >>> 0;
    return function () {
      state = (state + 0x6d2b79f5) >>> 0;
      var t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randomInt(rng, max) {
    return Math.floor(rng() * max);
  }

  function inBounds(row, col) {
    return Number.isInteger(row) && Number.isInteger(col) &&
      row >= 0 && row < SIZE && col >= 0 && col < SIZE;
  }

  function fleetEntry(name) {
    for (var i = 0; i < FLEET.length; i++) {
      if (FLEET[i].name === name) return FLEET[i];
    }
    return null;
  }

  function createBoard() {
    var shots = [];
    for (var r = 0; r < SIZE; r++) {
      shots.push(new Array(SIZE).fill(null));
    }
    return { ships: [], shots: shots, locked: false };
  }

  function shipCells(row, col, size, orientation) {
    var cells = [];
    for (var i = 0; i < size; i++) {
      cells.push(orientation === VERTICAL
        ? { row: row + i, col: col }
        : { row: row, col: col + i });
    }
    return cells;
  }

  function shipAt(board, row, col) {
    for (var i = 0; i < board.ships.length; i++) {
      var ship = board.ships[i];
      for (var j = 0; j < ship.cells.length; j++) {
        if (ship.cells[j].row === row && ship.cells[j].col === col) return ship;
      }
    }
    return null;
  }

  // Returns null when the placement is legal, otherwise the reason it is not:
  // 'locked', 'unknown-ship', 'already-placed', 'bad-orientation',
  // 'off-board' or 'overlap'.
  function placementProblem(board, name, row, col, orientation) {
    if (board.locked) return 'locked';
    var entry = fleetEntry(name);
    if (!entry) return 'unknown-ship';
    if (orientation !== HORIZONTAL && orientation !== VERTICAL) return 'bad-orientation';
    for (var i = 0; i < board.ships.length; i++) {
      if (board.ships[i].name === name) return 'already-placed';
    }
    var cells = shipCells(row, col, entry.size, orientation);
    for (var j = 0; j < cells.length; j++) {
      if (!inBounds(cells[j].row, cells[j].col)) return 'off-board';
    }
    for (var k = 0; k < cells.length; k++) {
      if (shipAt(board, cells[k].row, cells[k].col)) return 'overlap';
    }
    return null;
  }

  function placeShip(board, name, row, col, orientation) {
    var problem = placementProblem(board, name, row, col, orientation);
    if (problem) return { ok: false, reason: problem };
    var entry = fleetEntry(name);
    board.ships.push({
      name: name,
      size: entry.size,
      orientation: orientation,
      cells: shipCells(row, col, entry.size, orientation),
      hits: 0
    });
    return { ok: true };
  }

  function removeShip(board, name) {
    if (board.locked) return { ok: false, reason: 'locked' };
    var before = board.ships.length;
    board.ships = board.ships.filter(function (s) { return s.name !== name; });
    return board.ships.length < before ? { ok: true } : { ok: false, reason: 'not-placed' };
  }

  function clearShips(board) {
    if (board.locked) return { ok: false, reason: 'locked' };
    board.ships = [];
    return { ok: true };
  }

  // Replaces any ships on the board with a complete, legal, random fleet.
  function placeFleetRandomly(board, rng) {
    if (board.locked) return { ok: false, reason: 'locked' };
    rng = rng || Math.random;
    board.ships = [];
    FLEET.forEach(function (entry) {
      var placed = false;
      while (!placed) {
        var orientation = rng() < 0.5 ? HORIZONTAL : VERTICAL;
        var row = randomInt(rng, SIZE);
        var col = randomInt(rng, SIZE);
        placed = placeShip(board, entry.name, row, col, orientation).ok;
      }
    });
    return { ok: true };
  }

  function unplacedShips(board) {
    return FLEET.filter(function (entry) {
      return !board.ships.some(function (s) { return s.name === entry.name; });
    });
  }

  function isFleetComplete(board) {
    return unplacedShips(board).length === 0;
  }

  function isSunk(ship) {
    return ship.hits >= ship.size;
  }

  function allSunk(board) {
    return board.ships.length > 0 && board.ships.every(isSunk);
  }

  // Fires one shot at a board. result is 'miss', 'hit', 'sunk', 'repeat'
  // (already fired there) or 'invalid' (not on the board).
  function fire(board, row, col) {
    if (!inBounds(row, col)) return { result: 'invalid' };
    if (board.shots[row][col] !== null) return { result: 'repeat' };
    var ship = shipAt(board, row, col);
    if (!ship) {
      board.shots[row][col] = 'miss';
      return { result: 'miss' };
    }
    board.shots[row][col] = 'hit';
    ship.hits += 1;
    return {
      result: isSunk(ship) ? 'sunk' : 'hit',
      shipName: ship.name,
      allSunk: allSunk(board)
    };
  }

  // Accepts "D4", "d4", "D 4", "d-10" and similar. Returns { row, col } or null.
  function parseCoordinate(text) {
    if (typeof text !== 'string') return null;
    var match = /^\s*([a-jA-J])\s*-?\s*(10|[1-9])\s*$/.exec(text);
    if (!match) return null;
    return {
      row: ROW_LETTERS.indexOf(match[1].toUpperCase()),
      col: parseInt(match[2], 10) - 1
    };
  }

  function formatCoordinate(row, col) {
    return ROW_LETTERS[row] + (col + 1);
  }

  // ----- Whole-game flow -----

  // A new game: MacArthur's fleet is placed at random, the player's board is
  // empty and waiting for ship placement.
  function createGame(rng) {
    rng = rng || Math.random;
    var enemy = createBoard();
    placeFleetRandomly(enemy, rng);
    return {
      phase: 'placing',
      player: createBoard(),
      enemy: enemy,
      turn: null,
      firstTurn: null,
      winner: null
    };
  }

  // Locks both fleets in place and flips a coin for who shoots first.
  function startGame(game, rng) {
    if (game.phase !== 'placing') return { ok: false, reason: 'not-placing' };
    if (!isFleetComplete(game.player)) return { ok: false, reason: 'fleet-incomplete' };
    rng = rng || Math.random;
    game.player.locked = true;
    game.enemy.locked = true;
    game.firstTurn = rng() < 0.5 ? 'player' : 'computer';
    game.turn = game.firstTurn;
    game.phase = 'playing';
    return { ok: true, firstTurn: game.firstTurn };
  }

  function takeShot(game, shooter, row, col) {
    if (game.phase !== 'playing') return { result: 'not-playing' };
    if (game.turn !== shooter) return { result: 'not-your-turn' };
    var target = shooter === 'player' ? game.enemy : game.player;
    var outcome = fire(target, row, col);
    if (outcome.result === 'repeat' || outcome.result === 'invalid') return outcome;
    if (outcome.allSunk) {
      game.phase = 'over';
      game.winner = shooter;
      game.turn = null;
    } else {
      game.turn = shooter === 'player' ? 'computer' : 'player';
    }
    return outcome;
  }

  function playerFire(game, row, col) {
    return takeShot(game, 'player', row, col);
  }

  function computerFire(game, row, col) {
    return takeShot(game, 'computer', row, col);
  }

  // The announcement for a shot, worded for the person playing.
  function shotMessage(shooter, row, col, outcome) {
    var where = formatCoordinate(row, col);
    if (shooter === 'player') {
      if (outcome.result === 'miss') return where + ': Miss.';
      if (outcome.result === 'hit') return where + ': Hit! ' + outcome.shipName + '.';
      if (outcome.result === 'sunk') return where + ': Hit! You sank the ' + outcome.shipName + '!';
      if (outcome.result === 'repeat') return 'You already fired at ' + where + '. Pick another square.';
    } else {
      var prefix = COMPUTER_NAME + ' fires at ' + where + ': ';
      if (outcome.result === 'miss') return prefix + 'Miss.';
      if (outcome.result === 'hit') return prefix + 'Hit! Your ' + outcome.shipName + '.';
      if (outcome.result === 'sunk') return prefix + 'Hit! ' + COMPUTER_NAME + ' sank your ' + outcome.shipName + '!';
    }
    return '';
  }

  var api = {
    SIZE: SIZE,
    ROW_LETTERS: ROW_LETTERS,
    COMPUTER_NAME: COMPUTER_NAME,
    FLEET: FLEET,
    HORIZONTAL: HORIZONTAL,
    VERTICAL: VERTICAL,
    createRng: createRng,
    createBoard: createBoard,
    shipCells: shipCells,
    shipAt: shipAt,
    placementProblem: placementProblem,
    placeShip: placeShip,
    removeShip: removeShip,
    clearShips: clearShips,
    placeFleetRandomly: placeFleetRandomly,
    unplacedShips: unplacedShips,
    isFleetComplete: isFleetComplete,
    isSunk: isSunk,
    allSunk: allSunk,
    fire: fire,
    parseCoordinate: parseCoordinate,
    formatCoordinate: formatCoordinate,
    createGame: createGame,
    startGame: startGame,
    playerFire: playerFire,
    computerFire: computerFire,
    shotMessage: shotMessage
  };

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.Battleship = root.Battleship || {};
    root.Battleship.rules = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
