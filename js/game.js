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
    status: 'menu', // 'menu', 'playing', 'levelComplete', 'gameover', 'leaderboard', 'enterName'
    score: 0,
    time: 0,
    level: 1,
    bananasCollected: 0,
    highScore: parseInt(localStorage.getItem('apeFlukt_highScore')) || 0,
    invincibleTimer: 0,
    particles: [],
    screenShake: 0,
    freezeTraps: [],
    trapsRemaining: 3,
    // Leaderboard state
    pendingScoreSubmit: false,
    submittedRank: null,
    playerNameInput: ''
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

    // Visual and audio feedback
    createParticles(monkey.x, monkey.y, '🧊', 3);
    AudioManager.play('freezeTrap');
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
                    AudioManager.play('trollFreeze');
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
                AudioManager.play('collect');
            }
        });

        // Check collision with trolls (only if not invincible)
        if (gameState.invincibleTimer <= 0) {
            for (const troll of trolls) {
                if (circleCollision(monkey, troll)) {
                    gameState.screenShake = 20;
                    createParticles(monkey.x, monkey.y, '💥', 10);
                    AudioManager.play('gameover');
                    saveHighScore();
                    // Go to name entry for leaderboard
                    gameState.status = 'enterName';
                    gameState.playerNameInput = LeaderboardManager.playerName || '';
                    gameState.submittedRank = null;
                    return;
                }
            }
        }

        // Check level completion - collect 10 bananas to win
        if (gameState.bananasCollected >= BANANAS_REQUIRED) {
            gameState.score += 500; // Level completion bonus
            gameState.status = 'levelComplete';
            createParticles(canvas.width / 2, canvas.height / 2, '🎉', 20);
            AudioManager.play('levelComplete');
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

    // Audio mute indicator
    if (typeof AudioManager !== 'undefined') {
        ctx.font = `${Math.max(16, 20 * s)}px Arial`;
        ctx.textAlign = 'right';
        ctx.fillStyle = AudioManager.muted ? '#666' : '#fff';
        ctx.fillText(AudioManager.muted ? '🔇' : '🔊', canvas.width - 15 * s, canvas.height - 15 * s);

        // Show hint briefly
        if (gameState.time < 4 && !touch.isMobile) {
            ctx.font = `${Math.max(10, 11 * s)}px Arial`;
            ctx.fillStyle = '#888';
            ctx.globalAlpha = Math.max(0, 1 - gameState.time / 4);
            ctx.fillText('M = lyd', canvas.width - 15 * s, canvas.height - 35 * s);
            ctx.globalAlpha = 1;
        }
    }
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
    ctx.fillText(touch.isMobile ? 'Trykk for å starte' : 'Trykk SPACE for å starte', canvas.width / 2, canvas.height * (portrait ? 0.62 : 0.82));
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
    const portrait = isPortraitMode;

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
    ctx.font = `bold ${Math.max(24, (portrait ? 32 : 48) * s)}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText('💀 TATT! 💀', canvas.width / 2, canvas.height * 0.12);

    // Current theme
    const theme = LEVEL_THEMES[Math.min(gameState.level - 1, LEVEL_THEMES.length - 1)];

    // Stats
    ctx.font = `${Math.max(14, (portrait ? 18 : 24) * s)}px Arial`;
    ctx.fillText(`Sluttpoeng: ${gameState.score}`, canvas.width / 2, canvas.height * 0.22);
    ctx.fillText(`🍌 ${gameState.bananasCollected}/${BANANAS_REQUIRED} | Nivå ${gameState.level}: ${theme.name}`, canvas.width / 2, canvas.height * 0.29);

    // New high score?
    if (gameState.score === gameState.highScore && gameState.score > 0) {
        ctx.fillStyle = '#FFD700';
        ctx.font = `bold ${Math.max(16, (portrait ? 20 : 24) * s)}px Arial`;
        ctx.fillText('🏆 NY REKORD! 🏆', canvas.width / 2, canvas.height * 0.36);
    }

    ctx.shadowBlur = 0;

    // Name input section (for leaderboard)
    if (gameState.status === 'enterName') {
        // Title
        ctx.fillStyle = 'white';
        ctx.font = `bold ${Math.max(14, (portrait ? 18 : 22) * s)}px Arial`;
        ctx.fillText('Legg til navn i topplisten?', canvas.width / 2, canvas.height * 0.44);

        // Input box - larger and more prominent
        const boxWidth = Math.min(260 * s, canvas.width * 0.75);
        const boxHeight = 44 * s;
        const boxX = (canvas.width - boxWidth) / 2;
        const boxY = canvas.height * 0.48;

        // Input box with border
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 10 * s);
        ctx.fill();
        ctx.strokeStyle = '#4CAF50';
        ctx.lineWidth = 2 * s;
        ctx.stroke();

        // Store input box for click detection
        gameState.inputBox = { x: boxX, y: boxY, width: boxWidth, height: boxHeight };

        // Name text or placeholder
        const displayName = gameState.playerNameInput;
        ctx.font = `bold ${Math.max(16, 20 * s)}px Arial`;
        ctx.textAlign = 'center';

        if (displayName) {
            ctx.fillStyle = '#333';
            const cursorBlink = Math.sin(Date.now() / 300) > 0 ? '|' : '';
            ctx.fillText(displayName + cursorBlink, canvas.width / 2, boxY + boxHeight * 0.62);
        } else {
            ctx.fillStyle = '#999';
            ctx.fillText('Skriv navn her...', canvas.width / 2, boxY + boxHeight * 0.62);
        }

        // Buttons - larger and side by side
        const btnWidth = 120 * s;
        const btnHeight = 44 * s;
        const btnGap = 16 * s;
        const totalWidth = btnWidth * 2 + btnGap;
        const startBtnX = (canvas.width - totalWidth) / 2;
        const btnRowY = canvas.height * 0.62;

        // Submit button - green, prominent
        ctx.fillStyle = '#4CAF50';
        ctx.beginPath();
        ctx.roundRect(startBtnX, btnRowY, btnWidth, btnHeight, 8 * s);
        ctx.fill();
        ctx.fillStyle = 'white';
        ctx.font = `bold ${Math.max(14, 16 * s)}px Arial`;
        ctx.fillText('✓ Send', startBtnX + btnWidth / 2, btnRowY + btnHeight * 0.62);

        // Skip button - gray
        const skipBtnX = startBtnX + btnWidth + btnGap;
        ctx.fillStyle = '#666';
        ctx.beginPath();
        ctx.roundRect(skipBtnX, btnRowY, btnWidth, btnHeight, 8 * s);
        ctx.fill();
        ctx.fillStyle = 'white';
        ctx.fillText('✗ Hopp over', skipBtnX + btnWidth / 2, btnRowY + btnHeight * 0.62);

        // Store button positions for click detection
        gameState.submitBtn = { x: startBtnX, y: btnRowY, width: btnWidth, height: btnHeight };
        gameState.skipBtn = { x: skipBtnX, y: btnRowY, width: btnWidth, height: btnHeight };

        // Instructions
        ctx.fillStyle = '#aaa';
        ctx.font = `${Math.max(10, 12 * s)}px Arial`;
        if (touch.isMobile) {
            ctx.fillText('Trykk i boksen for å skrive navn', canvas.width / 2, canvas.height * 0.76);
        } else {
            ctx.fillText('Skriv navn og trykk ENTER, eller ESC for å hoppe over', canvas.width / 2, canvas.height * 0.76);
        }
    } else if (gameState.submittedRank) {
        // Show rank after submission
        ctx.fillStyle = '#87CEEB';
        ctx.font = `bold ${Math.max(16, (portrait ? 20 : 24) * s)}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(`🌍 Du er #${gameState.submittedRank} globalt!`, canvas.width / 2, canvas.height * 0.50);
    } else if (gameState.pendingScoreSubmit) {
        ctx.fillStyle = '#aaa';
        ctx.font = `${Math.max(12, 16 * s)}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText('Sender poeng...', canvas.width / 2, canvas.height * 0.50);
    }

    // Restart prompt
    ctx.font = `bold ${Math.max(14, (portrait ? 16 : 20) * s)}px Arial`;
    ctx.fillStyle = '#4CAF50';
    ctx.textAlign = 'center';
    const pulse = Math.sin(Date.now() / 300) * 0.3 + 0.7;
    ctx.globalAlpha = pulse;
    if (gameState.status !== 'enterName') {
        ctx.fillText(touch.isMobile ? 'Trykk for å prøve igjen' : 'Trykk SPACE for å prøve igjen', canvas.width / 2, canvas.height * 0.80);
    }
    ctx.globalAlpha = 1;
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

// Draw leaderboard screen
function drawLeaderboard() {
    drawBackground();

    const s = gameScale;
    const portrait = isPortraitMode;

    // Darken overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 6 * s;

    // Title
    ctx.fillStyle = '#FFD700';
    ctx.font = `bold ${Math.max(20, (portrait ? 24 : 36) * s)}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText('🏆 TOPPLISTE 🏆', canvas.width / 2, canvas.height * 0.1);

    ctx.shadowBlur = 0;

    // Loading indicator
    if (LeaderboardManager.isLoading) {
        ctx.fillStyle = 'white';
        ctx.font = `${Math.max(14, 18 * s)}px Arial`;
        ctx.fillText('Laster...', canvas.width / 2, canvas.height * 0.5);
    } else if (LeaderboardManager.scores.length === 0) {
        ctx.fillStyle = '#aaa';
        ctx.font = `${Math.max(14, 18 * s)}px Arial`;
        ctx.fillText('Ingen poeng ennå!', canvas.width / 2, canvas.height * 0.4);
        ctx.fillText('Vær den første!', canvas.width / 2, canvas.height * 0.48);
    } else {
        // Draw scores
        const startY = canvas.height * 0.18;
        const rowHeight = (portrait ? 32 : 42) * s;
        const fontSize = Math.max(12, (portrait ? 14 : 18) * s);

        // Header
        ctx.fillStyle = '#888';
        ctx.font = `bold ${Math.max(10, (portrait ? 11 : 14) * s)}px Arial`;
        ctx.textAlign = 'left';
        ctx.fillText('#', canvas.width * 0.1, startY);
        ctx.fillText('NAVN', canvas.width * 0.18, startY);
        ctx.textAlign = 'right';
        ctx.fillText('POENG', canvas.width * 0.75, startY);
        ctx.fillText('NIVÅ', canvas.width * 0.9, startY);

        LeaderboardManager.scores.forEach((entry, index) => {
            const y = startY + (index + 1) * rowHeight;
            const isHighlight = LeaderboardManager.lastSubmittedRank === index + 1;

            // Highlight row for just-submitted score
            if (isHighlight) {
                ctx.fillStyle = 'rgba(255, 215, 0, 0.2)';
                ctx.fillRect(canvas.width * 0.05, y - rowHeight * 0.6, canvas.width * 0.9, rowHeight * 0.9);
            }

            // Rank medal or number
            ctx.font = `bold ${fontSize}px Arial`;
            ctx.textAlign = 'left';
            if (index === 0) {
                ctx.fillStyle = '#FFD700';
                ctx.fillText('🥇', canvas.width * 0.08, y);
            } else if (index === 1) {
                ctx.fillStyle = '#C0C0C0';
                ctx.fillText('🥈', canvas.width * 0.08, y);
            } else if (index === 2) {
                ctx.fillStyle = '#CD7F32';
                ctx.fillText('🥉', canvas.width * 0.08, y);
            } else {
                ctx.fillStyle = '#888';
                ctx.fillText(`${index + 1}`, canvas.width * 0.1, y);
            }

            // Name
            ctx.fillStyle = isHighlight ? '#FFD700' : 'white';
            ctx.font = `${fontSize}px Arial`;
            const displayName = entry.player_name.length > 12
                ? entry.player_name.substring(0, 11) + '…'
                : entry.player_name;
            ctx.fillText(displayName, canvas.width * 0.18, y);

            // Score
            ctx.textAlign = 'right';
            ctx.fillText(entry.score.toLocaleString(), canvas.width * 0.75, y);

            // Level
            ctx.fillStyle = isHighlight ? '#87CEEB' : '#aaa';
            ctx.fillText(entry.level_reached, canvas.width * 0.9, y);
        });
    }

    // Play again button
    ctx.font = `bold ${Math.max(14, (portrait ? 16 : 20) * s)}px Arial`;
    ctx.fillStyle = '#4CAF50';
    ctx.textAlign = 'center';
    const pulse = Math.sin(Date.now() / 300) * 0.3 + 0.7;
    ctx.globalAlpha = pulse;
    ctx.fillText('🎮 Trykk for å spille igjen', canvas.width / 2, canvas.height * 0.92);
    ctx.globalAlpha = 1;
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
        case 'enterName':
            drawGameOver();
            break;
        case 'leaderboard':
            drawLeaderboard();
            break;
    }
}

// Track mute button area for click handling
function checkMuteButtonClick(x, y) {
    const s = gameScale;
    const btnX = canvas.width - 40 * s;
    const btnY = canvas.height - 40 * s;
    const btnSize = 35 * s;

    if (x >= btnX && x <= btnX + btnSize && y >= btnY && y <= btnY + btnSize) {
        if (typeof AudioManager !== 'undefined') {
            AudioManager.toggleMute();
            return true;
        }
    }
    return false;
}

// Check if point is inside a button
function isInsideButton(x, y, btn) {
    if (!btn) return false;
    return x >= btn.x && x <= btn.x + btn.width && y >= btn.y && y <= btn.y + btn.height;
}

// Handle button clicks (works for both mouse and touch)
function handleButtonClick(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    // Name entry: submit and skip buttons
    if (gameState.status === 'enterName') {
        if (isInsideButton(x, y, gameState.submitBtn)) {
            submitScoreWithName();
            return true;
        }
        if (isInsideButton(x, y, gameState.skipBtn)) {
            gameState.playerNameInput = '';
            submitScoreWithName();
            return true;
        }
        // Clicking the input box focuses hidden input to trigger keyboard
        if (isInsideButton(x, y, gameState.inputBox)) {
            focusMobileNameInput();
            return true;
        }
    }

    // Playing: mute button
    if (gameState.status === 'playing') {
        if (checkMuteButtonClick(x, y)) {
            return true;
        }
    }

    return false;
}

// Click listener for desktop
canvas.addEventListener('click', (e) => {
    handleButtonClick(e.clientX, e.clientY);
});

// Touch listener for mobile buttons (touchend to avoid conflicts)
canvas.addEventListener('touchend', (e) => {
    if (gameState.status === 'enterName' && e.changedTouches.length > 0) {
        const touch = e.changedTouches[0];
        if (handleButtonClick(touch.clientX, touch.clientY)) {
            e.preventDefault();
            e.stopPropagation();
        }
    }
}, { passive: false });

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
                gameState.submittedRank = null;
                break;
            case 'leaderboard':
                startGame();
                break;
            case 'enterName':
                // On mobile, focus the hidden input to trigger keyboard
                if (touch.isMobile) {
                    focusMobileNameInput();
                }
                // On desktop, Enter key is handled separately
                break;
        }
    }
    if (!keys.space) {
        spaceWasPressed = false;
    }
}

// Name input handling for leaderboard
function setupNameInput() {
    // Listen for keyboard input during name entry
    window.addEventListener('keydown', (e) => {
        if (gameState.status !== 'enterName') return;

        if (e.key === 'Enter') {
            submitScoreWithName();
            e.preventDefault();
        } else if (e.key === 'Escape') {
            // Skip name entry, submit as Anonymous
            gameState.playerNameInput = '';
            submitScoreWithName();
            e.preventDefault();
        } else if (e.key === 'Backspace') {
            gameState.playerNameInput = gameState.playerNameInput.slice(0, -1);
            e.preventDefault();
        } else if (e.key.length === 1 && gameState.playerNameInput.length < 20) {
            // Add character if it's a printable character
            gameState.playerNameInput += e.key;
            e.preventDefault();
        }
    });
}

// Mobile name input handling using hidden input element
const mobileNameInput = document.getElementById('mobileNameInput');

// Focus the hidden input to trigger mobile keyboard
function focusMobileNameInput() {
    if (!mobileNameInput) return;

    // Set current value
    mobileNameInput.value = gameState.playerNameInput || LeaderboardManager.playerName || '';

    // Position it roughly where the visual input is (helps with some mobile browsers)
    mobileNameInput.style.position = 'absolute';
    mobileNameInput.style.left = '50%';
    mobileNameInput.style.top = '50%';
    mobileNameInput.style.opacity = '0';
    mobileNameInput.style.pointerEvents = 'auto';

    // Focus to trigger keyboard
    mobileNameInput.focus();
}

// Sync hidden input with game state
if (mobileNameInput) {
    mobileNameInput.addEventListener('input', (e) => {
        if (gameState.status === 'enterName') {
            gameState.playerNameInput = e.target.value.substring(0, 20);
        }
    });

    // Handle Enter key on mobile keyboard
    mobileNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && gameState.status === 'enterName') {
            e.preventDefault();
            mobileNameInput.blur();
            submitScoreWithName();
        }
    });

    // When input loses focus, hide it again
    mobileNameInput.addEventListener('blur', () => {
        mobileNameInput.style.pointerEvents = 'none';
    });
}

async function submitScoreWithName() {
    const name = gameState.playerNameInput || LeaderboardManager.playerName || 'Anonymous';
    gameState.pendingScoreSubmit = true;

    try {
        const rank = await LeaderboardManager.submitScore(
            gameState.score,
            gameState.level,
            name
        );
        gameState.submittedRank = rank;
    } catch (err) {
        console.error('Failed to submit score:', err);
        gameState.submittedRank = null;
    }

    gameState.pendingScoreSubmit = false;
    // Show leaderboard after submitting
    gameState.status = 'leaderboard';
    LeaderboardManager.fetchScores();
}

// Initialize name input handling
setupNameInput();

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
