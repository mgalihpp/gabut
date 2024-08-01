class Game {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.map = this.generateMap(width, height);
    this.player = { x: 0, y: 0, inventory: [], log: '' };
    this.displayMap();
  }

  generateMap(width, height) {
    let map = [];
    for (let y = 0; y < height; y++) {
      let row = [];
      for (let x = 0; x < width; x++) {
        let rand = Math.random();
        if (rand > 0.95) {
          row.push('K'); // Key
        } else if (rand > 0.8) {
          row.push('T'); // Treasure
        } else if (rand < 0.1) {
          row.push('X'); // Trap
        } else if (rand < 0.05) {
          row.push('D'); // Door
        } else if (rand < 0.02) {
          row.push('N'); // NPC
        } else {
          row.push('.'); // Empty space
        }
      }
      map.push(row);
    }
    map[0][0] = 'P'; // Start position of the player
    return map;
  }

  movePlayer(direction) {
    const { x, y } = this.player;
    let newX = x;
    let newY = y;

    if (direction === 'up') newY--;
    if (direction === 'down') newY++;
    if (direction === 'left') newX--;
    if (direction === 'right') newX++;

    if (this.isValidMove(newX, newY)) {
      this.map[y][x] = '.';
      this.player.x = newX;
      this.player.y = newY;

      let cell = this.map[newY][newX];
      if (cell === 'T') {
        this.displayLog('You found a treasure!\n');
        console.log('You found a treasure!');
      } else if (cell === 'X') {
        this.displayLog('You fell into a trap!\n');
        console.log('You fell into a trap!');
      } else if (cell === 'K') {
        this.displayLog('You found a key!\n');
        console.log('You found a key!');
        this.player.inventory.push('Key');
      } else if (cell === 'D') {
        if (this.player.inventory.includes('Key')) {
          this.displayLog('You unlocked the door and won the game!');
          console.log('You unlocked the door and won the game!');
        } else {
          this.displayLog('You need a key to open this door.');
          console.log('You need a key to open this door.');
        }
      } else if (cell === 'N') {
        this.displayLog('You met an NPC! They give you a hint.');
        console.log('You met an NPC! They give you a hint.');
        // Add more interactions with NPC here
      }

      this.map[newY][newX] = 'P';
      this.displayMap();
    } else {
      this.displayLog('Invalid move!');
      console.log('Invalid move!');
    }
  }

  isValidMove(x, y) {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  displayLog(log) {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = log;

    setTimeout(() => {
      messageDiv.textContent = '';
    }, 2000);
  }

  displayMap() {
    const gameDiv = document.getElementById('game');
    gameDiv.textContent = this.map.map((row) => row.join(' ')).join('\n');
  }
}

const game = new Game(10, 10);
