/* Matrix Rain Canvas */
const canvas = document.getElementById('matrixCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const Katakana = 'ABDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const fontSize = 16;
const columns = canvas.width / fontSize;
const drops = Array(Math.floor(columns)).fill(1);

function drawMatrix() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#0F0';
    ctx.font = fontSize + 'px monospace';

    for (let i = 0; i < drops.length; i++) {
        const text = Katakana.charAt(Math.floor(Math.random() * Katakana.length));
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);

        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975)
            drops[i] = 0;

        drops[i]++;
    }
}
setInterval(drawMatrix, 50);
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

/* GAME LOGIC */

let money = 0;
let clickPower = 1;
let autoRate = 0;
let tabState = 'hardware'; // hardware | software

// UPGRADES DB
const SOFTWARE = [
    { id: 's1', name: 'Script Kiddie', desc: '+1 Click Power', baseCost: 15, costMult: 1.5, benefit: 1, count: 0, type: 'click' },
    { id: 's2', name: 'SQL Injection', desc: '+5 Click Power', baseCost: 100, costMult: 1.4, benefit: 5, count: 0, type: 'click' },
    { id: 's3', name: 'Zero-Day Exploit', desc: '+25 Click Power', baseCost: 500, costMult: 1.4, benefit: 25, count: 0, type: 'click' },
    { id: 's4', name: 'AI Assistant', desc: '+100 Click Power', baseCost: 2500, costMult: 1.4, benefit: 100, count: 0, type: 'click' }
];

const HARDWARE = [
    { id: 'h1', name: 'Old Laptop', desc: '+1 $/sec', baseCost: 25, costMult: 1.2, benefit: 1, count: 0, type: 'auto' },
    { id: 'h2', name: 'Desktop PC', desc: '+5 $/sec', baseCost: 150, costMult: 1.25, benefit: 5, count: 0, type: 'auto' },
    { id: 'h3', name: 'Server Rack', desc: '+20 $/sec', baseCost: 1000, costMult: 1.3, benefit: 20, count: 0, type: 'auto' },
    { id: 'h4', name: 'Botnet Node', desc: '+80 $/sec', baseCost: 5000, costMult: 1.35, benefit: 80, count: 0, type: 'auto' },
    { id: 'h5', name: 'Quantum Mainframe', desc: '+500 $/sec', baseCost: 25000, costMult: 1.4, benefit: 500, count: 0, type: 'auto' }
];

// --- CORE FUNCTIONS ---

function updateDisplay() {
    document.getElementById('display-money').innerText = '$' + Math.floor(money).toLocaleString();
    document.getElementById('display-rate').innerText = autoRate.toLocaleString() + ' /s';
    document.getElementById('click-val').innerText = clickPower.toLocaleString();

    // Update Shop Buttons State
    updateShopUI();
}

function log(msg, type = 'norm') {
    const box = document.getElementById('log-display');
    const div = document.createElement('div');
    div.className = `log-line ${type}`;
    div.innerText = `> ${msg}`;
    box.appendChild(div);
    if (box.children.length > 8) box.removeChild(box.firstChild); // Keep log short
}

// Click Logic
document.getElementById('hack-btn').addEventListener('mousedown', () => {
    addMoney(clickPower);
    log(`Executed hack. Gained $${clickPower}`, 'earn');
});

// Passive Income
setInterval(() => {
    if (autoRate > 0) {
        addMoney(autoRate);
    }
}, 1000);

function addMoney(amount) {
    money += amount;
    updateDisplay();
}

// --- SHOP SYSTEM ---

function getCost(item) {
    return Math.floor(item.baseCost * Math.pow(item.costMult, item.count));
}

function buyItem(listType, index) {
    const list = listType === 'hardware' ? HARDWARE : SOFTWARE;
    const item = list[index];
    const cost = getCost(item);

    if (money >= cost) {
        money -= cost;
        item.count++;

        if (item.type === 'click') {
            clickPower += item.benefit;
            log(`Installed ${item.name}. Click Power +${item.benefit}`, 'buy');
        } else {
            autoRate += item.benefit;
            log(`Purchased ${item.name}. Rate +${item.benefit}/s`, 'buy');
        }

        renderShop(); // Re-render to update costs
        updateDisplay();
    } else {
        log("Access Denied. Insufficient Protocol Credits.", 'err');
    }
}

// UI RENDERING

function switchTab(tab) {
    tabState = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    renderShop();
}
window.switchTab = switchTab; // Expose

function renderShop() {
    const container = document.getElementById('shop-container');
    container.innerHTML = '';

    const list = tabState === 'hardware' ? HARDWARE : SOFTWARE;

    list.forEach((item, index) => {
        const cost = getCost(item);
        const div = document.createElement('div');
        div.className = 'shop-item';
        if (money < cost) div.classList.add('disabled');

        div.innerHTML = `
            <div>
                <div class="item-name">${item.name}</div>
                <div class="item-benefit">${item.desc}</div>
            </div>
            <div style="text-align:right;">
                <div class="item-cost">$${cost.toLocaleString()}</div>
            </div>
            <div class="item-count">${item.count}</div>
        `;

        div.addEventListener('click', () => buyItem(tabState, index));
        container.appendChild(div);
    });
}

function updateShopUI() {
    // Only update enabled/disabled state to avoid full re-render flicker
    const items = document.querySelectorAll('.shop-item');
    const list = tabState === 'hardware' ? HARDWARE : SOFTWARE;

    items.forEach((div, i) => {
        const cost = getCost(list[i]);
        if (money < cost) div.classList.add('disabled');
        else div.classList.remove('disabled');

        // Update cost text just in case (e.g. after buy)
        div.querySelector('.item-cost').innerText = '$' + cost.toLocaleString();
    });
}

// Init
renderShop();
updateDisplay();
log("Target IP acquired.");
