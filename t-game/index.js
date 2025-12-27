class SoundManager {
  constructor() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.enabled = true;
    this.bgmOscillators = [];
    this.bgmGain = null;
  }

  startBGM() {
    if (!this.enabled || this.bgmOscillators.length > 0) return;

    // Create a deep, dark ambient drone
    const frequencies = [55, 110.5, 109.5]; // Low Frequencies with slight detune
    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.setValueAtTime(0.05, this.ctx.currentTime); // Low volume
    this.bgmGain.connect(this.ctx.destination);

    frequencies.forEach(freq => {
      const osc = this.ctx.createOscillator();
      osc.frequency.value = freq;
      osc.type = 'sawtooth'; // Sawtooth gives a "tech" feel

      // Filter to make it less harsh, more "underwater/ambient"
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 200;

      osc.connect(filter);
      filter.connect(this.bgmGain);
      osc.start();
      this.bgmOscillators.push(osc);
    });

    // Add a slow rhythmic pulse (LFO) on the volume
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.2; // Very slow pulse (0.2 Hz)
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain);
    lfoGain.connect(this.bgmGain.gain);
    lfo.start();
    this.bgmOscillators.push(lfo);
  }

  stopBGM() {
    this.bgmOscillators.forEach(osc => osc.stop());
    this.bgmOscillators = [];
  }

  playTone(freq, type, duration, vol = 0.1) {
    if (!this.enabled) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.frequency.value = freq;
    osc.type = type;
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playMove() {
    this.playTone(200, 'sine', 0.1, 0.05);
  }

  playItem() {
    this.playTone(600, 'square', 0.1, 0.1);
    setTimeout(() => this.playTone(800, 'square', 0.2, 0.1), 100);
  }

  playDamage() {
    this.playTone(150, 'sawtooth', 0.3, 0.2);
    this.playTone(100, 'sawtooth', 0.3, 0.2);
  }

  playWin() {
    [440, 554, 659, 880].forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 'triangle', 0.4, 0.2), i * 150);
    });
  }

  playStart() {
    this.playTone(300, 'sine', 0.5, 0.2);
  }

  playRepair() {
    this.playTone(400, 'sine', 0.2, 0.1);
    setTimeout(() => this.playTone(600, 'sine', 0.4, 0.1), 150);
  }
}

class Game {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.level = 1;
    this.state = 'WAITING'; // WAITING, PLAYING, GAMEOVER
    this.enemyInterval = null;
    this.sound = new SoundManager(); // Initialize Sound

    // Initial simplified state for background render before start
    this.reset(true);

    // Key Bindings
    document.addEventListener('keydown', (e) => {
      if (this.state !== 'PLAYING') return;
      if (['ArrowUp', 'w', 'W'].includes(e.key)) this.movePlayer('up');
      if (['ArrowDown', 's', 'S'].includes(e.key)) this.movePlayer('down');
      if (['ArrowLeft', 'a', 'A'].includes(e.key)) this.movePlayer('left');
      if (['ArrowRight', 'd', 'D'].includes(e.key)) this.movePlayer('right');
    });
  }

  startGame() {
    // Resume AudioContext if it was suspended (browser policy)
    if (this.sound.ctx.state === 'suspended') {
      this.sound.ctx.resume();
    }

    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('game-container').classList.remove('blur-bg');

    this.sound.playStart();
    this.sound.startBGM(); // Start Ambience

    this.level = 1;
    this.score = 0;
    this.reset();
    this.state = 'PLAYING';

    this.log("CONNECTION ESTABLISHED.", 'system');
    this.log("WARNING: P.A.T.R.O.L. Bots are active in real-time.", 'warning');

    // Start Enemy AI Loop (Real-time movement)
    this.startEnemyAI();
  }

  startEnemyAI() {
    if (this.enemyInterval) clearInterval(this.enemyInterval);

    // Enemies move every 800ms
    this.enemyInterval = setInterval(() => {
      if (this.state === 'PLAYING') {
        this.moveEnemies();
        this.render();
      }
    }, 800);
  }

  reset(isBackground = false) {
    if (this.enemyInterval) clearInterval(this.enemyInterval);

    this.map = this.generateMap(this.width, this.height);
    this.player = { x: 0, y: 0 };
    this.inventory = [];
    this.hp = 100;
    this.gameOver = false;

    // Enemies
    this.enemies = [];
    this.spawnEnemies(this.level + 1); // More enemies per level

    // Visibility (Fog of War)
    this.visited = Array(this.height).fill().map(() => Array(this.width).fill(false));

    if (!isBackground) {
      this.updateStats();
      this.updateVisibility();
      this.render();
    }
  }

  // Feature: Spend credits to heal
  buyRepair() {
    if (this.state !== 'PLAYING') return;

    if (this.score >= 50) {
      if (this.hp >= 100) {
        this.log("Integrity already at maximum.", 'warning');
        return;
      }
      this.updateScore(-50);
      this.updateHp(20);
      if (this.hp > 100) this.hp = 100;
      this.sound.playRepair();
      this.render(); // Update UI
      this.log("System Repaired. +20% Integrity.", 'success');
    } else {
      this.log("Insufficient Credits. Need 50.", 'danger');
      this.sound.playDamage(); // Error sound
    }
  }

  nextLevel() {
    if (this.enemyInterval) clearInterval(this.enemyInterval);

    this.sound.playWin(); // Play win sound briefly for level up
    this.level++;
    document.getElementById('level-display').textContent = this.level.toString().padStart(2, '0');
    this.log(`ACCESS GRANTED. User moved to Sector ${this.level}.`, 'success');
    this.hp = Math.min(100, this.hp + 20); // Heal 20%

    // Generate new map
    this.map = this.generateMap(this.width, this.height);
    this.player = { x: 0, y: 0 };
    this.inventory = [];
    this.visited = Array(this.height).fill().map(() => Array(this.width).fill(false));
    this.enemies = [];
    this.spawnEnemies(this.level + 2);

    this.updateStats();
    this.updateVisibility();
    this.render();

    // Restart AI
    this.startEnemyAI();
  }

  spawnEnemies(count) {
    for (let i = 0; i < count; i++) {
      let placed = false;
      while (!placed) {
        let rx = Math.floor(Math.random() * this.width);
        let ry = Math.floor(Math.random() * this.height);
        // Don't spawn on player or too close
        if (this.map[ry][rx] === '.' && (Math.abs(rx) + Math.abs(ry) > 3)) {
          this.enemies.push({ x: rx, y: ry, id: i });
          placed = true;
        }
      }
    }
  }

  generateMap(width, height) {
    let map = [];
    for (let y = 0; y < height; y++) {
      let row = [];
      for (let x = 0; x < width; x++) {
        // 20% walls, but keep start area clear
        if (Math.random() < 0.2 && (x > 1 || y > 1)) {
          row.push('#');
        } else {
          row.push('.');
        }
      }
      map.push(row);
    }

    const placeEntity = (entity, count) => {
      let n = 0;
      while (n < count) {
        let rx = Math.floor(Math.random() * width);
        let ry = Math.floor(Math.random() * height);
        if (map[ry][rx] === '.' && (rx > 3 || ry > 3)) {
          map[ry][rx] = entity;
          n++;
        }
      }
    };

    placeEntity('K', 1);
    placeEntity('D', 1);
    placeEntity('T', 2 + Math.floor(this.level / 2));
    placeEntity('X', 3 + this.level);

    map[0][0] = '.';
    return map;
  }

  movePlayer(direction) {
    if (this.state !== 'PLAYING') return;

    const { x, y } = this.player;
    let newX = x;
    let newY = y;

    if (direction === 'up') newY--;
    if (direction === 'down') newY++;
    if (direction === 'left') newX--;
    if (direction === 'right') newX++;

    if (!this.isValidMove(newX, newY)) return;

    const cell = this.map[newY][newX];

    // Interaction
    if (cell === 'D' && !this.inventory.includes('KeyCard')) {
      this.log('Access Denied. Find the KeyCard.', 'warning');
      this.sound.playDamage(); // Error sound
      return;
    }

    // Move
    this.player.x = newX;
    this.player.y = newY;
    this.sound.playMove(); // Step sound

    // Process Cell
    if (cell === 'T') {
      this.log('Data Cache decrypted. +50 Credits.', 'success');
      this.updateScore(50);
      this.sound.playItem(); // Item sound
      this.map[newY][newX] = '.';
    } else if (cell === 'X') {
      this.log('Malware Trap triggered! -15% Integrity.', 'danger');
      this.updateHp(-15);
      this.sound.playDamage(); // Hurt sound
      this.map[newY][newX] = '.';
    } else if (cell === 'K') {
      this.log('Encryption Key obtained.', 'success');
      this.inventory.push('KeyCard');
      this.updateInventory();
      this.sound.playItem(); // Item sound
      this.map[newY][newX] = '.';
    } else if (cell === 'D' && this.inventory.includes('KeyCard')) {
      this.nextLevel();
      return;
    }

    // Check immediate collision after move
    this.checkCollisions();

    // Update Fog & Render
    this.updateVisibility();
    this.render();
  }

  moveEnemies() {
    this.enemies.forEach(enemy => {
      // Simple random movement
      const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
      const move = dirs[Math.floor(Math.random() * dirs.length)];
      const ex = enemy.x + move[0];
      const ey = enemy.y + move[1];

      // Check bounds and walls
      if (ex >= 0 && ex < this.width && ey >= 0 && ey < this.height && this.map[ey][ex] !== '#') {
        enemy.x = ex;
        enemy.y = ey;
      }
    });

    this.checkCollisions();
  }

  checkCollisions() {
    this.enemies.forEach(enemy => {
      if (enemy.x === this.player.x && enemy.y === this.player.y) {
        this.log('CONTACT WITH PATROL BOT! -20% Integrity.', 'danger');
        this.updateHp(-20);
        this.sound.playDamage(); // Hurt sound
      }
    });
  }

  isValidMove(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;
    if (this.map[y][x] === '#') return false;
    return true;
  }

  updateVisibility() {
    const range = 2;
    for (let dy = -range; dy <= range; dy++) {
      for (let dx = -range; dx <= range; dx++) {
        const py = this.player.y + dy;
        const px = this.player.x + dx;
        if (px >= 0 && px < this.width && py >= 0 && py < this.height) {
          this.visited[py][px] = true;
        }
      }
    }
  }

  updateHp(amount) {
    this.hp += amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.endGame(false);
    }
    document.getElementById('hp-display').textContent = this.hp + '%';

    // Update Bar
    const bar = document.getElementById('hp-bar');
    bar.style.width = this.hp + '%';
    bar.style.backgroundColor = this.hp > 50 ? 'var(--accent-color)' : (this.hp > 20 ? 'var(--warning-color)' : 'var(--danger-color)');
  }

  updateScore(amount) {
    this.score += amount;
    document.getElementById('score-display').textContent = this.score;
  }

  updateInventory() {
    const list = document.getElementById('inventory-list');
    list.innerHTML = '';
    if (this.inventory.length === 0) list.innerHTML = '<span style="color: #666; font-style: italic;">Empty...</span>';
    this.inventory.forEach(item => {
      const span = document.createElement('span');
      span.style.color = 'var(--accent-color)';
      span.innerHTML = `<ion-icon name="key"></ion-icon> ${item}`;
      list.appendChild(span);
    });
  }

  updateStats() {
    this.updateHp(0);
    this.updateScore(0);
    this.updateInventory();
  }

  log(msg, type = '') {
    const panel = document.getElementById('log-panel');
    const d = document.createElement('div');
    d.className = `log-entry new ${type}`;
    d.innerHTML = `> ${msg}`;
    panel.appendChild(d);
    panel.scrollTop = panel.scrollHeight;
  }

  endGame(win) {
    this.state = 'GAMEOVER';
    if (this.enemyInterval) clearInterval(this.enemyInterval);
    this.sound.stopBGM();

    if (win) this.sound.playWin();
    else this.sound.playDamage();

    this.log(win ? 'MISSION ACCOMPLISHED.' : 'SYSTEM FAILURE. CONNECTION LOST.', win ? 'success' : 'danger');

    // Show Modal
    const modal = document.getElementById('game-over-modal');
    const title = document.getElementById('go-title');
    const msg = document.getElementById('go-message');
    const scoreVal = document.getElementById('go-score-val');
    const btn = document.getElementById('go-btn');
    const content = document.getElementById('go-content');

    scoreVal.textContent = this.score;
    modal.classList.remove('hidden');

    if (win) {
      title.textContent = "MISSION COMPLETE";
      title.style.color = "var(--accent-color)";
      title.style.textShadow = "0 0 10px var(--accent-color)";
      msg.textContent = "Data retrieval successful. Neural link severed safely.";
      content.style.borderColor = "var(--accent-color)";
      content.style.boxShadow = "0 0 30px rgba(0, 255, 65, 0.2)";
      btn.style.borderColor = "var(--accent-color)";
      btn.style.color = "var(--accent-color)";
      btn.textContent = "NEW MISSION";
    } else {
      title.textContent = "SYSTEM FAILURE";
      title.style.color = "var(--danger-color)";
      title.style.textShadow = "0 0 10px var(--danger-color)";
      msg.textContent = "Critical integrity loss. Neural link terminated.";
      content.style.borderColor = "var(--danger-color)";
      content.style.boxShadow = "0 0 30px rgba(255, 0, 85, 0.2)";
      btn.style.borderColor = "var(--danger-color)";
      btn.style.color = "var(--danger-color)";
      btn.textContent = "REBOOT SYSTEM";
    }
  }

  render() {
    const board = document.getElementById('game-board');
    board.innerHTML = '';

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = document.createElement('div');
        cell.className = 'cell';

        // Fog Logic
        if (!this.visited[y][x]) {
          cell.classList.add('fog');
          board.appendChild(cell);
          continue;
        }

        const content = this.map[y][x];

        // Render content
        if (x === this.player.x && y === this.player.y) {
          cell.classList.add('player');
          cell.innerHTML = '<ion-icon name="person"></ion-icon>';
        } else {
          // Check Enemies
          const enemy = this.enemies.find(e => e.x === x && e.y === y);
          if (enemy) {
            cell.classList.add('enemy');
            cell.innerHTML = '<ion-icon name="skull"></ion-icon>';
          } else if (content === '#') {
            cell.classList.add('wall');
          } else if (content === 'T') {
            cell.classList.add('treasure');
            cell.innerHTML = '<ion-icon name="cube"></ion-icon>';
          } else if (content === 'X') {
            cell.classList.add('trap');
            cell.innerHTML = '<ion-icon name="flash-off"></ion-icon>';
          } else if (content === 'K') {
            cell.classList.add('key');
            cell.innerHTML = '<ion-icon name="key"></ion-icon>';
          } else if (content === 'D') {
            cell.classList.add('door');
            cell.innerHTML = '<ion-icon name="lock-closed"></ion-icon>';
          }
        }
        board.appendChild(cell);
      }
    }
  }
}

// Initialize
const game = new Game(12, 12);
