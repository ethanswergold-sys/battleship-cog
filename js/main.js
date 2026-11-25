/*
 * Starts the game and connects the rules (js/rules.js) and MacArthur
 * (js/opponents.js, at the rank chosen in the rank picker) to the screen (js/ui.js).
 * Every battle begins at the picker; the rank is fixed until the battle ends
 * or the player presses New game.
 * Optional address-bar settings for testing: ?seed=123 makes every random
 * choice repeatable, ?fast makes MacArthur fire without the usual pause.
 */
(function (root) {
  'use strict';

  var rules = root.Battleship.rules;
  var opponents = root.Battleship.opponents;
  var ui = root.Battleship.ui;
  var NAME = rules.COMPUTER_NAME;
  var TALLY_KEY = 'battleship-cog-tally';

  var params = new URLSearchParams(root.location.search);
  var rng = params.has('seed') ? rules.createRng(Number(params.get('seed'))) : Math.random;
  var COMPUTER_DELAY_MS = params.has('fast') ? 60 : 900;

  var state = {
    game: null,
    picking: true,
    rank: opponents.DEFAULT_RANK,
    rankLabel: opponents.find(opponents.DEFAULT_RANK).label,
    opponent: null,
    computerShots: [],
    orientation: rules.HORIZONTAL,
    selected: null,
    revealed: false,
    log: [],
    prompt: '',
    lastPlayer: '',
    lastComputer: '',
    typedShot: false,
    tally: loadTally()
  };
  var computerTimer = null;

  // The tally lives in sessionStorage: it survives Play Again and page
  // refreshes, and starts over at 0-0 when the window is closed and reopened.
  function loadTally() {
    try {
      var saved = JSON.parse(root.sessionStorage.getItem(TALLY_KEY));
      if (saved && typeof saved.wins === 'number' && typeof saved.losses === 'number') return saved;
    } catch (e) { /* storage unavailable: keep the tally in memory only */ }
    return { wins: 0, losses: 0 };
  }

  function saveTally() {
    try { root.sessionStorage.setItem(TALLY_KEY, JSON.stringify(state.tally)); } catch (e) { /* ignore */ }
  }

  function say(prompt, announcement) {
    state.prompt = prompt;
    ui.announce(announcement || prompt);
  }

  function render() { ui.render(state); }

  function firstUnplaced() {
    var left = rules.unplacedShips(state.game.player);
    return left.length ? left[0].name : null;
  }

  function placingPrompt() {
    if (!state.selected) return 'All ships placed. Press Start game, or click a ship to move it.';
    var size = rules.FLEET.filter(function (s) { return s.name === state.selected; })[0].size;
    var dir = state.orientation === rules.HORIZONTAL ? 'horizontally' : 'vertically';
    return 'Place your ' + state.selected + ' (' + size + ' squares, ' + dir + ').';
  }

  // Wipes both boards and MacArthur's memory: a brand-new battle at state.rank.
  function resetBattle() {
    clearTimeout(computerTimer);
    ui.hideEndScreen();
    ui.clearShotInput();
    var battle = opponents.newBattle(state.rank, rng);
    state.rank = battle.rank;
    state.rankLabel = opponents.find(battle.rank).label;
    state.opponent = battle.opponent;
    state.computerShots = battle.computerShots;
    state.game = battle.game;
    state.orientation = rules.HORIZONTAL;
    state.selected = firstUnplaced();
    state.revealed = false;
    state.log = [];
    state.lastPlayer = '';
    state.lastComputer = '';
    state.typedShot = false;
  }

  function newGame(intro) {
    resetBattle();
    say(placingPrompt(), (intro || 'New game.') + ' ' + placingPrompt());
    render();
  }

  // ----- Choosing a rank -----

  // New game and Change rank both come here: the battle is reset at once, so
  // nothing from the previous game carries over, and the Officer is preselected.
  function showPicker() {
    resetBattle();
    state.picking = true;
    say('Choose your opponent.', 'Choose your opponent: Rookie, Officer or General. ' +
      'Use the arrow keys to pick, then press Enter.');
    render();
    ui.showPicker(opponents.DEFAULT_RANK);
  }

  function chooseRank(id) {
    if (!state.picking || !opponents.find(id)) return;
    state.rank = id;
    state.picking = false;
    newGame(NAME + ' plays at the rank of ' + opponents.find(id).label + '.');
    ui.focusElement('randomize');
  }

  // ----- Placing ships -----

  function selectShip(name) {
    if (state.game.phase !== 'placing') return;
    if (state.game.player.ships.some(function (s) { return s.name === name; })) {
      var ship = state.game.player.ships.filter(function (s) { return s.name === name; })[0];
      state.orientation = ship.orientation;
      rules.removeShip(state.game.player, name);
      state.selected = name;
      say('Picked up your ' + name + '. ' + placingPrompt());
    } else {
      state.selected = name;
      say(placingPrompt());
    }
    render();
  }

  function describeSpan(ship) {
    var a = ship.cells[0];
    var b = ship.cells[ship.cells.length - 1];
    return rules.formatCoordinate(a.row, a.col) + ' to ' + rules.formatCoordinate(b.row, b.col);
  }

  function placeAt(row, col) {
    var board = state.game.player;
    var existing = rules.shipAt(board, row, col);
    if (existing) {
      selectShip(existing.name);
      return;
    }
    if (!state.selected) {
      say(placingPrompt());
      render();
      return;
    }
    var name = state.selected;
    var result = rules.placeShip(board, name, row, col, state.orientation);
    if (!result.ok) {
      var why = result.reason === 'off-board'
        ? 'The ' + name + ' would hang off the board there.'
        : 'The ' + name + ' would overlap another ship there.';
      say(why + ' Try another square or rotate it.');
      render();
      return;
    }
    var placed = board.ships.filter(function (s) { return s.name === name; })[0];
    state.selected = firstUnplaced();
    say(placingPrompt(), name + ' placed at ' + describeSpan(placed) + '. ' + placingPrompt());
    render();
  }

  function rotate() {
    if (state.game.phase !== 'placing') return;
    state.orientation = state.orientation === rules.HORIZONTAL ? rules.VERTICAL : rules.HORIZONTAL;
    say(placingPrompt(), 'Rotated: ' + (state.orientation === rules.HORIZONTAL ? 'horizontal.' : 'vertical.'));
    render();
  }

  function randomize() {
    if (state.game.phase !== 'placing') return;
    rules.placeFleetRandomly(state.game.player, rng);
    state.selected = null;
    say(placingPrompt(), 'Fleet placed at random. ' + placingPrompt());
    render();
  }

  function clearBoard() {
    if (state.game.phase !== 'placing') return;
    rules.clearShips(state.game.player);
    state.selected = firstUnplaced();
    say(placingPrompt(), 'Board cleared. ' + placingPrompt());
    render();
  }

  function start() {
    var result = rules.startGame(state.game, rng);
    if (!result.ok) {
      say('Place all five ships before starting.');
      render();
      return;
    }
    state.selected = null;
    if (result.firstTurn === 'player') {
      say('Your turn: call your shot.', 'Coin flip: you go first. Call your shot.');
      state.lastPlayer = 'Coin flip: you go first.';
      render();
      ui.focusShotInput();
    } else {
      say(NAME + ' is aiming\u2026', 'Coin flip: ' + NAME + ' goes first.');
      state.lastPlayer = 'Coin flip: ' + NAME + ' goes first.';
      render();
      scheduleComputerTurn();
    }
  }

  // ----- Shooting -----

  function addLog(shooter, text) {
    state.log.push({ shooter: shooter, text: text });
  }

  function playerShots() {
    return state.log.filter(function (e) { return e.shooter === 'player'; }).length;
  }

  function fireAt(row, col) {
    var game = state.game;
    if (game.phase !== 'playing') return;
    if (game.turn !== 'player') {
      ui.announce('Wait for ' + NAME + '\u2019s shot.');
      return;
    }
    var outcome = rules.playerFire(game, row, col);
    var text = rules.shotMessage('player', row, col, outcome);
    if (outcome.result === 'repeat') {
      say(text);
      render();
      return;
    }
    ui.clearShotInput();
    state.lastPlayer = 'You: ' + text;
    state.lastComputer = '';
    addLog('player', 'You: ' + text);
    if (game.phase === 'over') {
      endGame(text);
      return;
    }
    say(NAME + ' is aiming\u2026', text);
    render();
    scheduleComputerTurn();
  }

  function fireText(text) {
    if (state.game.phase !== 'playing') return;
    var pos = rules.parseCoordinate(text);
    if (!pos) {
      var shown = String(text).trim();
      say((shown ? '\u201c' + shown + '\u201d isn\u2019t a square. ' : '') +
        'Type a letter A\u2013J and a number 1\u201310, like D4.');
      render();
      ui.focusShotInput();
      return;
    }
    state.typedShot = true;
    fireAt(pos.row, pos.col);
  }

  function scheduleComputerTurn() {
    clearTimeout(computerTimer);
    computerTimer = setTimeout(computerTurn, COMPUTER_DELAY_MS);
  }

  function computerTurn() {
    var game = state.game;
    if (game.phase !== 'playing' || game.turn !== 'computer') return;
    var shot = state.opponent.chooseShot();
    var outcome = rules.computerFire(game, shot.row, shot.col);
    state.opponent.recordResult(shot.row, shot.col, outcome);
    state.computerShots.push({ row: shot.row, col: shot.col, outcome: outcome });
    var text = rules.shotMessage('computer', shot.row, shot.col, outcome);
    state.lastComputer = text;
    addLog('computer', text);
    if (game.phase === 'over') {
      endGame(text);
      return;
    }
    say('Your turn: call your shot.', text + ' Your turn.');
    render();
    if (state.typedShot) ui.focusShotInput();
  }

  // ----- End of game -----

  function endGame(lastText) {
    var won = state.game.winner === 'player';
    if (won) state.tally.wins++; else state.tally.losses++;
    saveTally();
    var headline = won ? 'You win! You sank MacArthur\u2019s entire fleet.' : 'MacArthur wins. Your fleet has been sunk.';
    say(headline, lastText + ' ' + headline);
    render();
    ui.showEndScreen(state, { playerShots: playerShots(), lastShot: lastText });
  }

  function reveal() {
    if (state.game.phase !== 'over' || state.game.winner !== 'computer') return;
    state.revealed = true;
    ui.hideEndScreen();
    say('MacArthur\u2019s remaining ships are outlined on his board.',
      'Revealed. MacArthur\u2019s remaining ships are outlined on his board.');
    render();
    ui.focusElement('play-again-inline');
  }

  function playAgain() {
    newGame('New game against ' + NAME + ' at the rank of ' + state.rankLabel + '.');
    ui.focusElement('randomize');
  }

  ui.init({
    ranks: opponents.list(),
    chooseRank: chooseRank,
    newGame: showPicker,
    changeRank: showPicker,
    cellActivated: function (which, row, col) {
      if (state.picking) return;
      if (which === 'player' && state.game.phase === 'placing') placeAt(row, col);
      else if (which === 'enemy') { state.typedShot = false; fireAt(row, col); }
    },
    selectShip: selectShip,
    rotate: rotate,
    randomize: randomize,
    clear: clearBoard,
    start: start,
    fireText: fireText,
    reveal: reveal,
    playAgain: playAgain
  });

  showPicker();
})(window);
