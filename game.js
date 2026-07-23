(() => {
  const canvas = document.querySelector('#game-canvas');
  if (!canvas) return;

  const context = canvas.getContext('2d');
  const scoreElement = document.querySelector('#game-score');
  const highScoreElement = document.querySelector('#game-high-score');
  const statusElement = document.querySelector('#game-status');
  const startButton = document.querySelector('#game-start');
  const pauseButton = document.querySelector('#game-pause');
  const restartButton = document.querySelector('#game-restart');
  const directionButtons = document.querySelectorAll('[data-direction]');
  const columns = 24;
  const rows = 18;
  const cellSize = 20;
  const tickLength = 140;
  const enemyCount = 2;
  const highScoreKey = 'jaechani-worm-high-score';
  const directions = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  };

  const state = {
    snake: [],
    direction: directions.right,
    nextDirection: directions.right,
    food: { x: 8, y: 8 },
    enemies: [],
    phase: 'idle',
    running: false,
    gameOver: false,
    elapsed: 0,
    score: 0,
    highScore: Number.parseInt(localStorage.getItem(highScoreKey) || '0', 10),
    startedAt: 0,
    lastTick: 0,
    nextBlastAt: 0,
    blastUntil: 0,
    nextSpawnAt: 0,
    spawned: 0,
    invulnerableUntil: 0,
    animationFrame: 0
  };

  highScoreElement.textContent = String(state.highScore);

  function resetState() {
    state.snake = [{ x: 12, y: 9 }, { x: 11, y: 9 }, { x: 10, y: 9 }];
    state.direction = directions.right;
    state.nextDirection = directions.right;
    state.food = randomFreeCell();
    state.enemies = [createEnemy(), createEnemy()];
    state.phase = 'idle';
    state.running = false;
    state.gameOver = false;
    state.elapsed = 0;
    state.score = 0;
    state.startedAt = 0;
    state.lastTick = 0;
    state.nextBlastAt = 0;
    state.blastUntil = 0;
    state.nextSpawnAt = 0;
    state.spawned = 0;
    state.invulnerableUntil = 0;
    updateScore();
    updateStatus('시작을 눌러주세요.');
    pauseButton.disabled = true;
    pauseButton.textContent = '일시정지';
    render();
  }

  function startGame() {
    if (state.running) return;
    if (state.gameOver || state.phase === 'idle') resetState();
    state.running = true;
    state.gameOver = false;
    state.phase = 'active';
    state.startedAt = performance.now();
    state.lastTick = state.startedAt;
    state.nextBlastAt = state.startedAt + 5000;
    pauseButton.disabled = false;
    pauseButton.textContent = '일시정지';
    updateStatus('게임 중');
    state.animationFrame = requestAnimationFrame(loop);
  }

  function pauseGame() {
    if (!state.running) return;
    state.running = false;
    state.phase = 'paused';
    cancelAnimationFrame(state.animationFrame);
    pauseButton.textContent = '계속하기';
    updateStatus('일시정지');
    render();
  }

  function restartGame() {
    cancelAnimationFrame(state.animationFrame);
    resetState();
    startGame();
  }

  function loop(now) {
    if (!state.running) return;
    state.elapsed = (now - state.startedAt) / 1000;
    state.score = Math.floor(state.elapsed);
    updateScore();
    updateEvents(now);
    if (now - state.lastTick >= tickLength) {
      state.lastTick = now;
      advance();
    }
    render();
    state.animationFrame = requestAnimationFrame(loop);
  }

  function advance() {
    state.direction = state.nextDirection;
    const head = state.snake[0];
    const nextHead = { x: head.x + state.direction.x, y: head.y + state.direction.y };
    if (isOutside(nextHead) || contains(state.snake, nextHead)) {
      endGame('벽 또는 몸통에 부딪혔습니다.');
      return;
    }
    state.snake.unshift(nextHead);
    if (sameCell(nextHead, state.food)) {
      state.score += 5;
      state.food = randomFreeCell();
    } else {
      state.snake.pop();
    }
    moveEnemies();
    if (state.phase === 'blasting' || contains(state.enemies, nextHead)) {
      hitPlayer('적 또는 폭발에 닿았습니다.');
    }
  }

  function updateEvents(now) {
    if (state.phase === 'active' && now >= state.nextBlastAt) {
      state.phase = 'blasting';
      state.enemies = [];
      state.blastUntil = now + 2000;
      state.nextSpawnAt = state.blastUntil + 2000;
      state.spawned = 0;
      updateStatus('적 2개 폭발!');
    } else if (state.phase === 'blasting' && now >= state.blastUntil) {
      state.phase = 'spawning';
      updateStatus('적 재생성 대기 중');
    } else if (state.phase === 'spawning' && state.spawned < enemyCount && now >= state.nextSpawnAt) {
      state.enemies.push(createEnemy());
      state.spawned += 1;
      state.nextSpawnAt += 2000;
      updateStatus(`적 재생성 ${state.spawned}/${enemyCount}`);
      if (state.spawned === enemyCount) {
        state.phase = 'active';
        state.nextBlastAt = now + 5000;
        updateStatus('게임 중');
      }
    }
  }

  function moveEnemies() {
    state.enemies = state.enemies.map((enemy) => {
      const options = Object.values(directions).filter((direction) => {
        const next = { x: enemy.x + direction.x, y: enemy.y + direction.y };
        return !isOutside(next) && !sameCell(next, state.snake[0]);
      });
      const direction = options[Math.floor(Math.random() * options.length)] || directions.right;
      return { x: enemy.x + direction.x, y: enemy.y + direction.y };
    });
  }

  function hitPlayer(message) {
    const now = performance.now();
    if (now < state.invulnerableUntil) return;
    state.invulnerableUntil = now + 2000;
    endGame(message);
  }

  function endGame(message) {
    state.running = false;
    state.gameOver = true;
    state.phase = 'game-over';
    cancelAnimationFrame(state.animationFrame);
    state.score = Math.max(state.score, Math.floor(state.elapsed));
    if (state.score > state.highScore) {
      state.highScore = state.score;
      localStorage.setItem(highScoreKey, String(state.highScore));
    }
    updateScore();
    updateStatus(`게임 오버 — ${message}`);
    pauseButton.disabled = true;
    render();
  }

  function setDirection(name) {
    const next = directions[name];
    if (!next || (next.x + state.direction.x === 0 && next.y + state.direction.y === 0)) return;
    state.nextDirection = next;
  }

  function createEnemy() {
    const cell = randomFreeCell();
    return { x: cell.x, y: cell.y };
  }

  function randomFreeCell() {
    let cell;
    let attempts = 0;
    do {
      cell = { x: Math.floor(Math.random() * columns), y: Math.floor(Math.random() * rows) };
      attempts += 1;
    } while (attempts < 200 && (contains(state.snake, cell) || contains(state.enemies, cell) || (state.food && sameCell(state.food, cell))));
    return cell;
  }

  function contains(cells, target) {
    return cells.some((cell) => sameCell(cell, target));
  }

  function sameCell(first, second) {
    return first && second && first.x === second.x && first.y === second.y;
  }

  function isOutside(cell) {
    return cell.x < 0 || cell.y < 0 || cell.x >= columns || cell.y >= rows;
  }

  function updateScore() {
    scoreElement.textContent = String(state.score);
    highScoreElement.textContent = String(Math.max(state.highScore, state.score));
  }

  function updateStatus(message) {
    statusElement.textContent = message;
  }

  function render() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#172236';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = 'rgba(148, 163, 184, .12)';
    for (let x = 0; x <= columns; x += 1) {
      context.beginPath(); context.moveTo(x * cellSize, 0); context.lineTo(x * cellSize, canvas.height); context.stroke();
    }
    for (let y = 0; y <= rows; y += 1) {
      context.beginPath(); context.moveTo(0, y * cellSize); context.lineTo(canvas.width, y * cellSize); context.stroke();
    }
    drawCell(state.food, '#facc15', true);
    state.enemies.forEach((enemy) => drawCell(enemy, '#fb7185', true));
    state.snake.forEach((segment, index) => drawCell(segment, index === 0 ? '#38bdf8' : '#22c55e', false));
    if (state.phase === 'blasting') {
      context.fillStyle = 'rgba(249, 115, 22, .35)';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#fed7aa';
      context.font = '700 24px system-ui';
      context.textAlign = 'center';
      context.fillText('폭발!', canvas.width / 2, canvas.height / 2);
    }
    if (state.gameOver) {
      context.fillStyle = 'rgba(2, 6, 23, .65)';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#fff';
      context.font = '700 24px system-ui';
      context.textAlign = 'center';
      context.fillText('GAME OVER', canvas.width / 2, canvas.height / 2);
    }
  }

  function drawCell(cell, color, round) {
    if (!cell) return;
    context.fillStyle = color;
    if (round) {
      context.beginPath();
      context.arc(cell.x * cellSize + cellSize / 2, cell.y * cellSize + cellSize / 2, cellSize * .35, 0, Math.PI * 2);
      context.fill();
    } else {
      context.fillRect(cell.x * cellSize + 2, cell.y * cellSize + 2, cellSize - 4, cellSize - 4);
    }
  }

  document.addEventListener('keydown', (event) => {
    const keys = { ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down', ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right' };
    const direction = keys[event.key];
    if (direction) {
      event.preventDefault();
      setDirection(direction);
    }
    if (event.key === 'p') pauseGame();
  });
  directionButtons.forEach((button) => button.addEventListener('click', () => setDirection(button.dataset.direction)));
  startButton.addEventListener('click', startGame);
  pauseButton.addEventListener('click', () => (state.running ? pauseGame() : startGame()));
  restartButton.addEventListener('click', restartGame);
  resetState();
})();
