/*
 * Everything on screen: draws the boards, panels and messages, and turns
 * clicks, taps and key presses into calls to the controller in main.js.
 * It never decides a rule; it only asks js/rules.js.
 */
(function (root) {
  'use strict';

  var rules = root.Battleship.rules;
  var SIZE = rules.SIZE;
  var els = {};
  var cells = { player: [], enemy: [] };
  var focusPos = { player: { row: 0, col: 0 }, enemy: { row: 0, col: 0 } };
  var previewAt = null;
  var handlers = null;
  var current = null;

  function byId(id) { return document.getElementById(id); }

  // Rank insignia for the picker: one chevron, captain's bars, three stars.
  var STAR = 'M0,-9 L2.6,-3.2 L8.6,-2.8 L4,1.2 L5.4,7.4 L0,4 L-5.4,7.4 L-4,1.2 L-8.6,-2.8 L-2.6,-3.2Z';
  var INSIGNIA = {
    rookie: '<path d="M8 15 L24 27 L40 15" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/>',
    officer: '<rect x="13" y="8" width="8" height="32" rx="1.5" fill="currentColor"/>' +
      '<rect x="27" y="8" width="8" height="32" rx="1.5" fill="currentColor"/>',
    general: '<path transform="translate(24 14)" d="' + STAR + '" fill="currentColor"/>' +
      '<path transform="translate(12 33)" d="' + STAR + '" fill="currentColor"/>' +
      '<path transform="translate(36 33)" d="' + STAR + '" fill="currentColor"/>'
  };

  function buildBoard(container, which, caption) {
    var table = document.createElement('table');
    table.className = 'board';
    var cap = document.createElement('caption');
    cap.className = 'sr-only';
    cap.textContent = caption;
    table.appendChild(cap);

    var thead = document.createElement('thead');
    var headRow = document.createElement('tr');
    headRow.appendChild(document.createElement('td'));
    for (var c = 0; c < SIZE; c++) {
      var th = document.createElement('th');
      th.scope = 'col';
      th.textContent = String(c + 1);
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = document.createElement('tbody');
    for (var r = 0; r < SIZE; r++) {
      var tr = document.createElement('tr');
      var rowHead = document.createElement('th');
      rowHead.scope = 'row';
      rowHead.textContent = rules.ROW_LETTERS[r];
      tr.appendChild(rowHead);
      cells[which][r] = [];
      for (var col = 0; col < SIZE; col++) {
        var td = document.createElement('td');
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cell';
        btn.dataset.row = r;
        btn.dataset.col = col;
        btn.tabIndex = r === 0 && col === 0 ? 0 : -1;
        td.appendChild(btn);
        tr.appendChild(td);
        cells[which][r][col] = btn;
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    container.appendChild(table);

    function cellFrom(target) {
      var btn = target.closest && target.closest('button.cell');
      return btn ? { row: Number(btn.dataset.row), col: Number(btn.dataset.col) } : null;
    }

    table.addEventListener('click', function (e) {
      var pos = cellFrom(e.target);
      if (pos) handlers.cellActivated(which, pos.row, pos.col);
    });

    table.addEventListener('keydown', function (e) {
      var pos = cellFrom(e.target);
      if (!pos) return;
      var moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
      var move = moves[e.key];
      if (e.key === 'Home') move = [0, -pos.col];
      if (e.key === 'End') move = [0, SIZE - 1 - pos.col];
      if (!move) return;
      e.preventDefault();
      var row = Math.min(SIZE - 1, Math.max(0, pos.row + move[0]));
      var col = Math.min(SIZE - 1, Math.max(0, pos.col + move[1]));
      moveFocus(which, row, col);
    });

    table.addEventListener('focusin', function (e) {
      var pos = cellFrom(e.target);
      if (!pos) return;
      setRoving(which, pos.row, pos.col);
      if (which === 'player') { previewAt = pos; renderPreview(); }
    });

    if (which === 'player') {
      table.addEventListener('mouseover', function (e) {
        var pos = cellFrom(e.target);
        if (pos) { previewAt = pos; renderPreview(); }
      });
      table.addEventListener('mouseleave', function () {
        var active = document.activeElement;
        previewAt = table.contains(active) ? cellFrom(active) : null;
        renderPreview();
      });
      table.addEventListener('focusout', function (e) {
        if (!table.contains(e.relatedTarget)) { previewAt = null; renderPreview(); }
      });
    }
  }

  function setRoving(which, row, col) {
    var old = focusPos[which];
    cells[which][old.row][old.col].tabIndex = -1;
    cells[which][row][col].tabIndex = 0;
    focusPos[which] = { row: row, col: col };
  }

  function moveFocus(which, row, col) {
    setRoving(which, row, col);
    cells[which][row][col].focus();
  }

  function init(h) {
    handlers = h;
    ['player-name', 'player-heading', 'vs-line', 'rank-badge', 'new-game', 'rank-panel', 'rank-heading', 'rank-form', 'rank-choices', 'change-rank',
      'change-rank-inline', 'tally', 'announcer', 'prompt', 'last-player', 'last-computer', 'placement', 'ship-list',
      'rotate', 'randomize', 'clear', 'start', 'fire-panel', 'shot-form', 'shot-input', 'fire',
      'end-panel', 'end-panel-heading', 'reveal-inline', 'play-again-inline', 'player-board',
      'enemy-board', 'player-fleet', 'enemy-fleet', 'log', 'end-dialog', 'end-title', 'end-last', 'end-text', 'end-rank',
      'end-tally', 'reveal', 'play-again'].forEach(function (id) {
      els[id] = byId(id);
    });

    buildBoard(els['player-board'], 'player', 'Your fleet. Rows A to J, columns 1 to 10.');
    buildBoard(els['enemy-board'], 'enemy', 'MacArthur\'s waters. Rows A to J, columns 1 to 10.');

    // One radio button per rank: arrow keys move between them, the label makes
    // the whole card clickable, and Enter (or Start battle) confirms.
    h.ranks.forEach(function (rank) {
      var label = document.createElement('label');
      label.className = 'rank-option';
      var input = document.createElement('input');
      input.type = 'radio';
      input.name = 'rank';
      input.value = rank.id;
      input.id = 'rank-' + rank.id;
      input.setAttribute('aria-describedby', 'rank-desc-' + rank.id);
      var name = document.createElement('span');
      name.className = 'rank-name';
      name.textContent = rank.label;
      var desc = document.createElement('span');
      desc.className = 'rank-desc';
      desc.id = 'rank-desc-' + rank.id;
      desc.textContent = rank.description;
      var badge = document.createElement('span');
      badge.className = 'rank-insignia';
      badge.setAttribute('aria-hidden', 'true');
      badge.innerHTML = '<svg viewBox="0 0 48 48" focusable="false">' + (INSIGNIA[rank.id] || '') + '</svg>';
      label.appendChild(input);
      label.appendChild(badge);
      label.appendChild(name);
      label.appendChild(desc);
      els['rank-choices'].appendChild(label);
    });
    function chosenRank() {
      var checked = els['rank-form'].querySelector('input[name="rank"]:checked');
      return checked ? checked.value : null;
    }
    els['rank-form'].addEventListener('submit', function (e) {
      e.preventDefault();
      handlers.chooseRank(chosenRank(), els['player-name'].value);
    });
    els['rank-choices'].addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      handlers.chooseRank(chosenRank(), els['player-name'].value);
    });
    els['new-game'].addEventListener('click', function () { handlers.newGame(); });
    els['change-rank'].addEventListener('click', function () { handlers.changeRank(); });
    els['change-rank-inline'].addEventListener('click', function () { handlers.changeRank(); });

    els.rotate.addEventListener('click', function () { handlers.rotate(); });
    els.randomize.addEventListener('click', function () { handlers.randomize(); });
    els.clear.addEventListener('click', function () { handlers.clear(); });
    els.start.addEventListener('click', function () { handlers.start(); });
    els['shot-form'].addEventListener('submit', function (e) {
      e.preventDefault();
      handlers.fireText(els['shot-input'].value);
    });
    els.reveal.addEventListener('click', function () { handlers.reveal(); });
    els['reveal-inline'].addEventListener('click', function () { handlers.reveal(); });
    els['play-again'].addEventListener('click', function () { handlers.playAgain(); });
    els['play-again-inline'].addEventListener('click', function () { handlers.playAgain(); });

    els['ship-list'].addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-ship]');
      if (btn) handlers.selectShip(btn.dataset.ship);
    });

    // Shift rotates when pressed and released on its own, so Shift+Tab doesn't rotate.
    var shiftAlone = false;
    function placingKeys(e) {
      return current && !current.picking && current.game.phase === 'placing' &&
        !(e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) && !(e.ctrlKey || e.metaKey || e.altKey);
    }
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Shift') shiftAlone = false;
      else if (!e.repeat) shiftAlone = true;
      if (!placingKeys(e) || e.repeat) return;
      if (e.key === 'r' || e.key === 'R') handlers.rotate();
    });
    document.addEventListener('keyup', function (e) {
      if (e.key !== 'Shift' || !shiftAlone) return;
      shiftAlone = false;
      if (placingKeys(e)) handlers.rotate();
    });
  }

  function clearShotInput() { els['shot-input'].value = ''; }
  function focusShotInput() { els['shot-input'].focus(); }

  // Screen readers re-announce even when the same text repeats.
  function announce(text) {
    els.announcer.textContent = '';
    setTimeout(function () { els.announcer.textContent = text; }, 30);
  }

  // Only redraw a peg when it changes, so pegs don't flash on every turn.
  function setPeg(btn, shot) {
    var value = shot || '';
    if (btn.dataset.shot === value) return;
    btn.dataset.shot = value;
    btn.innerHTML = shot ? '<span class="peg ' + shot + '" aria-hidden="true"></span>' : '';
  }

  // Which part of a ship this square is, so the CSS can draw one long hull:
  // a pointed bow at the first square and a squared-off stern at the last.
  function hullClasses(ship, r, c) {
    var cells = ship.cells;
    var across = cells.length > 1 && cells[0].row === cells[1].row;
    var list = [across ? 'hull-h' : 'hull-v'];
    if (cells[0].row === r && cells[0].col === c) list.push('bow');
    var last = cells[cells.length - 1];
    if (last.row === r && last.col === c) list.push('stern');
    return list;
  }

  function shipCellLabel(ship, shot) {
    var label = 'your ' + ship.name;
    if (shot === 'hit') label += rules.isSunk(ship) ? ', sunk' : ', hit';
    return label;
  }

  function renderPlayerCell(state, r, c) {
    var board = state.game.player;
    var btn = cells.player[r][c];
    var ship = rules.shipAt(board, r, c);
    var shot = board.shots[r][c];
    var where = rules.formatCoordinate(r, c);
    var classes = ['cell'];
    var label;
    if (ship) {
      classes.push(shot === 'hit' && rules.isSunk(ship) ? 'sunk' : 'ship');
      classes = classes.concat(hullClasses(ship, r, c));
      label = shipCellLabel(ship, shot);
    } else {
      label = shot === 'miss' ? 'MacArthur missed' : 'water';
    }
    btn.className = classes.join(' ');
    btn.setAttribute('aria-label', where + ', ' + label);
    btn.setAttribute('aria-disabled', state.game.phase === 'placing' ? 'false' : 'true');
    setPeg(btn, shot);
  }

  function renderEnemyCell(state, r, c) {
    var board = state.game.enemy;
    var btn = cells.enemy[r][c];
    var shot = board.shots[r][c];
    var where = rules.formatCoordinate(r, c);
    var classes = ['cell'];
    var label = 'not fired at';
    var ship = rules.shipAt(board, r, c);
    if (shot === 'hit') {
      if (rules.isSunk(ship)) {
        classes.push('sunk');
        classes = classes.concat(hullClasses(ship, r, c));
        label = 'hit, ' + ship.name + ', sunk';
      }
      else {
        label = 'hit, ' + ship.name;
        if (state.revealed) classes = classes.concat(['revealed'], hullClasses(ship, r, c));
      }
    } else if (shot === 'miss') {
      label = 'miss';
    } else if (state.revealed && ship) {
      classes.push('revealed');
      classes = classes.concat(hullClasses(ship, r, c));
      label = 'MacArthur\'s ' + ship.name + ', not found';
    }
    var canFire = state.game.phase === 'playing' && state.game.turn === 'player' && !shot;
    btn.className = classes.join(' ');
    btn.setAttribute('aria-label', where + ', ' + label);
    btn.setAttribute('aria-disabled', canFire ? 'false' : 'true');
    setPeg(btn, shot);
  }

  function renderPreview() {
    if (!current) return;
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        cells.player[r][c].classList.remove('preview-ok', 'preview-bad');
      }
    }
    if (current.game.phase !== 'placing' || !current.selected || !previewAt) return;
    var size = rules.FLEET.filter(function (s) { return s.name === current.selected; })[0].size;
    var ok = !rules.placementProblem(current.game.player, current.selected,
      previewAt.row, previewAt.col, current.orientation);
    rules.shipCells(previewAt.row, previewAt.col, size, current.orientation).forEach(function (p) {
      if (p.row < SIZE && p.col < SIZE) {
        cells.player[p.row][p.col].classList.add(ok ? 'preview-ok' : 'preview-bad');
      }
    });
  }

  function renderShipList(state) {
    var placed = {};
    state.game.player.ships.forEach(function (s) { placed[s.name] = true; });
    var active = document.activeElement;
    var focusedShip = active && els['ship-list'].contains(active) ? active.dataset.ship : null;
    els['ship-list'].innerHTML = '';
    rules.FLEET.forEach(function (entry) {
      var li = document.createElement('li');
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.ship = entry.name;
      btn.className = placed[entry.name] ? 'placed' : '';
      btn.setAttribute('aria-pressed', state.selected === entry.name ? 'true' : 'false');
      btn.textContent = entry.name + ' (' + entry.size + ')' + (placed[entry.name] ? ' \u2713' : '');
      btn.setAttribute('aria-label', entry.name + ', ' + entry.size + ' squares, ' +
        (placed[entry.name] ? 'placed' : 'not placed'));
      li.appendChild(btn);
      els['ship-list'].appendChild(li);
      if (focusedShip === entry.name) btn.focus();
    });
  }

  function renderFleetStatus(list, board, hideAfloatDetail) {
    list.innerHTML = '';
    rules.FLEET.forEach(function (entry) {
      var ship = board.ships.filter(function (s) { return s.name === entry.name; })[0];
      var sunk = ship && rules.isSunk(ship);
      var li = document.createElement('li');
      li.className = sunk ? 'sunk' : '';
      li.textContent = entry.name + ' (' + entry.size + ')';
      li.setAttribute('aria-label', entry.name + (sunk ? ', sunk' : hideAfloatDetail ? ', afloat' :
        ship ? ', afloat' : ', not placed'));
      list.appendChild(li);
    });
  }

  function renderLog(state) {
    els.log.innerHTML = '';
    for (var i = state.log.length - 1; i >= 0; i--) {
      var li = document.createElement('li');
      li.className = state.log[i].shooter;
      li.textContent = state.log[i].text;
      els.log.appendChild(li);
    }
  }

  function render(state) {
    current = state;
    var game = state.game;
    var picking = state.picking;
    document.body.className = 'phase-' + (picking ? 'choosing' : game.phase);

    var name = state.playerName || 'You';
    var whose = rules.possessive(name);
    els['player-heading'].textContent = whose + ' fleet';
    els['player-fleet'].setAttribute('aria-label', whose + ' ships');
    els['vs-line'].textContent = state.playerName ? state.playerName + ' vs. MacArthur' : 'vs. MacArthur';

    var rankLabel = state.rankLabel;
    els['rank-badge'].textContent = 'Rank: ' + rankLabel;
    els['rank-badge'].setAttribute('aria-label', 'MacArthur\'s rank: ' + rankLabel);
    els['rank-badge'].hidden = picking;
    els['new-game'].hidden = picking;
    els['rank-panel'].hidden = !picking;
    els.tally.textContent = 'Wins ' + state.tally.wins + ' \u00b7 Losses ' + state.tally.losses;
    els.prompt.textContent = state.prompt;
    els['last-player'].textContent = state.lastPlayer;
    els['last-computer'].textContent = state.lastComputer;

    els.placement.hidden = picking || game.phase !== 'placing';
    els['fire-panel'].hidden = picking || game.phase !== 'playing';
    els['end-panel'].hidden = picking || game.phase !== 'over';

    if (game.phase === 'placing') {
      renderShipList(state);
      var dir = state.orientation === rules.HORIZONTAL ? 'horizontal' : 'vertical';
      els.rotate.textContent = 'Rotate (now ' + dir + ')';
      els.start.disabled = !rules.isFleetComplete(game.player);
    }

    var playerTurn = game.phase === 'playing' && game.turn === 'player';
    els['shot-input'].disabled = !playerTurn;
    els.fire.disabled = !playerTurn;

    if (game.phase === 'over') {
      var lost = game.winner === 'computer';
      els['end-panel-heading'].textContent = lost ? 'MacArthur wins this round.' :
        (state.playerName ? state.playerName + ' wins!' : 'You win!');
      els['reveal-inline'].hidden = !lost || state.revealed;
    }

    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        renderPlayerCell(state, r, c);
        renderEnemyCell(state, r, c);
      }
    }
    renderPreview();
    renderFleetStatus(els['player-fleet'], game.player, false);
    renderFleetStatus(els['enemy-fleet'], game.enemy, true);
    renderLog(state);
  }

  function showEndScreen(state, info) {
    var lost = state.game.winner === 'computer';
    els['end-title'].textContent = lost ? 'MacArthur wins' :
      (state.playerName ? 'Victory, ' + state.playerName + '!' : 'Victory!');
    els['end-rank'].textContent = (lost ? 'Beaten by MacArthur at the rank of ' : 'You beat MacArthur at the rank of ') +
      state.rankLabel + '.';
    els['end-last'].textContent = 'Final shot: ' + info.lastShot;
    els['end-text'].textContent = lost
      ? 'MacArthur sank your entire fleet.'
      : 'You sank MacArthur\'s entire fleet in ' + info.playerShots + ' shots.';
    els['end-tally'].textContent = 'Wins ' + state.tally.wins + ' \u00b7 Losses ' + state.tally.losses;
    els.reveal.hidden = !lost;
    var dialog = els['end-dialog'];
    dialog.dataset.outcome = lost ? 'defeat' : 'victory';
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
    (lost ? els.reveal : els['play-again']).focus();
  }

  function hideEndScreen() {
    var dialog = els['end-dialog'];
    if (dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  }

  // Shows the start screen with the saved name filled in and `rankId`
  // selected. Focus goes to the name box the first time, then to the rank.
  function showPicker(rankId, playerName) {
    els['player-name'].value = playerName || '';
    var input = byId('rank-' + rankId);
    if (input) input.checked = true;
    if (!playerName) els['player-name'].focus();
    else if (input) input.focus();
  }

  function focusFirstEnemyCell() {
    var p = focusPos.enemy;
    cells.enemy[p.row][p.col].focus();
  }

  function focusElement(id) {
    if (els[id] && !els[id].hidden) els[id].focus();
  }

  root.Battleship = root.Battleship || {};
  root.Battleship.ui = {
    init: init,
    render: render,
    announce: announce,
    showEndScreen: showEndScreen,
    hideEndScreen: hideEndScreen,
    showPicker: showPicker,
    clearShotInput: clearShotInput,
    focusShotInput: focusShotInput,
    focusFirstEnemyCell: focusFirstEnemyCell,
    focusElement: focusElement
  };
})(window);
