const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game State
let currentState = 'START'; // START, PLAYING, GAMEOVER
let gameSpeed = 5;
let score = 0;
let animationId;

// Resize Canvas
function resize() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
}
resize();
window.addEventListener('resize', resize);

// Player Object
const player = {
    x: 100,
    y: 0,
    width: 40,
    height: 40,
    color: '#00f3ff',
    dy: 0,
    jumpStrength: 15,
    gravity: 0.8,
    grounded: false,

    draw() {
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 20;
        ctx.shadowColor = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.shadowBlur = 0;

        // Eye
        ctx.fillStyle = '#fff';
        ctx.fillRect(this.x + 25, this.y + 10, 10, 5);
    },

    update() {
        // Gravity
        this.y += this.dy;

        if (this.y + this.height < canvas.height - 50) { // 50 is floor height
            this.dy += this.gravity;
            this.grounded = false;
        } else {
            this.dy = 0;
            this.grounded = true;
            this.y = canvas.height - 50 - this.height;
        }
    }
};

// Obstacles
let obstacles = [];

class Obstacle {
    constructor() {
        this.width = 30 + Math.random() * 30;
        this.height = 40 + Math.random() * 40;
        this.x = canvas.width;
        this.y = canvas.height - 50 - this.height;
        this.color = '#ff00ff';
        this.markedForDeletion = false;
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.shadowBlur = 0;
    }

    update() {
        this.x -= gameSpeed;
        if (this.x + this.width < 0) this.markedForDeletion = true;
    }
}

// Background Particles
let particles = [];
class Particle {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2;
        this.speedX = Math.random() * 0.5 + 0.1;
    }
    update() {
        this.x -= this.speedX * (gameSpeed * 0.5);
        if (this.x < 0) {
            this.x = canvas.width;
            this.y = Math.random() * canvas.height;
        }
    }
    draw() {
        ctx.fillStyle = 'rgba(0, 243, 255, 0.3)';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}
for (let i = 0; i < 50; i++) particles.push(new Particle());

// Inputs
function jump() {
    if (currentState === 'PLAYING' && player.grounded) {
        player.dy = -player.jumpStrength;
    }
}

window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') jump();
});
canvas.addEventListener('click', jump);

// Game Function
function spawnObstacle() {
    // Random spawn timer
    if (Math.random() < 0.02) {
        // Ensure distance between obstacles
        if (obstacles.length === 0 || canvas.width - obstacles[obstacles.length - 1].x > 250) {
            obstacles.push(new Obstacle());
        }
    }
}

function checkCollision(rect1, rect2) {
    return (
        rect1.x < rect2.x + rect2.width &&
        rect1.x + rect1.width > rect2.x &&
        rect1.y < rect2.y + rect2.height &&
        rect1.y + rect1.height > rect2.y
    );
}

function gameOver() {
    currentState = 'GAMEOVER';
    document.getElementById('game-over-screen').classList.remove('hidden');
    document.getElementById('final-score').innerText = Math.floor(score);
}

function loop() {
    if (currentState !== 'PLAYING') return;

    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear Canvas

    // Background
    particles.forEach(p => { p.update(); p.draw(); });

    // Floor
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, canvas.height - 50, canvas.width, 50);
    ctx.strokeStyle = '#00ff41';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height - 50);
    ctx.lineTo(canvas.width, canvas.height - 50);
    ctx.stroke();

    // Player
    player.update();
    player.draw();

    // Obstacles
    spawnObstacle();
    obstacles.forEach((obs, index) => {
        obs.update();
        obs.draw();

        // Collision
        if (checkCollision(player, obs)) {
            gameOver();
        }

        // Score
        if (!obs.passed && player.x > obs.x + obs.width) {
            score += 10;
            obs.passed = true;
            document.getElementById('score').innerText = score;

            // Speed up
            if (score % 50 === 0) gameSpeed += 0.5;
        }
    });

    // Cleanup
    obstacles = obstacles.filter(obs => !obs.markedForDeletion);

    animationId = requestAnimationFrame(loop);
}

// Controls
document.getElementById('start-btn').addEventListener('click', () => {
    document.getElementById('start-screen').classList.add('hidden');
    startGame();
});

document.getElementById('restart-btn').addEventListener('click', () => {
    document.getElementById('game-over-screen').classList.add('hidden');
    startGame();
});

function startGame() {
    currentState = 'PLAYING';
    score = 0;
    gameSpeed = 5;
    document.getElementById('score').innerText = score;
    obstacles = [];
    player.y = 0;
    player.dy = 0;

    if (animationId) cancelAnimationFrame(animationId);
    loop();
}
