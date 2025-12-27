const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game State
let gameState = 'START'; // START, PLAYING, GAMEOVER
let money = 175;
let lives = 20;
let wave = 1;

// Path Waypoints (Simple winding path)
const path = [
    { x: 0, y: 300 },
    { x: 200, y: 300 },
    { x: 200, y: 100 },
    { x: 600, y: 100 },
    { x: 600, y: 500 },
    { x: 400, y: 500 },
    { x: 400, y: 300 },
    { x: 800, y: 300 }
];

// Entities
const enemies = [];
const towers = [];
const projectiles = [];
const particles = [];

// Tower Types
const TOWER_TYPES = [
    { name: 'BLASTER', cost: 50, range: 150, cooldown: 60, damage: 20, color: '#00f3ff' },
    { name: 'SNIPER', cost: 150, range: 300, cooldown: 120, damage: 100, color: '#ff0055' },
    { name: 'RAPID', cost: 300, range: 100, cooldown: 10, damage: 5, color: '#ffbd00' }
];

// Interaction State
let selectedTowerTypeIndex = -1; // For placing new towers
let selectedPlacedTower = null;   // For upgrading existing towers

// --- CLASSES ---

class Enemy {
    constructor(waveMultiplier) {
        this.wpIndex = 0;
        this.x = path[0].x;
        this.y = path[0].y;
        this.radius = 15;
        this.speed = 1.5 + (waveMultiplier * 0.1);
        this.hp = 80 + (waveMultiplier * 30);
        this.maxHp = this.hp;
        this.color = '#ff0055';
        this.finished = false;
    }

    update() {
        if (this.finished) return;

        const target = path[this.wpIndex + 1];
        if (!target) {
            this.reachedEnd();
            return;
        }

        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 5) {
            this.wpIndex++;
            if (this.wpIndex >= path.length - 1) {
                this.reachedEnd();
            }
        } else {
            const angle = Math.atan2(dy, dx);
            this.x += Math.cos(angle) * this.speed;
            this.y += Math.sin(angle) * this.speed;
        }
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // HP Bar
        ctx.fillStyle = '#333';
        ctx.fillRect(this.x - 15, this.y - 25, 30, 4);
        ctx.fillStyle = '#00ff41';
        ctx.fillRect(this.x - 15, this.y - 25, 30 * (Math.max(0, this.hp) / this.maxHp), 4);
    }

    takeDamage(amount) {
        this.hp -= amount;
        if (this.hp <= 0) {
            money += 25;
            updateHUD();
            particles.push(new Particle(this.x, this.y, this.color));
            return true; // Dead
        }
        return false;
    }

    reachedEnd() {
        if (!this.finished) {
            this.finished = true;
            lives--;
            updateHUD();
            if (lives <= 0) endGame();
        }
    }
}

class Tower {
    constructor(x, y, typeIndex) {
        this.x = x;
        this.y = y;
        this.typeIndex = typeIndex;
        // Clone properties so we can upgrade independently
        const template = TOWER_TYPES[typeIndex];
        this.name = template.name;
        this.range = template.range;
        this.cooldownMax = template.cooldown;
        this.damage = template.damage;
        this.color = template.color;
        this.cost = template.cost; // Base cost for sell calculation

        this.level = 1;
        this.timer = 0;
        this.target = null;
    }

    getUpgradeCost() {
        return Math.floor(this.cost * 0.8 * this.level);
    }

    getSellValue() {
        return Math.floor(this.cost * 0.5);
    }

    upgrade() {
        this.level++;
        this.cost += this.getUpgradeCost(); // Track total value
        this.damage = Math.floor(this.damage * 1.3);
        this.range = Math.floor(this.range * 1.1);
        this.cooldownMax = Math.max(5, Math.floor(this.cooldownMax * 0.9));
    }

    draw() {
        // Selection Ring
        if (this === selectedPlacedTower) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.range, 0, Math.PI * 2);
            ctx.stroke();

            ctx.strokeStyle = '#00ff41';
            ctx.beginPath();
            ctx.arc(this.x, this.y, 18, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Base
        ctx.fillStyle = '#222';
        ctx.fillRect(this.x - 15, this.y - 15, 30, 30);

        // Turret
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 10, 0, Math.PI * 2);
        ctx.fill();

        // Level Badge
        if (this.level > 1) {
            ctx.fillStyle = '#fff';
            ctx.font = '10px Arial';
            ctx.fillText(this.level, this.x - 3, this.y + 4);
        }
    }

    update() {
        this.timer++;

        this.target = null;
        let minDist = Infinity;

        for (const enemy of enemies) {
            const dist = Math.hypot(enemy.x - this.x, enemy.y - this.y);
            if (dist < this.range && dist < minDist) {
                minDist = dist;
                this.target = enemy;
            }
        }

        if (this.target && this.timer >= this.cooldownMax) {
            this.shoot();
            this.timer = 0;
        }
    }

    shoot() {
        projectiles.push(new Projectile(this.x, this.y, this.target, this.damage, this.color));
    }
}

class Projectile {
    constructor(x, y, target, damage, color) {
        this.x = x;
        this.y = y;
        this.target = target;
        this.damage = damage;
        this.color = color;
        this.speed = 10;
        this.hit = false;
    }

    update() {
        if (!this.target || this.target.hp <= 0) {
            this.hit = true;
            return;
        }

        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist < this.speed) {
            const dead = this.target.takeDamage(this.damage);
            if (dead) {
                const idx = enemies.indexOf(this.target);
                if (idx > -1) enemies.splice(idx, 1);
            }
            this.hit = true;
        } else {
            const angle = Math.atan2(dy, dx);
            this.x += Math.cos(angle) * this.speed;
            this.y += Math.sin(angle) * this.speed;
        }
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.life = 20;
    }
    update() { this.life--; }
    draw() {
        if (this.life <= 0) return;
        ctx.fillStyle = this.color;
        ctx.globalAlpha = this.life / 20;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 10 + (20 - this.life), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

// --- GAME FUNCTIONS ---

function init() {
    canvas.addEventListener('click', handleCanvasClick);
    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('next-wave-btn').addEventListener('click', startWave);
}

function startGame() {
    document.getElementById('start-screen').classList.add('hidden');
    gameState = 'PLAYING';
    log("System Initialized.");
    loop();
}

function startWave() {
    if (gameState !== 'PLAYING') return;
    log(`Wave ${wave} Initiated.`);
    let count = 0;
    const maxEnemies = 5 + wave * 2;

    // Wave spawning logic (simplified)
    const interval = setInterval(() => {
        if (gameState !== 'PLAYING') { clearInterval(interval); return; }
        enemies.push(new Enemy(wave));
        count++;
        if (count >= maxEnemies) {
            clearInterval(interval);
            wave++;
            updateHUD();
        }
    }, 1000 - (Math.min(800, wave * 50)));
}

function updateHUD() {
    document.getElementById('lives').innerText = lives;
    document.getElementById('money').innerText = money;
    document.getElementById('wave').innerText = wave;
}

function updateTowerInfoPanel() {
    const defaultRec = document.querySelector('.tower-selection:not(#tower-control-panel)');
    const controlPanel = document.getElementById('tower-control-panel');

    if (selectedPlacedTower) {
        // Show Control Panel
        defaultRec.classList.add('hidden');
        controlPanel.classList.remove('hidden');

        document.getElementById('sel-tower-name').innerText = selectedPlacedTower.name;
        document.getElementById('sel-tower-level').innerText = selectedPlacedTower.level;
        document.getElementById('sel-tower-range').innerText = selectedPlacedTower.range;
        document.getElementById('sel-tower-dmg').innerText = selectedPlacedTower.damage;

        const upCost = selectedPlacedTower.getUpgradeCost();
        document.getElementById('upgrade-cost').innerText = upCost;
        document.getElementById('btn-upgrade').disabled = money < upCost;
        document.getElementById('btn-upgrade').style.opacity = money < upCost ? 0.5 : 1;

        document.getElementById('sell-cost').innerText = selectedPlacedTower.getSellValue();

    } else {
        // Show Default Selection
        defaultRec.classList.remove('hidden');
        controlPanel.classList.add('hidden');
    }
}

function log(msg) {
    const box = document.getElementById('log-box');
    const div = document.createElement('div');
    div.className = 'log-entry';
    div.innerText = `> ${msg}`;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

// --- INTERACTION ---

// Select tower from shop to place
function selectTower(index) {
    // If we were selecting a placed tower, deselect it
    selectedPlacedTower = null;
    updateTowerInfoPanel();

    // Select logic
    selectedTowerTypeIndex = index;
    document.querySelectorAll('.tower-btn').forEach((btn, i) => {
        if (i === index) btn.classList.add('selected');
        else btn.classList.remove('selected');
    });
}
window.selectTower = selectTower;

// Deselect everything
function deselectTower() {
    selectedPlacedTower = null;
    selectedTowerTypeIndex = -1;
    document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
    updateTowerInfoPanel();
}
window.deselectTower = deselectTower;

// Upgrade Action
function upgradeSelectedTower() {
    if (!selectedPlacedTower) return;
    const cost = selectedPlacedTower.getUpgradeCost();
    if (money >= cost) {
        money -= cost;
        selectedPlacedTower.upgrade();
        particles.push(new Particle(selectedPlacedTower.x, selectedPlacedTower.y, '#fff'));
        log(`${selectedPlacedTower.name} Upgraded to Lvl ${selectedPlacedTower.level}`);
        updateHUD();
        updateTowerInfoPanel();
    } else {
        log("Insufficient Credits for Upgrade.");
    }
}
window.upgradeSelectedTower = upgradeSelectedTower;

// Sell Action
function sellSelectedTower() {
    if (!selectedPlacedTower) return;
    const val = selectedPlacedTower.getSellValue();
    money += val;

    // Remove tower
    const idx = towers.indexOf(selectedPlacedTower);
    if (idx > -1) towers.splice(idx, 1);

    log(`Sold tower for ${val} CR.`);
    deselectTower();
    updateHUD();
}
window.sellSelectedTower = sellSelectedTower;


function handleCanvasClick(e) {
    if (gameState !== 'PLAYING') return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // 1. Check if clicked on existing tower
    let clickedTower = null;
    for (const t of towers) {
        const dist = Math.hypot(t.x - x, t.y - y);
        if (dist < 20) {
            clickedTower = t;
            break;
        }
    }

    if (clickedTower) {
        selectedPlacedTower = clickedTower;
        selectedTowerTypeIndex = -1; // Cancel placement mode
        document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
        updateTowerInfoPanel();
        return;
    }

    // 2. If no tower clicked, and we have a type selected, try to place
    if (selectedTowerTypeIndex !== -1) {
        const type = TOWER_TYPES[selectedTowerTypeIndex];
        if (money < type.cost) {
            log("Insufficient Credits!");
            return;
        }

        // Simple collision check with path for placement (prevent blocking, though our enemies ignore physics, it looks bad)
        // Also check overlap with other towers
        for (const t of towers) {
            if (Math.hypot(t.x - x, t.y - y) < 40) {
                log("Placement Blocked: Too close to another tower.");
                return;
            }
        }

        // Place
        towers.push(new Tower(x, y, selectedTowerTypeIndex));
        money -= type.cost;
        updateHUD();
        log(`${type.name} Deployed.`);

        // Deselect placement tool
        selectedTowerTypeIndex = -1;
        document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
    } else {
        // Clicked empty space with nothing selected -> Deselect active tower
        if (selectedPlacedTower) deselectTower();
    }
}


function endGame() {
    gameState = 'GAMEOVER';
    document.getElementById('game-over-screen').classList.remove('hidden');
}

function loop() {
    if (gameState !== 'PLAYING') return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Path
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 40;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(0, 243, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
    ctx.stroke();

    // Game Logic
    towers.forEach(t => { t.update(); t.draw(); });

    // Enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        enemies[i].update();
        enemies[i].draw();

        // Remove dead or finished enemies
        if (enemies[i].hp <= 0 || enemies[i].finished) {
            enemies.splice(i, 1);
        }
    }

    // Projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
        projectiles[i].update();
        projectiles[i].draw();
        if (projectiles[i].hit) projectiles.splice(i, 1);
    }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        particles[i].draw();
        if (particles[i].life <= 0) particles.splice(i, 1);
    }

    requestAnimationFrame(loop);
}

init();
