// Main game logic
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Responsive canvas and scaling
let gameScale = 1;
let isPortraitMode = false;

// Base dimensions - will swap for portrait mode on mobile
const DESKTOP_WIDTH = 1100;
const DESKTOP_HEIGHT = 750;
const MOBILE_WIDTH = 400;
const MOBILE_HEIGHT = 700;

function resizeCanvas() {
    const container = document.getElementById('gameContainer');
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        || ('ontouchstart' in window)
        || (navigator.maxTouchPoints > 0);

    const padding = isMobile ? 4 : 10;
    const availableWidth = container.clientWidth - padding;
    const availableHeight = window.innerHeight - padding;

    let width, height, baseWidth, baseHeight;

    if (isMobile) {
        // Use portrait dimensions for mobile
        isPortraitMode = true;
        baseWidth = MOBILE_WIDTH;
        baseHeight = MOBILE_HEIGHT;
        const aspectRatio = baseWidth / baseHeight;

        // Try to fill width first
        width = availableWidth;
        height = width / aspectRatio;

        // If too tall, constrain by height
        if (height > availableHeight) {
            height = availableHeight;
            width = height * aspectRatio;
        }
    } else {
        // Desktop: landscape mode
        isPortraitMode = false;
        baseWidth = DESKTOP_WIDTH;
        baseHeight = DESKTOP_HEIGHT;
        const aspectRatio = baseWidth / baseHeight;

        width = Math.min(availableWidth, baseWidth);
        height = width / aspectRatio;

        if (height > availableHeight) {
            height = availableHeight;
            width = height * aspectRatio;
        }
    }

    // Minimum size for playability
    width = Math.max(width, 280);
    height = width / (baseWidth / baseHeight);

    canvas.width = Math.floor(width);
    canvas.height = Math.floor(height);
    gameScale = width / baseWidth;
    window.gameScale = gameScale;
    window.isPortraitMode = isPortraitMode;
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Expose gameScale globally for entities
window.gameScale = gameScale;

// Level configuration (slower trolls)
const LEVELS = [
    { trollCount: 1, trollSpeed: 1.3, prediction: 0 },
    { trollCount: 1, trollSpeed: 1.5, prediction: 5 },
    { trollCount: 2, trollSpeed: 1.6, prediction: 8 },
    { trollCount: 2, trollSpeed: 1.8, prediction: 10 },
    { trollCount: 3, trollSpeed: 1.9, prediction: 12 },
    { trollCount: 3, trollSpeed: 2.1, prediction: 15 },
];

// Level themes with unique backgrounds
const LEVEL_THEMES = [
    { name: 'Skog', sky: ['#87CEEB', '#98FB98', '#228B22'], ground: '#2d5a27', trees: ['🌳', '🌲', '🌳'] },
    { name: 'Strand', sky: ['#FFD89B', '#87CEEB', '#F4D03F'], ground: '#C2B280', trees: ['🌴', '🏖️', '🌴'] },
    { name: 'Fjell', sky: ['#A9C9FF', '#D4E5FF', '#808080'], ground: '#5D5D5D', trees: ['🏔️', '⛰️', '🗻'] },
    { name: 'Natt', sky: ['#0F0C29', '#302B63', '#24243E'], ground: '#1a1a2e', trees: ['🌙', '⭐', '🌟'] },
    { name: 'Solnedgang', sky: ['#FF512F', '#F09819', '#DD2476'], ground: '#4a3728', trees: ['🌅', '🌄', '🏞️'] },
    { name: 'Vinter', sky: ['#E0EAFC', '#CFDEF3', '#FFFFFF'], ground: '#E8E8E8', trees: ['🎄', '❄️', '⛄'] },
];

const BANANAS_REQUIRED = 10;

// Game state
const gameState = {
    status: 'menu', // 'menu', 'playing', 'levelComplete', 'gameover'
    score: 0,
    time: 0,
    level: 1,
    bananasCollected: 0,
    highScore: parseInt(localStorage.getItem('apeFlukt_highScore')) || 0,
    invincibleTimer: 0,
    particles: [],
    screenShake: 0,
    freezeTraps: [],
    trapsRemaining: 3
};

// Game objects
let monkey = null;
let trolls = [];
let bananas = [];

// Initialize game objects
function initGame() {
    monkey = new Monkey(canvas.width / 2, canvas.height / 2);
    loadLevel(gameState.level);
}

function loadLevel(levelNum) {
    const s = gameScale;
    const levelIndex = Math.min(levelNum - 1, LEVELS.length - 1);
    const level = LEVELS[levelIndex];

    // Reset monkey position
    monkey.reset(canvas.width / 2, canvas.height / 2);

    // Create trolls - spawn at edges scaled to canvas size
    trolls = [];
    const spawnDistance = Math.min(canvas.width, canvas.height) * 0.42;
    for (let i = 0; i < level.trollCount; i++) {
        const angle = (i / level.trollCount) * Math.PI * 2;
        const spawnX = canvas.width / 2 + Math.cos(angle) * spawnDistance;
        const spawnY = canvas.height / 2 + Math.sin(angle) * spawnDistance;
        const troll = new Troll(spawnX, spawnY);
        troll.speed = level.trollSpeed;
        troll.predictionFactor = level.prediction;
        trolls.push(troll);
    }

    // Create bananas (they will avoid spawning near trolls)
    bananas = [];
    for (let i = 0; i < 4; i++) {
        const banana = new Banana(canvas, [...trolls, monkey]);
        bananas.push(banana);
    }

    gameState.bananasCollected = 0;
    gameState.time = 0;
    gameState.invincibleTimer = 120; // 2 seconds of invincibility at level start
    gameState.particles = [];
    gameState.screenShake = 0;
    gameState.freezeTraps = [];
    gameState.trapsRemaining = 3;
}

function startGame() {
    gameState.status = 'playing';
    gameState.score = 0;
    gameState.level = 1;
    initGame();
}

function nextLevel() {
    gameState.level++;
    gameState.status = 'playing';
    loadLevel(gameState.level);
}

function saveHighScore() {
    if (gameState.score > gameState.highScore) {
        gameState.highScore = gameState.score;
        localStorage.setItem('apeFlukt_highScore', gameState.highScore);
        return true;
    }
    return false;
}

// Particle system for visual effects
function createParticles(x, y, emoji, count = 5) {
    const s = gameScale;
    for (let i = 0; i < count; i++) {
        gameState.particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 8 * s,
            vy: (Math.random() - 0.5) * 8 * s - 2 * s,
            life: 60,
            emoji: emoji,
            size: (18 + Math.random() * 12) * s
        });
    }
}

function updateParticles() {
    const s = gameScale;
    gameState.particles = gameState.particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15 * s; // gravity scaled
        p.life--;
        p.size *= 0.97;
        return p.life > 0;
    });
}

// Freeze trap placement function
function placeFreezeTrap() {
    if (gameState.status !== 'playing') return;
    if (gameState.trapsRemaining <= 0) return;

    // Create freeze trap at monkey's position
    const trap = new FreezeTrap(monkey.x, monkey.y);
    gameState.freezeTraps.push(trap);
    gameState.trapsRemaining--;

    // Visual feedback
    createParticles(monkey.x, monkey.y, '🧊', 3);
}

// Update freeze traps and check collisions with trolls
function updateFreezeTraps() {
    // Update all traps and remove inactive ones
    gameState.freezeTraps = gameState.freezeTraps.filter(trap => {
        // Check if any troll touches the trap (triggers freeze)
        if (!trap.triggered) {
            for (const troll of trolls) {
                if (trap.touchesEntity(troll)) {
                    trap.trigger();
                    troll.freeze(180); // Freeze for 3 seconds
                    createParticles(troll.x, troll.y, '❄️', 8);
                    createParticles(troll.x, troll.y, '🧊', 4);
                    break;
                }
            }
        }

        return trap.update();
    });
}

// Update game logic
function update(dt) {
    if (gameState.status === 'playing') {
        // Update timer
        gameState.time += dt / 1000;

        // Update invincibility
        if (gameState.invincibleTimer > 0) {
            gameState.invincibleTimer--;
        }

        // Update screen shake
        if (gameState.screenShake > 0) {
            gameState.screenShake *= 0.9;
            if (gameState.screenShake < 0.5) gameState.screenShake = 0;
        }

        // Score based on time survived
        gameState.score = Math.floor(gameState.time * 10) + (gameState.level - 1) * 500;

        // Update monkey (pass touch input for mobile)
        monkey.update(keys, canvas, mouse, touch);

        // Update trolls
        trolls.forEach(troll => troll.update(monkey, canvas));

        // Update bananas
        bananas.forEach(banana => banana.update());

        // Update particles
        updateParticles();

        // Update freeze traps
        updateFreezeTraps();

        // Check banana collection
        bananas.forEach(banana => {
            if (!banana.collected && circleCollision(monkey, banana)) {
                // Visual feedback before collecting (use old position)
                createParticles(banana.x, banana.y, '✨', 8);
                createParticles(banana.x, banana.y, '🍌', 3);
                // Update entities reference and collect
                banana.setEntities([...trolls, monkey]);
                banana.collect();
                gameState.score += 100;
                gameState.bananasCollected++;
            }
        });

        // Check collision with trolls (only if not invincible)
        if (gameState.invincibleTimer <= 0) {
            for (const troll of trolls) {
                if (circleCollision(monkey, troll)) {
                    gameState.status = 'gameover';
                    gameState.screenShake = 20;
                    createParticles(monkey.x, monkey.y, '💥', 10);
                    saveHighScore();
                    return;
                }
            }
        }

        // Check level completion - collect 10 bananas to win
        if (gameState.bananasCollected >= BANANAS_REQUIRED) {
            gameState.score += 500; // Level completion bonus
            gameState.status = 'levelComplete';
            createParticles(canvas.width / 2, canvas.height / 2, '🎉', 20);
        }
    }
}

// Draw functions
function drawBackground() {
    const s = gameScale;

    // Get current theme
    const themeIndex = Math.min(gameState.level - 1, LEVEL_THEMES.length - 1);
    const theme = LEVEL_THEMES[themeIndex];

    // Apply screen shake
    if (gameState.screenShake > 0) {
        ctx.save();
        ctx.translate(
            (Math.random() - 0.5) * gameState.screenShake * s,
            (Math.random() - 0.5) * gameState.screenShake * s
        );
    }

    // Sky gradient based on theme
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, theme.sky[0]);
    gradient.addColorStop(0.5, theme.sky[1]);
    gradient.addColorStop(1, theme.sky[2]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Ground
    const groundHeight = 40 * s;
    ctx.fillStyle = theme.ground;
    ctx.fillRect(0, canvas.height - groundHeight, canvas.width, groundHeight);

    // Decorative elements at bottom - scale count and size
    const treeSize = Math.max(24, 40 * s);
    const treeCount = Math.max(8, Math.floor(canvas.width / (60 * s)));
    const treeSpacing = canvas.width / treeCount;

    ctx.font = `${treeSize}px Arial`;
    ctx.textAlign = 'center';
    for (let i = 0; i < treeCount; i++) {
        ctx.fillText(theme.trees[i % 3], i * treeSpacing + treeSpacing / 2, canvas.height - groundHeight * 0.25);
    }

    if (gameState.screenShake > 0) {
        ctx.restore();
    }
}

// Draw particles
function drawParticles() {
    gameState.particles.forEach(p => {
        ctx.globalAlpha = p.life / 60;
        ctx.font = `${p.size}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.emoji, p.x, p.y);
    });
    ctx.globalAlpha = 1;
}

// Draw touch controls for mobile
function drawTouchControls() {
    if (!touch.isMobile) return;

    const s = gameScale;
    const mobileBoost = isPortraitMode ? 1.6 : 1.3;

    ctx.save();


    // Mobile hint text (show briefly at start)
    if (gameState.time < 3) {
        ctx.globalAlpha = Math.max(0, 1 - gameState.time / 3);
        ctx.font = `bold ${Math.max(12, 16 * s)}px Arial`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText('Dra for å bevege - dra langt for sprint', canvas.width / 2, canvas.height - 40 * s);
    }

    ctx.restore();
}

function drawUI() {
    const s = gameScale;

    // Get theme name
    const themeIndex = Math.min(gameState.level - 1, LEVEL_THEMES.length - 1);
    const theme = LEVEL_THEMES[themeIndex];

    // Score
    ctx.fillStyle = 'white';
    ctx.font = `bold ${Math.max(18, 24 * s)}px Arial`;
    ctx.textAlign = 'left';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 4 * s;
    ctx.fillText(`⭐ ${gameState.score}`, 15 * s, 35 * s);

    // Level with theme name
    ctx.textAlign = 'center';
    ctx.fillText(`Nivå ${gameState.level}: ${theme.name}`, canvas.width / 2, 35 * s);

    // Banana progress bar
    ctx.shadowBlur = 0;
    const progressWidth = 160 * s;
    const progressHeight = 22 * s;
    const progressX = canvas.width - progressWidth - 15 * s;
    const progressY = 15 * s;

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.roundRect(progressX, progressY, progressWidth, progressHeight, 10 * s);
    ctx.fill();

    // Progress fill
    const progress = gameState.bananasCollected / BANANAS_REQUIRED;
    ctx.fillStyle = progress >= 1 ? '#FFD700' : '#FFA500';
    ctx.beginPath();
    ctx.roundRect(progressX + 2 * s, progressY + 2 * s, (progressWidth - 4 * s) * Math.min(progress, 1), progressHeight - 4 * s, 8 * s);
    ctx.fill();

    // Banana icon and text
    ctx.fillStyle = 'white';
    ctx.font = `bold ${Math.max(12, 14 * s)}px Arial`;
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 2 * s;
    ctx.fillText(`🍌 ${gameState.bananasCollected}/${BANANAS_REQUIRED}`, progressX + progressWidth / 2, progressY + progressHeight * 0.7);

    // High score
    ctx.font = `${Math.max(12, 14 * s)}px Arial`;
    ctx.textAlign = 'left';
    ctx.shadowBlur = 4 * s;
    ctx.fillText(`Rekord: ${gameState.highScore}`, 15 * s, 60 * s);

    // Invincibility indicator
    if (gameState.invincibleTimer > 0) {
        ctx.font = `bold ${Math.max(14, 16 * s)}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#00FF00';
        const pulse = Math.sin(Date.now() / 100) * 0.3 + 0.7;
        ctx.globalAlpha = pulse;
        ctx.fillText('🛡️ USYNLIG', canvas.width / 2, 60 * s);
        ctx.globalAlpha = 1;
    }

    // Stamina bar
    ctx.shadowBlur = 0;
    const barWidth = 130 * s;
    const barHeight = 8 * s;
    const barX = canvas.width - barWidth - 15 * s;
    const barY = 45 * s;

    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    const staminaPercent = monkey.stamina / monkey.maxStamina;
    ctx.fillStyle = staminaPercent > 0.3 ? '#4CAF50' : '#FF5722';
    ctx.fillRect(barX, barY, barWidth * staminaPercent, barHeight);

    ctx.strokeStyle = '#555';
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    ctx.font = `${Math.max(10, 11 * s)}px Arial`;
    ctx.fillStyle = 'white';
    ctx.textAlign = 'right';
    ctx.fillText('Sprint', barX - 4 * s, barY + barHeight * 0.85);

    // Freeze trap count display
    ctx.font = `bold ${Math.max(14, 18 * s)}px Arial`;
    ctx.textAlign = 'left';
    ctx.fillStyle = gameState.trapsRemaining > 0 ? '#87CEEB' : '#666';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 4 * s;
    ctx.fillText(`🧊 ${gameState.trapsRemaining}`, 15 * s, 85 * s);

    // Hint for freeze trap use (brief)
    if (gameState.time < 6 && gameState.trapsRemaining > 0) {
        ctx.font = `${Math.max(10, 12 * s)}px Arial`;
        ctx.fillStyle = '#aaa';
        ctx.globalAlpha = Math.max(0, 1 - gameState.time / 6);
        ctx.fillText(touch.isMobile ? 'Dobbelt-trykk = frys-felle' : 'SPACE = frys-felle', 15 * s, 100 * s);
        ctx.globalAlpha = 1;
    }
    ctx.shadowBlur = 0;
}

function drawMenu() {
    drawBackground();

    const s = gameScale;
    const portrait = isPortraitMode;

    // Darken overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 6 * s;

    // Responsive font sizes - bigger for portrait mode
    const isMobile = touch.isMobile;
    const titleSize = Math.max(24, (portrait ? 32 : (isMobile ? 42 : 52)) * s);
    const subtitleSize = Math.max(14, (portrait ? 16 : (isMobile ? 18 : 22)) * s);
    const textSize = Math.max(12, (portrait ? 13 : (isMobile ? 14 : 18)) * s);
    const promptSize = Math.max(16, (portrait ? 18 : (isMobile ? 20 : 26)) * s);

    // Title - position based on mode
    ctx.fillStyle = 'white';
    ctx.font = `bold ${titleSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText('🐵 APE-FLUKT 👹', canvas.width / 2, canvas.height * (portrait ? 0.12 : 0.18));

    // Subtitle
    ctx.font = `${subtitleSize}px Arial`;
    ctx.fillStyle = '#FFD700';
    ctx.fillText('Rømm fra trollet!', canvas.width / 2, canvas.height * (portrait ? 0.18 : 0.26));

    // Instructions - different layout for portrait
    ctx.font = `${textSize}px Arial`;
    ctx.fillStyle = 'white';

    if (portrait) {
        ctx.fillText('👆 Dra for å bevege', canvas.width / 2, canvas.height * 0.28);
        ctx.fillText('🏃 Dra langt = sprint', canvas.width / 2, canvas.height * 0.34);
        ctx.fillText('🍌 Samle 10 bananer!', canvas.width / 2, canvas.height * 0.40);
        ctx.fillText('👹 Unngå trollet!', canvas.width / 2, canvas.height * 0.46);
    } else if (isMobile) {
        ctx.fillText('👆 Dra fingeren for å bevege', canvas.width / 2, canvas.height * 0.38);
        ctx.fillText('🏃 Dra langt = sprint', canvas.width / 2, canvas.height * 0.46);
        ctx.fillText('🍌 Samle 10 bananer!', canvas.width / 2, canvas.height * 0.54);
        ctx.fillText('👹 Unngå trollet!', canvas.width / 2, canvas.height * 0.62);
    } else {
        ctx.fillText('🖱️ Mus = Apen følger pekeren', canvas.width / 2, canvas.height * 0.36);
        ctx.fillText('⬆️⬇️⬅️➡️ eller WASD = Tastaturkontroll', canvas.width / 2, canvas.height * 0.43);
        ctx.fillText('🖱️ Klikk / SHIFT = Sprint', canvas.width / 2, canvas.height * 0.50);
        ctx.fillText('🍌 Samle 10 bananer for å fullføre!', canvas.width / 2, canvas.height * 0.57);
        ctx.fillText('👹 Unngå trollet!', canvas.width / 2, canvas.height * 0.64);
    }

    // High score
    if (gameState.highScore > 0) {
        ctx.fillStyle = '#FFD700';
        ctx.fillText(`🏆 Rekord: ${gameState.highScore}`, canvas.width / 2, canvas.height * (portrait ? 0.54 : 0.72));
    }

    // Start prompt
    ctx.font = `bold ${promptSize}px Arial`;
    ctx.fillStyle = '#4CAF50';
    const pulse = Math.sin(Date.now() / 300) * 0.3 + 0.7;
    ctx.globalAlpha = pulse;
    ctx.fillText('Trykk for å starte', canvas.width / 2, canvas.height * (portrait ? 0.65 : 0.84));
    ctx.globalAlpha = 1;

    ctx.shadowBlur = 0;
}

function drawLevelComplete() {
    drawBackground();

    const s = gameScale;
    const portrait = isPortraitMode;

    // Draw particles
    drawParticles();

    // Draw game objects faded
    ctx.globalAlpha = 0.3;
    bananas.forEach(b => b.draw(ctx));
    monkey.draw(ctx);
    trolls.forEach(t => t.draw(ctx, null));
    ctx.globalAlpha = 1;

    // Overlay
    ctx.fillStyle = 'rgba(0, 100, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 6 * s;

    // Title
    ctx.fillStyle = '#FFD700';
    ctx.font = `bold ${Math.max(22, (portrait ? 28 : 48) * s)}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText(portrait ? '🎉 FULLFØRT! 🎉' : '🎉 NIVÅ FULLFØRT! 🎉', canvas.width / 2, canvas.height * (portrait ? 0.15 : 0.22));

    // Current theme
    const currentTheme = LEVEL_THEMES[Math.min(gameState.level - 1, LEVEL_THEMES.length - 1)];
    ctx.font = `${Math.max(14, (portrait ? 16 : 22) * s)}px Arial`;
    ctx.fillStyle = 'white';
    ctx.fillText(`${currentTheme.name} fullført!`, canvas.width / 2, canvas.height * (portrait ? 0.22 : 0.32));

    // Stats
    ctx.font = `${Math.max(16, (portrait ? 18 : 26) * s)}px Arial`;
    ctx.fillText(`Poeng: ${gameState.score}`, canvas.width / 2, canvas.height * (portrait ? 0.30 : 0.42));

    // Next level preview
    const nextThemeIndex = Math.min(gameState.level, LEVEL_THEMES.length - 1);
    const nextTheme = LEVEL_THEMES[nextThemeIndex];
    const nextLevel = LEVELS[Math.min(gameState.level, LEVELS.length - 1)];

    ctx.fillStyle = '#87CEEB';
    ctx.font = `${Math.max(12, (portrait ? 14 : 20) * s)}px Arial`;
    ctx.fillText(`Neste: Nivå ${gameState.level + 1} - ${nextTheme.name}`, canvas.width / 2, canvas.height * (portrait ? 0.40 : 0.52));
    ctx.font = `${Math.max(11, (portrait ? 12 : 16) * s)}px Arial`;
    ctx.fillStyle = '#FFB6C1';
    ctx.fillText(`${nextLevel.trollCount} troll`, canvas.width / 2, canvas.height * (portrait ? 0.45 : 0.58));

    // Next level prompt
    ctx.font = `bold ${Math.max(16, (portrait ? 16 : 22) * s)}px Arial`;
    ctx.fillStyle = '#4CAF50';
    const pulse = Math.sin(Date.now() / 300) * 0.3 + 0.7;
    ctx.globalAlpha = pulse;
    ctx.fillText('Trykk for å fortsette', canvas.width / 2, canvas.height * (portrait ? 0.55 : 0.72));
    ctx.globalAlpha = 1;

    ctx.shadowBlur = 0;
}

function drawGameOver() {
    const s = gameScale;

    // Apply screen shake
    if (gameState.screenShake > 0) {
        ctx.save();
        ctx.translate(
            (Math.random() - 0.5) * gameState.screenShake * s,
            (Math.random() - 0.5) * gameState.screenShake * s
        );
    }

    drawBackground();

    // Draw particles
    drawParticles();

    // Draw game objects faded
    ctx.globalAlpha = 0.3;
    bananas.forEach(b => b.draw(ctx));
    monkey.draw(ctx);
    trolls.forEach(t => t.draw(ctx, null));
    ctx.globalAlpha = 1;

    if (gameState.screenShake > 0) {
        ctx.restore();
    }

    // Red overlay
    ctx.fillStyle = 'rgba(139, 0, 0, 0.75)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 6 * s;

    // Title
    ctx.fillStyle = 'white';
    ctx.font = `bold ${Math.max(28, 48 * s)}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText('💀 TATT! 💀', canvas.width / 2, canvas.height * 0.22);

    // Current theme
    const theme = LEVEL_THEMES[Math.min(gameState.level - 1, LEVEL_THEMES.length - 1)];

    // Stats
    ctx.font = `${Math.max(16, 24 * s)}px Arial`;
    ctx.fillText(`Sluttpoeng: ${gameState.score}`, canvas.width / 2, canvas.height * 0.34);
    ctx.fillText(`🍌 Bananer: ${gameState.bananasCollected}/${BANANAS_REQUIRED}`, canvas.width / 2, canvas.height * 0.42);
    ctx.fillText(`Nivå ${gameState.level}: ${theme.name}`, canvas.width / 2, canvas.height * 0.50);

    // New high score?
    if (gameState.score === gameState.highScore && gameState.score > 0) {
        ctx.fillStyle = '#FFD700';
        ctx.font = `bold ${Math.max(20, 28 * s)}px Arial`;
        ctx.fillText('🏆 NY REKORD! 🏆', canvas.width / 2, canvas.height * 0.60);
    }

    // Restart prompt
    ctx.font = `bold ${Math.max(18, 22 * s)}px Arial`;
    ctx.fillStyle = '#4CAF50';
    const pulse = Math.sin(Date.now() / 300) * 0.3 + 0.7;
    ctx.globalAlpha = pulse;
    ctx.fillText(touch.isMobile ? 'Trykk for å prøve igjen' : 'Trykk SPACE for å prøve igjen', canvas.width / 2, canvas.height * 0.75);
    ctx.globalAlpha = 1;

    ctx.shadowBlur = 0;
}

function drawPlaying() {
    drawBackground();

    const s = gameScale;

    // Draw bananas
    bananas.forEach(b => b.draw(ctx));

    // Draw monkey (blink when invincible)
    if (gameState.invincibleTimer > 0) {
        const blink = Math.sin(Date.now() / 50) > 0;
        if (blink) {
            ctx.globalAlpha = 0.5;
            monkey.draw(ctx);
            ctx.globalAlpha = 1;
            // Draw shield effect
            ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
            ctx.lineWidth = 3 * s;
            ctx.beginPath();
            ctx.arc(monkey.x, monkey.y, monkey.radius + 8 * s, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            monkey.draw(ctx);
        }
    } else {
        monkey.draw(ctx);
    }

    // Draw trolls (with danger glow)
    trolls.forEach(t => t.draw(ctx, monkey));

    // Draw freeze traps
    gameState.freezeTraps.forEach(trap => trap.draw(ctx));

    // Draw particles
    drawParticles();

    // Draw touch controls for mobile
    drawTouchControls();

    // Draw UI
    drawUI();
}

// Main render function
function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    switch (gameState.status) {
        case 'menu':
            drawMenu();
            break;
        case 'playing':
            drawPlaying();
            break;
        case 'levelComplete':
            drawLevelComplete();
            break;
        case 'gameover':
            drawGameOver();
            break;
    }
}

// Handle space key for state transitions and bombs
let spaceWasPressed = false;
function handleInput() {
    if (keys.space && !spaceWasPressed) {
        spaceWasPressed = true;
        switch (gameState.status) {
            case 'menu':
                startGame();
                break;
            case 'playing':
                // Space places freeze trap during gameplay
                placeFreezeTrap();
                break;
            case 'levelComplete':
                nextLevel();
                break;
            case 'gameover':
                gameState.status = 'menu';
                break;
        }
    }
    if (!keys.space) {
        spaceWasPressed = false;
    }
}

// Main game loop
let lastTime = 0;
function gameLoop(timestamp) {
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;

    handleInput();
    update(deltaTime);
    render();

    requestAnimationFrame(gameLoop);
}

// Start the game
initGame();
requestAnimationFrame(gameLoop);
