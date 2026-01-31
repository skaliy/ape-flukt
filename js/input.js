// Keyboard input handling
const keys = {
    up: false,
    down: false,
    left: false,
    right: false,
    shift: false,
    space: false,
    l: false
};

// Mouse input handling
const mouse = {
    x: 0,
    y: 0,
    active: false,
    clicking: false
};

// Touch/joystick input handling
const touch = {
    active: false,
    joystickActive: false,
    joystickX: 0,
    joystickY: 0,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    isSprinting: false,
    isMobile: false,
    lastTapTime: 0,
    doubleTap: false
};

// Detect mobile device
touch.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || ('ontouchstart' in window)
    || (navigator.maxTouchPoints > 0);

// Get canvas for input calculation
const gameCanvas = document.getElementById('gameCanvas');

// Mouse events (desktop)
gameCanvas.addEventListener('mousemove', (e) => {
    if (touch.isMobile) return;
    const rect = gameCanvas.getBoundingClientRect();
    const scaleX = gameCanvas.width / rect.width;
    const scaleY = gameCanvas.height / rect.height;
    mouse.x = (e.clientX - rect.left) * scaleX;
    mouse.y = (e.clientY - rect.top) * scaleY;
    mouse.active = true;
});

gameCanvas.addEventListener('mousedown', (e) => {
    if (touch.isMobile) return;
    mouse.clicking = true;
    mouse.active = true;
});

gameCanvas.addEventListener('mouseup', (e) => {
    if (touch.isMobile) return;
    mouse.clicking = false;
});

gameCanvas.addEventListener('mouseleave', () => {
    if (touch.isMobile) return;
    mouse.active = false;
    mouse.clicking = false;
});

gameCanvas.addEventListener('mouseenter', (e) => {
    if (touch.isMobile) return;
    const rect = gameCanvas.getBoundingClientRect();
    const scaleX = gameCanvas.width / rect.width;
    const scaleY = gameCanvas.height / rect.height;
    mouse.x = (e.clientX - rect.left) * scaleX;
    mouse.y = (e.clientY - rect.top) * scaleY;
});

// Touch events (mobile) - no sprint button, sprint is automatic when joystick is fully pushed
gameCanvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const rect = gameCanvas.getBoundingClientRect();
    const scaleX = gameCanvas.width / rect.width;
    const scaleY = gameCanvas.height / rect.height;

    // Detect double-tap for bomb placement
    const now = Date.now();
    if (now - touch.lastTapTime < 300) {
        touch.doubleTap = true;
        // Trigger space key for bomb (will be handled by game.js)
        keys.space = true;
        setTimeout(() => { keys.space = false; }, 100);
    }
    touch.lastTapTime = now;

    for (let i = 0; i < e.touches.length; i++) {
        const touchPoint = e.touches[i];
        const x = (touchPoint.clientX - rect.left) * scaleX;
        const y = (touchPoint.clientY - rect.top) * scaleY;

        // Start joystick anywhere on screen
        touch.active = true;
        touch.joystickActive = true;
        touch.startX = x;
        touch.startY = y;
        touch.currentX = x;
        touch.currentY = y;
    }

    // Also activate space for menu/restart (only on first tap, not double tap)
    // Don't trigger space during name entry or menu (buttons handle those)
    if (!touch.doubleTap && typeof gameState !== 'undefined') {
        // Skip space trigger on enterName (submit/skip buttons handle it)
        const skipStates = ['enterName'];
        if (!skipStates.includes(gameState.status)) {
            keys.space = true;
            setTimeout(() => { keys.space = false; }, 100);
        }
    }
    touch.doubleTap = false;
}, { passive: false });

gameCanvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const rect = gameCanvas.getBoundingClientRect();
    const scaleX = gameCanvas.width / rect.width;
    const scaleY = gameCanvas.height / rect.height;

    for (let i = 0; i < e.touches.length; i++) {
        const touchPoint = e.touches[i];
        const x = (touchPoint.clientX - rect.left) * scaleX;
        const y = (touchPoint.clientY - rect.top) * scaleY;

        if (touch.joystickActive) {
            touch.currentX = x;
            touch.currentY = y;

            // Calculate joystick direction
            const s = window.gameScale || 1;
            const dx = touch.currentX - touch.startX;
            const dy = touch.currentY - touch.startY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const maxDistance = 70 * s;
            const sprintThreshold = 55 * s; // Sprint when pushed past this distance

            if (distance > 0) {
                const clampedDistance = Math.min(distance, maxDistance);
                touch.joystickX = (dx / distance) * (clampedDistance / maxDistance);
                touch.joystickY = (dy / distance) * (clampedDistance / maxDistance);

                // Auto-sprint when joystick is pushed far enough
                touch.isSprinting = distance >= sprintThreshold;
            }
        }
    }
}, { passive: false });

gameCanvas.addEventListener('touchend', (e) => {
    e.preventDefault();

    // When all touches end, reset everything
    if (e.touches.length === 0) {
        touch.active = false;
        touch.joystickActive = false;
        touch.joystickX = 0;
        touch.joystickY = 0;
        touch.isSprinting = false;
    }
    // If there are still touches, keep joystick active
}, { passive: false });

gameCanvas.addEventListener('touchcancel', (e) => {
    touch.active = false;
    touch.joystickActive = false;
    touch.joystickX = 0;
    touch.joystickY = 0;
    touch.isSprinting = false;
});

// Keyboard events
document.addEventListener('keydown', (e) => {
    // Don't capture game keys during name entry (let game.js handle it)
    if (typeof gameState !== 'undefined' && gameState.status === 'enterName') {
        return;
    }

    switch(e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
            keys.up = true;
            e.preventDefault();
            break;
        case 'ArrowDown':
        case 's':
        case 'S':
            keys.down = true;
            e.preventDefault();
            break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
            keys.left = true;
            e.preventDefault();
            break;
        case 'ArrowRight':
        case 'd':
        case 'D':
            keys.right = true;
            e.preventDefault();
            break;
        case 'Shift':
            keys.shift = true;
            break;
        case ' ':
            keys.space = true;
            e.preventDefault();
            break;
        case 'm':
        case 'M':
            if (typeof AudioManager !== 'undefined') {
                AudioManager.toggleMute();
            }
            break;
        case 'l':
        case 'L':
            keys.l = true;
            break;
    }
});

document.addEventListener('keyup', (e) => {
    switch(e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
            keys.up = false;
            break;
        case 'ArrowDown':
        case 's':
        case 'S':
            keys.down = false;
            break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
            keys.left = false;
            break;
        case 'ArrowRight':
        case 'd':
        case 'D':
            keys.right = false;
            break;
        case 'Shift':
            keys.shift = false;
            break;
        case ' ':
            keys.space = false;
            break;
        case 'l':
        case 'L':
            keys.l = false;
            break;
    }
});
