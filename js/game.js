// Main game logic
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Canvas size
canvas.width = 1100;
canvas.height = 750;

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
    screenShake: 0
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
    const levelIndex = Math.min(levelNum - 1, LEVELS.length - 1);
    const level = LEVELS[levelIndex];

    // Reset monkey position
    monkey.reset(canvas.width / 2, canvas.height / 2);

    // Create trolls
    trolls = [];
    for (let i = 0; i < level.trollCount; i++) {
        const angle = (i / level.trollCount) * Math.PI * 2;
        const spawnDistance = 350;
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
    for (let i = 0; i < count; i++) {
        gameState.particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8 - 2,
            life: 60,
            emoji: emoji,
            size: 20 + Math.random() * 15
        });
    }
}

function updateParticles() {
    gameState.particles = gameState.particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2; // gravity
        p.life--;
        p.size *= 0.97;
        return p.life > 0;
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
    // Get current theme
    const themeIndex = Math.min(gameState.level - 1, LEVEL_THEMES.length - 1);
    const theme = LEVEL_THEMES[themeIndex];

    // Apply screen shake
    if (gameState.screenShake > 0) {
        ctx.save();
        ctx.translate(
            (Math.random() - 0.5) * gameState.screenShake,
            (Math.random() - 0.5) * gameState.screenShake
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
    ctx.fillStyle = theme.ground;
    ctx.fillRect(0, canvas.height - 50, canvas.width, 50);

    // Decorative elements at bottom
    ctx.font = '50px Arial';
    ctx.textAlign = 'center';
    for (let i = 0; i < 16; i++) {
        ctx.fillText(theme.trees[i % 3], i * 72 + 36, canvas.height - 12);
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

    ctx.save();

    // Draw joystick base (where touch started)
    if (touch.joystickActive) {
        // Outer circle
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(touch.startX, touch.startY, 70, 0, Math.PI * 2);
        ctx.fill();

        // Direction indicator
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = '#4CAF50';
        const knobX = touch.startX + touch.joystickX * 50;
        const knobY = touch.startY + touch.joystickY * 50;
        ctx.beginPath();
        ctx.arc(knobX, knobY, 35, 0, Math.PI * 2);
        ctx.fill();

        // Inner dot
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(knobX, knobY, 15, 0, Math.PI * 2);
        ctx.fill();
    }

    // Draw sprint button (bottom right)
    const sprintX = canvas.width - 85;
    const sprintY = canvas.height - 85;
    const sprintRadius = 55;

    // Button background
    ctx.globalAlpha = touch.isSprinting ? 0.6 : 0.3;
    ctx.fillStyle = touch.isSprinting ? '#FF5722' : '#ffffff';
    ctx.beginPath();
    ctx.arc(sprintX, sprintY, sprintRadius, 0, Math.PI * 2);
    ctx.fill();

    // Button border
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(sprintX, sprintY, sprintRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Sprint icon
    ctx.globalAlpha = 0.9;
    ctx.font = 'bold 28px Arial';
    ctx.fillStyle = touch.isSprinting ? '#ffffff' : '#333333';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SPRINT', sprintX, sprintY);

    // Mobile hint text (show briefly at start)
    if (gameState.time < 3) {
        ctx.globalAlpha = Math.max(0, 1 - gameState.time / 3);
        ctx.font = 'bold 20px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText('Dra for å bevege', canvas.width / 2, canvas.height - 40);
    }

    ctx.restore();
}

function drawUI() {
    // Get theme name
    const themeIndex = Math.min(gameState.level - 1, LEVEL_THEMES.length - 1);
    const theme = LEVEL_THEMES[themeIndex];

    // Score
    ctx.fillStyle = 'white';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'left';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 4;
    ctx.fillText(`⭐ ${gameState.score}`, 20, 40);

    // Level with theme name
    ctx.textAlign = 'center';
    ctx.fillText(`Nivå ${gameState.level}: ${theme.name}`, canvas.width / 2, 40);

    // Banana progress bar
    ctx.shadowBlur = 0;
    const progressWidth = 180;
    const progressHeight = 24;
    const progressX = canvas.width - progressWidth - 20;
    const progressY = 20;

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.roundRect(progressX, progressY, progressWidth, progressHeight, 12);
    ctx.fill();

    // Progress fill
    const progress = gameState.bananasCollected / BANANAS_REQUIRED;
    ctx.fillStyle = progress >= 1 ? '#FFD700' : '#FFA500';
    ctx.beginPath();
    ctx.roundRect(progressX + 2, progressY + 2, (progressWidth - 4) * Math.min(progress, 1), progressHeight - 4, 10);
    ctx.fill();

    // Banana icon and text
    ctx.fillStyle = 'white';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 2;
    ctx.fillText(`🍌 ${gameState.bananasCollected}/${BANANAS_REQUIRED}`, progressX + progressWidth / 2, progressY + 17);

    // High score
    ctx.font = '16px Arial';
    ctx.textAlign = 'left';
    ctx.shadowBlur = 4;
    ctx.fillText(`Rekord: ${gameState.highScore}`, 20, 70);

    // Invincibility indicator
    if (gameState.invincibleTimer > 0) {
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#00FF00';
        const pulse = Math.sin(Date.now() / 100) * 0.3 + 0.7;
        ctx.globalAlpha = pulse;
        ctx.fillText('🛡️ USYNLIG', canvas.width / 2, 70);
        ctx.globalAlpha = 1;
    }

    // Stamina bar
    ctx.shadowBlur = 0;
    const barWidth = 150;
    const barHeight = 10;
    const barX = canvas.width - barWidth - 20;
    const barY = 55;

    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    const staminaPercent = monkey.stamina / monkey.maxStamina;
    ctx.fillStyle = staminaPercent > 0.3 ? '#4CAF50' : '#FF5722';
    ctx.fillRect(barX, barY, barWidth * staminaPercent, barHeight);

    ctx.strokeStyle = '#555';
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    ctx.font = '12px Arial';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'right';
    ctx.fillText('Sprint', barX - 5, barY + 9);
}

function drawMenu() {
    drawBackground();

    // Darken overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 6;

    // Responsive font sizes
    const isMobile = touch.isMobile;
    const titleSize = isMobile ? 42 : 56;
    const subtitleSize = isMobile ? 20 : 24;
    const textSize = isMobile ? 16 : 20;
    const promptSize = isMobile ? 22 : 28;

    // Title
    ctx.fillStyle = 'white';
    ctx.font = `bold ${titleSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText('🐵 APE-FLUKT 👹', canvas.width / 2, canvas.height * 0.18);

    // Subtitle
    ctx.font = `${subtitleSize}px Arial`;
    ctx.fillStyle = '#FFD700';
    ctx.fillText('Rømm fra trollet!', canvas.width / 2, canvas.height * 0.25);

    // Instructions - different for mobile vs desktop
    ctx.font = `${textSize}px Arial`;
    ctx.fillStyle = 'white';

    if (isMobile) {
        ctx.fillText('👆 Dra fingeren for å bevege apen', canvas.width / 2, canvas.height * 0.38);
        ctx.fillText('🔴 Trykk SPRINT-knappen for fart', canvas.width / 2, canvas.height * 0.45);
        ctx.fillText('🍌 Samle 10 bananer!', canvas.width / 2, canvas.height * 0.52);
        ctx.fillText('👹 Unngå trollet!', canvas.width / 2, canvas.height * 0.59);
    } else {
        ctx.fillText('🖱️ Mus = Apen følger pekeren', canvas.width / 2, canvas.height * 0.35);
        ctx.fillText('⬆️⬇️⬅️➡️ eller WASD = Tastaturkontroll', canvas.width / 2, canvas.height * 0.41);
        ctx.fillText('🖱️ Klikk / SHIFT = Sprint', canvas.width / 2, canvas.height * 0.47);
        ctx.fillText('🍌 Samle 10 bananer for å fullføre nivået!', canvas.width / 2, canvas.height * 0.53);
        ctx.fillText('👹 Unngå trollet!', canvas.width / 2, canvas.height * 0.59);
    }

    // High score
    if (gameState.highScore > 0) {
        ctx.fillStyle = '#FFD700';
        ctx.fillText(`🏆 Rekord: ${gameState.highScore}`, canvas.width / 2, canvas.height * 0.68);
    }

    // Start prompt
    ctx.font = `bold ${promptSize}px Arial`;
    ctx.fillStyle = '#4CAF50';
    const pulse = Math.sin(Date.now() / 300) * 0.3 + 0.7;
    ctx.globalAlpha = pulse;
    ctx.fillText(isMobile ? 'Trykk for å starte' : 'Trykk SPACE for å starte', canvas.width / 2, canvas.height * 0.82);
    ctx.globalAlpha = 1;

    ctx.shadowBlur = 0;
}

function drawLevelComplete() {
    drawBackground();

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
    ctx.shadowBlur = 6;

    // Title
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 56px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🎉 NIVÅ FULLFØRT! 🎉', canvas.width / 2, 180);

    // Current theme
    const currentTheme = LEVEL_THEMES[Math.min(gameState.level - 1, LEVEL_THEMES.length - 1)];
    ctx.font = '24px Arial';
    ctx.fillStyle = 'white';
    ctx.fillText(`${currentTheme.name} fullført!`, canvas.width / 2, 240);

    // Stats
    ctx.font = '28px Arial';
    ctx.fillText(`Poeng: ${gameState.score}`, canvas.width / 2, 300);

    // Next level preview
    const nextThemeIndex = Math.min(gameState.level, LEVEL_THEMES.length - 1);
    const nextTheme = LEVEL_THEMES[nextThemeIndex];
    const nextLevel = LEVELS[Math.min(gameState.level, LEVELS.length - 1)];

    ctx.fillStyle = '#87CEEB';
    ctx.font = '22px Arial';
    ctx.fillText(`Neste: Nivå ${gameState.level + 1} - ${nextTheme.name}`, canvas.width / 2, 360);
    ctx.font = '18px Arial';
    ctx.fillStyle = '#FFB6C1';
    ctx.fillText(`${nextLevel.trollCount} troll${nextLevel.trollCount > 1 ? '' : ''}`, canvas.width / 2, 390);

    // Next level prompt
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = '#4CAF50';
    const pulse = Math.sin(Date.now() / 300) * 0.3 + 0.7;
    ctx.globalAlpha = pulse;
    ctx.fillText(touch.isMobile ? 'Trykk for å fortsette' : 'Trykk SPACE for å fortsette', canvas.width / 2, 460);
    ctx.globalAlpha = 1;

    ctx.shadowBlur = 0;
}

function drawGameOver() {
    // Apply screen shake
    if (gameState.screenShake > 0) {
        ctx.save();
        ctx.translate(
            (Math.random() - 0.5) * gameState.screenShake,
            (Math.random() - 0.5) * gameState.screenShake
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
    ctx.shadowBlur = 6;

    // Title with shake effect
    ctx.fillStyle = 'white';
    ctx.font = 'bold 56px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('💀 TATT! 💀', canvas.width / 2, 180);

    // Current theme
    const theme = LEVEL_THEMES[Math.min(gameState.level - 1, LEVEL_THEMES.length - 1)];

    // Stats
    ctx.font = '28px Arial';
    ctx.fillText(`Sluttpoeng: ${gameState.score}`, canvas.width / 2, 260);
    ctx.fillText(`🍌 Bananer: ${gameState.bananasCollected}/${BANANAS_REQUIRED}`, canvas.width / 2, 305);
    ctx.fillText(`Nivå ${gameState.level}: ${theme.name}`, canvas.width / 2, 350);

    // New high score?
    if (gameState.score === gameState.highScore && gameState.score > 0) {
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 32px Arial';
        ctx.fillText('🏆 NY REKORD! 🏆', canvas.width / 2, 410);
    }

    // Restart prompt
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = '#4CAF50';
    const pulse = Math.sin(Date.now() / 300) * 0.3 + 0.7;
    ctx.globalAlpha = pulse;
    ctx.fillText(touch.isMobile ? 'Trykk for å prøve igjen' : 'Trykk SPACE for å prøve igjen', canvas.width / 2, 480);
    ctx.globalAlpha = 1;

    ctx.shadowBlur = 0;
}

function drawPlaying() {
    drawBackground();

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
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(monkey.x, monkey.y, monkey.radius + 10, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            monkey.draw(ctx);
        }
    } else {
        monkey.draw(ctx);
    }

    // Draw trolls (with danger glow)
    trolls.forEach(t => t.draw(ctx, monkey));

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

// Handle space key for state transitions
let spaceWasPressed = false;
function handleInput() {
    if (keys.space && !spaceWasPressed) {
        spaceWasPressed = true;
        switch (gameState.status) {
            case 'menu':
                startGame();
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
