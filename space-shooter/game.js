/* ============================================
   NEON FURY - SPACE SHOOTER
   Game Engine & Logic
   ============================================ */

// ==========================================
// GAME CONFIGURATION
// ==========================================
const CONFIG = {
    // Canvas
    WIDTH: window.innerWidth,
    HEIGHT: window.innerHeight,

    // Player
    PLAYER_SPEED: 7,
    PLAYER_FIRE_RATE: 150, // ms between shots
    PLAYER_MAX_HEALTH: 100,
    PLAYER_INVINCIBILITY_TIME: 1500,

    // Projectiles
    BULLET_SPEED: 12,
    BULLET_DAMAGE: 25,
    ENEMY_BULLET_SPEED: 6,

    // Enemies
    ENEMY_SPAWN_RATE: 1500,
    ENEMY_TYPES: {
        scout: {
            health: 25,
            speed: 4,
            score: 100,
            size: 35,
            fireRate: 0, // doesn't shoot
            color: '#ff6600'
        },
        fighter: {
            health: 50,
            speed: 2.5,
            score: 250,
            size: 45,
            fireRate: 2000,
            color: '#ff00ff'
        },
        bomber: {
            health: 100,
            speed: 1.5,
            score: 500,
            size: 60,
            fireRate: 3000,
            color: '#00ff88'
        }
    },

    // Power-ups
    POWERUP_CHANCE: 0.15,
    POWERUP_DURATION: 8000,
    POWERUP_TYPES: ['rapidfire', 'multishot', 'shield', 'nuke'],

    // Combo
    COMBO_TIMEOUT: 2000,

    // Waves
    WAVE_ENEMY_BASE: 5,
    WAVE_ENEMY_INCREMENT: 3,
    WAVE_DELAY: 3000
};

// ==========================================
// ASSET MANAGEMENT
// ==========================================
class AssetManager {
    constructor() {
        this.images = {};
        this.loaded = false;
    }

    async loadAll() {
        const assets = {
            player: 'assets/player.png',
            enemyScout: 'assets/enemy_scout.png',
            enemyFighter: 'assets/enemy_fighter.png',
            enemyBomber: 'assets/enemy_bomber.png'
        };

        const promises = Object.entries(assets).map(([key, src]) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    this.images[key] = img;
                    resolve();
                };
                img.onerror = () => {
                    // Fallback - create placeholder
                    this.images[key] = null;
                    resolve();
                };
                img.src = src;
            });
        });

        await Promise.all(promises);
        this.loaded = true;
    }

    get(name) {
        return this.images[name];
    }
}

// ==========================================
// PARTICLE SYSTEM
// ==========================================
class Particle {
    constructor(x, y, options = {}) {
        this.x = x;
        this.y = y;
        this.vx = options.vx || (Math.random() - 0.5) * 10;
        this.vy = options.vy || (Math.random() - 0.5) * 10;
        this.life = options.life || 1;
        this.decay = options.decay || 0.02;
        this.size = options.size || 3;
        this.color = options.color || '#00f5ff';
        this.gravity = options.gravity || 0;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += this.gravity;
        this.life -= this.decay;
        this.vx *= 0.98;
        this.vy *= 0.98;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * this.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    isDead() {
        return this.life <= 0;
    }
}

class ParticleSystem {
    constructor() {
        this.particles = [];
    }

    emit(x, y, count, options = {}) {
        for (let i = 0; i < count; i++) {
            this.particles.push(new Particle(x, y, {
                ...options,
                vx: options.vx !== undefined ? options.vx : (Math.random() - 0.5) * (options.spread || 10),
                vy: options.vy !== undefined ? options.vy : (Math.random() - 0.5) * (options.spread || 10)
            }));
        }
    }

    explosion(x, y, color = '#ff6600', count = 30) {
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count;
            const speed = 3 + Math.random() * 5;
            this.particles.push(new Particle(x, y, {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: color,
                size: 2 + Math.random() * 4,
                decay: 0.015 + Math.random() * 0.02
            }));
        }
        // Core explosion
        for (let i = 0; i < 10; i++) {
            this.particles.push(new Particle(x, y, {
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8,
                color: '#ffffff',
                size: 5 + Math.random() * 5,
                decay: 0.04
            }));
        }
    }

    trail(x, y, color = '#00f5ff') {
        this.particles.push(new Particle(x, y, {
            vx: (Math.random() - 0.5) * 2,
            vy: 3 + Math.random() * 2,
            color: color,
            size: 2 + Math.random() * 2,
            decay: 0.05
        }));
    }

    update() {
        this.particles = this.particles.filter(p => {
            p.update();
            return !p.isDead();
        });
    }

    draw(ctx) {
        this.particles.forEach(p => p.draw(ctx));
    }

    clear() {
        this.particles = [];
    }
}

// ==========================================
// GAME ENTITIES
// ==========================================
class Entity {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.active = true;
    }

    getBounds() {
        return {
            left: this.x - this.width / 2,
            right: this.x + this.width / 2,
            top: this.y - this.height / 2,
            bottom: this.y + this.height / 2
        };
    }

    collidesWith(other) {
        const a = this.getBounds();
        const b = other.getBounds();
        return a.left < b.right && a.right > b.left &&
            a.top < b.bottom && a.bottom > b.top;
    }
}

// Player Ship
class Player extends Entity {
    constructor(game) {
        super(CONFIG.WIDTH / 2, CONFIG.HEIGHT - 100, 50, 50);
        this.game = game;
        this.speed = CONFIG.PLAYER_SPEED;
        this.health = CONFIG.PLAYER_MAX_HEALTH;
        this.maxHealth = CONFIG.PLAYER_MAX_HEALTH;
        this.fireRate = CONFIG.PLAYER_FIRE_RATE;
        this.lastShot = 0;
        this.invincible = false;
        this.invincibleTime = 0;
        this.powerups = {
            rapidfire: 0,
            multishot: 0,
            shield: 0
        };
        this.specialCharge = 0;
        this.maxSpecialCharge = 100;
    }

    update(keys, deltaTime) {
        // Movement
        if (keys.left && this.x > this.width / 2) {
            this.x -= this.speed;
        }
        if (keys.right && this.x < CONFIG.WIDTH - this.width / 2) {
            this.x += this.speed;
        }
        if (keys.up && this.y > this.height / 2) {
            this.y -= this.speed;
        }
        if (keys.down && this.y < CONFIG.HEIGHT - this.height / 2) {
            this.y += this.speed;
        }

        // Shooting
        if (keys.fire && Date.now() - this.lastShot > this.getFireRate()) {
            this.shoot();
            this.lastShot = Date.now();
        }

        // Special attack
        if (keys.special && this.specialCharge >= this.maxSpecialCharge) {
            this.specialAttack();
        }

        // Engine trail
        if (Math.random() > 0.5) {
            this.game.particles.trail(
                this.x + (Math.random() - 0.5) * 10,
                this.y + this.height / 2,
                '#00f5ff'
            );
        }

        // Update invincibility
        if (this.invincible && Date.now() > this.invincibleTime) {
            this.invincible = false;
        }

        // Update powerups
        const now = Date.now();
        for (let key in this.powerups) {
            if (this.powerups[key] > 0 && now > this.powerups[key]) {
                this.powerups[key] = 0;
            }
        }
    }

    getFireRate() {
        return this.powerups.rapidfire > Date.now() ?
            CONFIG.PLAYER_FIRE_RATE / 3 : CONFIG.PLAYER_FIRE_RATE;
    }

    shoot() {
        const hasMultishot = this.powerups.multishot > Date.now();

        if (hasMultishot) {
            // Triple shot
            this.game.bullets.push(new Bullet(this.x, this.y - this.height / 2, 0, -CONFIG.BULLET_SPEED, true));
            this.game.bullets.push(new Bullet(this.x - 15, this.y - this.height / 2, -1, -CONFIG.BULLET_SPEED, true));
            this.game.bullets.push(new Bullet(this.x + 15, this.y - this.height / 2, 1, -CONFIG.BULLET_SPEED, true));
        } else {
            this.game.bullets.push(new Bullet(this.x, this.y - this.height / 2, 0, -CONFIG.BULLET_SPEED, true));
        }
    }

    specialAttack() {
        this.specialCharge = 0;
        // Nuke effect - damage all enemies
        this.game.enemies.forEach(enemy => {
            enemy.takeDamage(50);
            this.game.particles.explosion(enemy.x, enemy.y, '#00f5ff', 15);
        });
        // Screen flash effect
        this.game.screenFlash = 1;
    }

    takeDamage(amount) {
        if (this.invincible || this.powerups.shield > Date.now()) {
            return;
        }

        this.health -= amount;
        this.invincible = true;
        this.invincibleTime = Date.now() + CONFIG.PLAYER_INVINCIBILITY_TIME;

        // Screen shake
        this.game.screenShake = 10;

        // Damage particles
        this.game.particles.emit(this.x, this.y, 20, {
            color: '#ff0044',
            spread: 15,
            decay: 0.03
        });

        if (this.health <= 0) {
            this.game.gameOver();
        }
    }

    heal(amount) {
        this.health = Math.min(this.maxHealth, this.health + amount);
    }

    addPowerup(type) {
        if (type === 'nuke') {
            this.specialCharge = this.maxSpecialCharge;
        } else {
            this.powerups[type] = Date.now() + CONFIG.POWERUP_DURATION;
        }
    }

    draw(ctx) {
        ctx.save();

        // Flicker when invincible
        if (this.invincible && Math.floor(Date.now() / 100) % 2 === 0) {
            ctx.globalAlpha = 0.5;
        }

        // Shield effect
        if (this.powerups.shield > Date.now()) {
            ctx.strokeStyle = '#00f5ff';
            ctx.lineWidth = 3;
            ctx.shadowColor = '#00f5ff';
            ctx.shadowBlur = 20;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.width * 0.8, 0, Math.PI * 2);
            ctx.stroke();
        }

        const img = this.game.assets.get('player');
        if (img) {
            ctx.drawImage(img, this.x - this.width / 2, this.y - this.height / 2, this.width, this.height);
        } else {
            // Fallback: Draw ship shape
            this.drawFallback(ctx);
        }

        ctx.restore();
    }

    drawFallback(ctx) {
        ctx.fillStyle = '#00f5ff';
        ctx.shadowColor = '#00f5ff';
        ctx.shadowBlur = 15;

        ctx.beginPath();
        ctx.moveTo(this.x, this.y - this.height / 2);
        ctx.lineTo(this.x - this.width / 2, this.y + this.height / 2);
        ctx.lineTo(this.x - this.width / 4, this.y + this.height / 4);
        ctx.lineTo(this.x + this.width / 4, this.y + this.height / 4);
        ctx.lineTo(this.x + this.width / 2, this.y + this.height / 2);
        ctx.closePath();
        ctx.fill();
    }
}

// Bullet
class Bullet extends Entity {
    constructor(x, y, vx, vy, isPlayer = true) {
        super(x, y, isPlayer ? 8 : 10, isPlayer ? 20 : 15);
        this.vx = vx;
        this.vy = vy;
        this.isPlayer = isPlayer;
        this.damage = isPlayer ? CONFIG.BULLET_DAMAGE : 20;
        this.color = isPlayer ? '#00f5ff' : '#ff0044';
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;

        // Check bounds
        if (this.y < -50 || this.y > CONFIG.HEIGHT + 50 ||
            this.x < -50 || this.x > CONFIG.WIDTH + 50) {
            this.active = false;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 15;

        if (this.isPlayer) {
            // Laser beam
            ctx.fillRect(this.x - this.width / 2, this.y - this.height / 2, this.width, this.height);
            // Glow tip
            ctx.beginPath();
            ctx.arc(this.x, this.y - this.height / 2, this.width / 2, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Enemy bullet - circular
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.width / 2, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}

// Enemy Base Class
class Enemy extends Entity {
    constructor(game, type, x, y) {
        const config = CONFIG.ENEMY_TYPES[type];
        super(x, y, config.size, config.size);
        this.game = game;
        this.type = type;
        this.config = config;
        this.health = config.health;
        this.maxHealth = config.health;
        this.speed = config.speed;
        this.score = config.score;
        this.color = config.color;
        this.lastShot = 0;
        this.angle = 0;
        this.patternTime = Math.random() * 1000;
    }

    update(deltaTime) {
        this.patternTime += deltaTime;

        // Movement pattern based on type
        switch (this.type) {
            case 'scout':
                this.moveScout();
                break;
            case 'fighter':
                this.moveFighter();
                break;
            case 'bomber':
                this.moveBomber();
                break;
        }

        // Shooting
        if (this.config.fireRate > 0 && Date.now() - this.lastShot > this.config.fireRate) {
            this.shoot();
            this.lastShot = Date.now();
        }

        // Check bounds
        if (this.y > CONFIG.HEIGHT + 100) {
            this.active = false;
        }

        // Engine trail
        if (Math.random() > 0.7) {
            this.game.particles.trail(this.x, this.y - this.height / 2, this.color);
        }
    }

    moveScout() {
        // Zigzag pattern
        this.y += this.speed;
        this.x += Math.sin(this.patternTime * 0.005) * 3;
    }

    moveFighter() {
        // Follow player slightly
        this.y += this.speed;
        const dx = this.game.player.x - this.x;
        this.x += Math.sign(dx) * 0.5;
    }

    moveBomber() {
        // Slow, straight movement
        this.y += this.speed;
    }

    shoot() {
        const dx = this.game.player.x - this.x;
        const dy = this.game.player.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const vx = (dx / dist) * CONFIG.ENEMY_BULLET_SPEED;
        const vy = (dy / dist) * CONFIG.ENEMY_BULLET_SPEED;

        this.game.bullets.push(new Bullet(this.x, this.y + this.height / 2, vx, vy, false));
    }

    takeDamage(amount) {
        this.health -= amount;

        // Hit particles
        this.game.particles.emit(this.x, this.y, 5, {
            color: this.color,
            spread: 8,
            decay: 0.05
        });

        if (this.health <= 0) {
            this.destroy();
        }
    }

    destroy() {
        this.active = false;
        this.game.addScore(this.score);
        this.game.enemiesDestroyed++;
        this.game.player.specialCharge = Math.min(
            this.game.player.maxSpecialCharge,
            this.game.player.specialCharge + 5
        );

        // Explosion
        this.game.particles.explosion(this.x, this.y, this.color, 40);

        // Power-up drop chance
        if (Math.random() < CONFIG.POWERUP_CHANCE) {
            this.game.powerups.push(new PowerUp(this.x, this.y));
        }
    }

    draw(ctx) {
        const imgName = `enemy${this.type.charAt(0).toUpperCase() + this.type.slice(1)}`;
        const img = this.game.assets.get(imgName);

        ctx.save();

        // Health bar
        if (this.health < this.maxHealth) {
            const barWidth = this.width;
            const barHeight = 4;
            const healthPercent = this.health / this.maxHealth;

            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.fillRect(this.x - barWidth / 2, this.y - this.height / 2 - 10, barWidth, barHeight);
            ctx.fillStyle = this.color;
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 5;
            ctx.fillRect(this.x - barWidth / 2, this.y - this.height / 2 - 10, barWidth * healthPercent, barHeight);
        }

        if (img) {
            ctx.drawImage(img, this.x - this.width / 2, this.y - this.height / 2, this.width, this.height);
        } else {
            this.drawFallback(ctx);
        }

        ctx.restore();
    }

    drawFallback(ctx) {
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 15;

        // Different shapes for different types
        switch (this.type) {
            case 'scout':
                ctx.beginPath();
                ctx.moveTo(this.x, this.y + this.height / 2);
                ctx.lineTo(this.x - this.width / 2, this.y - this.height / 2);
                ctx.lineTo(this.x + this.width / 2, this.y - this.height / 2);
                ctx.closePath();
                ctx.fill();
                break;
            case 'fighter':
                ctx.beginPath();
                ctx.moveTo(this.x, this.y + this.height / 2);
                ctx.lineTo(this.x - this.width / 2, this.y);
                ctx.lineTo(this.x - this.width / 3, this.y - this.height / 2);
                ctx.lineTo(this.x + this.width / 3, this.y - this.height / 2);
                ctx.lineTo(this.x + this.width / 2, this.y);
                ctx.closePath();
                ctx.fill();
                break;
            case 'bomber':
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.width / 2, 0, Math.PI * 2);
                ctx.fill();
                break;
        }
    }
}

// Power-Up
class PowerUp extends Entity {
    constructor(x, y) {
        super(x, y, 30, 30);
        this.type = CONFIG.POWERUP_TYPES[Math.floor(Math.random() * CONFIG.POWERUP_TYPES.length)];
        this.vy = 2;
        this.pulse = 0;

        this.colors = {
            rapidfire: '#ff6600',
            multishot: '#00ff88',
            shield: '#00f5ff',
            nuke: '#ff00ff'
        };
        this.icons = {
            rapidfire: '⚡',
            multishot: '⋯',
            shield: '🛡',
            nuke: '💥'
        };
    }

    update() {
        this.y += this.vy;
        this.pulse += 0.1;

        if (this.y > CONFIG.HEIGHT + 50) {
            this.active = false;
        }
    }

    draw(ctx) {
        ctx.save();

        const scale = 1 + Math.sin(this.pulse) * 0.1;
        const color = this.colors[this.type];

        // Glow
        ctx.shadowColor = color;
        ctx.shadowBlur = 20;

        // Outer ring
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.width / 2 * scale, 0, Math.PI * 2);
        ctx.stroke();

        // Inner fill
        ctx.fillStyle = color + '40';
        ctx.fill();

        // Icon
        ctx.fillStyle = color;
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.icons[this.type], this.x, this.y);

        ctx.restore();
    }
}

// ==========================================
// STAR BACKGROUND
// ==========================================
class StarField {
    constructor() {
        this.stars = [];
        this.init();
    }

    init() {
        for (let i = 0; i < 150; i++) {
            this.stars.push({
                x: Math.random() * CONFIG.WIDTH,
                y: Math.random() * CONFIG.HEIGHT,
                size: Math.random() * 2 + 0.5,
                speed: Math.random() * 2 + 0.5,
                brightness: Math.random()
            });
        }
    }

    update() {
        this.stars.forEach(star => {
            star.y += star.speed;
            if (star.y > CONFIG.HEIGHT) {
                star.y = 0;
                star.x = Math.random() * CONFIG.WIDTH;
            }
            star.brightness += (Math.random() - 0.5) * 0.1;
            star.brightness = Math.max(0.3, Math.min(1, star.brightness));
        });
    }

    draw(ctx) {
        this.stars.forEach(star => {
            ctx.save();
            ctx.globalAlpha = star.brightness;
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = 3;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
    }

    resize() {
        this.stars.forEach(star => {
            if (star.x > CONFIG.WIDTH) star.x = Math.random() * CONFIG.WIDTH;
            if (star.y > CONFIG.HEIGHT) star.y = Math.random() * CONFIG.HEIGHT;
        });
    }
}

// ==========================================
// MAIN GAME CLASS
// ==========================================
class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.assets = new AssetManager();

        // Game state
        this.state = 'menu'; // menu, playing, paused, gameover
        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('neonFuryHighScore')) || 0;
        this.wave = 1;
        this.enemiesDestroyed = 0;
        this.bestCombo = 1;
        this.combo = 1;
        this.lastKillTime = 0;

        // Entities
        this.player = null;
        this.enemies = [];
        this.bullets = [];
        this.powerups = [];
        this.particles = new ParticleSystem();
        this.starfield = new StarField();

        // Spawning
        this.lastSpawn = 0;
        this.enemiesInWave = 0;
        this.enemiesSpawnedInWave = 0;
        this.waveTransition = false;

        // Effects
        this.screenShake = 0;
        this.screenFlash = 0;

        // Input
        this.keys = {
            up: false,
            down: false,
            left: false,
            right: false,
            fire: false,
            special: false
        };

        // Timing
        this.lastTime = 0;
        this.deltaTime = 0;

        // UI Elements
        this.scoreEl = document.getElementById('score');
        this.comboEl = document.getElementById('combo');
        this.waveEl = document.getElementById('wave-number');
        this.healthFill = document.getElementById('health-fill');
        this.powerIcons = document.getElementById('power-icons');

        this.init();
    }

    async init() {
        this.setupCanvas();
        await this.assets.loadAll();
        this.setupEventListeners();
        this.gameLoop(0);
    }

    setupCanvas() {
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        CONFIG.WIDTH = window.innerWidth;
        CONFIG.HEIGHT = window.innerHeight;
        this.canvas.width = CONFIG.WIDTH;
        this.canvas.height = CONFIG.HEIGHT;
        this.starfield.resize();
    }

    setupEventListeners() {
        // Keyboard
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));

        // Buttons
        document.getElementById('start-btn').addEventListener('click', () => this.startGame());
        document.getElementById('resume-btn').addEventListener('click', () => this.resumeGame());
        document.getElementById('quit-btn').addEventListener('click', () => this.quitToMenu());
        document.getElementById('restart-btn').addEventListener('click', () => this.startGame());
        document.getElementById('menu-btn').addEventListener('click', () => this.quitToMenu());
    }

    handleKeyDown(e) {
        switch (e.code) {
            case 'ArrowUp':
            case 'KeyW':
                this.keys.up = true;
                break;
            case 'ArrowDown':
            case 'KeyS':
                this.keys.down = true;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                this.keys.left = true;
                break;
            case 'ArrowRight':
            case 'KeyD':
                this.keys.right = true;
                break;
            case 'Space':
                e.preventDefault();
                this.keys.fire = true;
                break;
            case 'ShiftLeft':
            case 'ShiftRight':
                this.keys.special = true;
                break;
            case 'Escape':
                if (this.state === 'playing') this.pauseGame();
                else if (this.state === 'paused') this.resumeGame();
                break;
        }
    }

    handleKeyUp(e) {
        switch (e.code) {
            case 'ArrowUp':
            case 'KeyW':
                this.keys.up = false;
                break;
            case 'ArrowDown':
            case 'KeyS':
                this.keys.down = false;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                this.keys.left = false;
                break;
            case 'ArrowRight':
            case 'KeyD':
                this.keys.right = false;
                break;
            case 'Space':
                this.keys.fire = false;
                break;
            case 'ShiftLeft':
            case 'ShiftRight':
                this.keys.special = false;
                break;
        }
    }

    startGame() {
        this.state = 'playing';
        this.score = 0;
        this.wave = 1;
        this.combo = 1;
        this.bestCombo = 1;
        this.enemiesDestroyed = 0;
        this.enemiesInWave = CONFIG.WAVE_ENEMY_BASE;
        this.enemiesSpawnedInWave = 0;
        this.waveTransition = false;

        this.player = new Player(this);
        this.enemies = [];
        this.bullets = [];
        this.powerups = [];
        this.particles.clear();

        this.hideAllOverlays();
        this.updateHUD();
    }

    pauseGame() {
        this.state = 'paused';
        document.getElementById('pause-screen').classList.remove('hidden');
    }

    resumeGame() {
        this.state = 'playing';
        document.getElementById('pause-screen').classList.add('hidden');
    }

    quitToMenu() {
        this.state = 'menu';
        this.hideAllOverlays();
        document.getElementById('start-screen').classList.remove('hidden');
    }

    gameOver() {
        this.state = 'gameover';

        // Update high score
        const isNewHighScore = this.score > this.highScore;
        if (isNewHighScore) {
            this.highScore = this.score;
            localStorage.setItem('neonFuryHighScore', this.highScore);
        }

        // Update stats
        document.getElementById('final-score').textContent = this.score.toLocaleString();
        document.getElementById('enemies-destroyed').textContent = this.enemiesDestroyed;
        document.getElementById('highest-wave').textContent = this.wave;
        document.getElementById('best-combo').textContent = `x${this.bestCombo}`;

        // Show high score badge
        const highscoreDisplay = document.getElementById('highscore-display');
        if (isNewHighScore) {
            highscoreDisplay.classList.remove('hidden');
        } else {
            highscoreDisplay.classList.add('hidden');
        }

        document.getElementById('gameover-screen').classList.remove('hidden');
    }

    hideAllOverlays() {
        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('pause-screen').classList.add('hidden');
        document.getElementById('gameover-screen').classList.add('hidden');
    }

    addScore(points) {
        const now = Date.now();

        // Update combo
        if (now - this.lastKillTime < CONFIG.COMBO_TIMEOUT) {
            this.combo++;
            this.bestCombo = Math.max(this.bestCombo, this.combo);
        } else {
            this.combo = 1;
        }
        this.lastKillTime = now;

        // Add score with combo multiplier
        this.score += points * this.combo;
    }

    spawnEnemy() {
        if (this.waveTransition) return;

        if (this.enemiesSpawnedInWave >= this.enemiesInWave) {
            // Wave complete, check if all enemies destroyed
            if (this.enemies.length === 0) {
                this.nextWave();
            }
            return;
        }

        // Determine enemy type based on wave
        let type = 'scout';
        const rand = Math.random();

        if (this.wave >= 3) {
            if (rand < 0.2) type = 'bomber';
            else if (rand < 0.5) type = 'fighter';
        } else if (this.wave >= 2) {
            if (rand < 0.3) type = 'fighter';
        }

        const x = Math.random() * (CONFIG.WIDTH - 100) + 50;
        const y = -50;

        this.enemies.push(new Enemy(this, type, x, y));
        this.enemiesSpawnedInWave++;
    }

    nextWave() {
        this.waveTransition = true;
        this.wave++;
        this.enemiesInWave = CONFIG.WAVE_ENEMY_BASE + (this.wave - 1) * CONFIG.WAVE_ENEMY_INCREMENT;
        this.enemiesSpawnedInWave = 0;

        // Short delay before next wave
        setTimeout(() => {
            this.waveTransition = false;
        }, CONFIG.WAVE_DELAY);

        // Bonus health on wave complete
        this.player.heal(20);
    }

    checkCollisions() {
        // Player bullets vs enemies
        this.bullets.forEach(bullet => {
            if (!bullet.isPlayer || !bullet.active) return;

            this.enemies.forEach(enemy => {
                if (!enemy.active) return;

                if (bullet.collidesWith(enemy)) {
                    bullet.active = false;
                    enemy.takeDamage(bullet.damage);
                }
            });
        });

        // Enemy bullets vs player
        this.bullets.forEach(bullet => {
            if (bullet.isPlayer || !bullet.active) return;

            if (bullet.collidesWith(this.player)) {
                bullet.active = false;
                this.player.takeDamage(bullet.damage);
            }
        });

        // Player vs enemies
        this.enemies.forEach(enemy => {
            if (!enemy.active) return;

            if (this.player.collidesWith(enemy)) {
                this.player.takeDamage(30);
                enemy.takeDamage(50);
            }
        });

        // Player vs power-ups
        this.powerups.forEach(powerup => {
            if (!powerup.active) return;

            if (this.player.collidesWith(powerup)) {
                powerup.active = false;
                this.player.addPowerup(powerup.type);

                // Pickup effect
                this.particles.emit(powerup.x, powerup.y, 20, {
                    color: powerup.colors[powerup.type],
                    spread: 15,
                    decay: 0.03
                });
            }
        });
    }

    updateHUD() {
        this.scoreEl.textContent = this.score.toLocaleString();
        this.comboEl.textContent = `x${this.combo}`;
        this.waveEl.textContent = this.wave;

        // Health bar
        const healthPercent = (this.player.health / this.player.maxHealth) * 100;
        this.healthFill.style.width = `${healthPercent}%`;

        if (healthPercent <= 30) {
            this.healthFill.classList.add('low');
        } else {
            this.healthFill.classList.remove('low');
        }

        // Power-up icons
        let iconsHtml = '';
        if (this.player.powerups.rapidfire > Date.now()) {
            iconsHtml += '<span class="power-icon" style="border-color:#ff6600;background:rgba(255,102,0,0.2)">⚡</span>';
        }
        if (this.player.powerups.multishot > Date.now()) {
            iconsHtml += '<span class="power-icon" style="border-color:#00ff88;background:rgba(0,255,136,0.2)">⋯</span>';
        }
        if (this.player.powerups.shield > Date.now()) {
            iconsHtml += '<span class="power-icon" style="border-color:#00f5ff;background:rgba(0,245,255,0.2)">🛡</span>';
        }
        if (this.player.specialCharge >= this.player.maxSpecialCharge) {
            iconsHtml += '<span class="power-icon" style="border-color:#ff00ff;background:rgba(255,0,255,0.2);animation:pulse 0.5s infinite alternate">💥</span>';
        }
        this.powerIcons.innerHTML = iconsHtml;
    }

    update(deltaTime) {
        if (this.state !== 'playing') {
            this.starfield.update();
            return;
        }

        // Update player
        this.player.update(this.keys, deltaTime);

        // Spawn enemies
        const now = Date.now();
        const spawnRate = Math.max(500, CONFIG.ENEMY_SPAWN_RATE - this.wave * 100);
        if (now - this.lastSpawn > spawnRate) {
            this.spawnEnemy();
            this.lastSpawn = now;
        }

        // Update entities
        this.enemies.forEach(e => e.update(deltaTime));
        this.bullets.forEach(b => b.update());
        this.powerups.forEach(p => p.update());

        // Remove inactive entities
        this.enemies = this.enemies.filter(e => e.active);
        this.bullets = this.bullets.filter(b => b.active);
        this.powerups = this.powerups.filter(p => p.active);

        // Check collisions
        this.checkCollisions();

        // Update effects
        this.particles.update();
        this.starfield.update();

        // Decay screen effects
        if (this.screenShake > 0) this.screenShake *= 0.9;
        if (this.screenFlash > 0) this.screenFlash -= 0.05;

        // Update HUD
        this.updateHUD();
    }

    draw() {
        const ctx = this.ctx;

        // Apply screen shake
        ctx.save();
        if (this.screenShake > 0.5) {
            ctx.translate(
                (Math.random() - 0.5) * this.screenShake,
                (Math.random() - 0.5) * this.screenShake
            );
        }

        // Clear canvas
        ctx.fillStyle = '#0a0015';
        ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);

        // Draw gradient background
        const gradient = ctx.createLinearGradient(0, 0, 0, CONFIG.HEIGHT);
        gradient.addColorStop(0, '#0a0015');
        gradient.addColorStop(0.3, '#1a0030');
        gradient.addColorStop(0.6, '#0f0025');
        gradient.addColorStop(1, '#050010');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);

        // Draw star field
        this.starfield.draw(ctx);

        // Draw grid lines (subtle parallax effect)
        this.drawGrid(ctx);

        if (this.state === 'playing' || this.state === 'paused') {
            // Draw game entities
            this.powerups.forEach(p => p.draw(ctx));
            this.bullets.forEach(b => b.draw(ctx));
            this.enemies.forEach(e => e.draw(ctx));
            this.player.draw(ctx);
            this.particles.draw(ctx);
        }

        // Screen flash effect
        if (this.screenFlash > 0) {
            ctx.fillStyle = `rgba(0, 245, 255, ${this.screenFlash * 0.3})`;
            ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
        }

        ctx.restore();
    }

    drawGrid(ctx) {
        ctx.save();
        ctx.strokeStyle = 'rgba(139, 0, 255, 0.1)';
        ctx.lineWidth = 1;

        const gridSize = 100;
        const offset = (Date.now() * 0.02) % gridSize;

        // Horizontal lines
        for (let y = offset; y < CONFIG.HEIGHT; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(CONFIG.WIDTH, y);
            ctx.stroke();
        }

        // Vertical lines with perspective
        const horizon = CONFIG.HEIGHT * 0.3;
        for (let x = 0; x < CONFIG.WIDTH; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(CONFIG.WIDTH / 2, horizon);
            ctx.lineTo(x, CONFIG.HEIGHT);
            ctx.stroke();
        }

        ctx.restore();
    }

    gameLoop(timestamp) {
        this.deltaTime = timestamp - this.lastTime;
        this.lastTime = timestamp;

        this.update(this.deltaTime);
        this.draw();

        requestAnimationFrame((t) => this.gameLoop(t));
    }
}

// ==========================================
// INITIALIZE GAME
// ==========================================
window.addEventListener('load', () => {
    new Game();
});
