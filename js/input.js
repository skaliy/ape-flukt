// Keyboard input handling
const keys = {
    up: false,
    down: false,
    left: false,
    right: false,
    shift: false,
    space: false
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
    isMobile: false
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

// Helper function to get sprint button zone size (synced with drawTouchControls)
function getSprintZoneSize() {
    const s = window.gameScale || 1;
    const mobileBoost = 1.3;
    const sprintRadius = 50 * s * mobileBoost;
    const sprintMargin = 20 * s;
    // Make touch zone slightly larger than visual button for easier tapping
    return (sprintRadius + sprintMargin) * 1.2;
}

// Touch events (mobile)
gameCanvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const rect = gameCanvas.getBoundingClientRect();
    const scaleX = gameCanvas.width / rect.width;
    const scaleY = gameCanvas.height / rect.height;

    for (let i = 0; i < e.touches.length; i++) {
        const touchPoint = e.touches[i];
        const x = (touchPoint.clientX - rect.left) * scaleX;
        const y = (touchPoint.clientY - rect.top) * scaleY;

        // Check if touching sprint button area (bottom right) - scaled zone
        const sprintZone = getSprintZoneSize();
        if (x > gameCanvas.width - sprintZone && y > gameCanvas.height - sprintZone) {
            touch.isSprinting = true;
        } else {
            // Start joystick
            touch.active = true;
            touch.joystickActive = true;
            touch.startX = x;
            touch.startY = y;
            touch.currentX = x;
            touch.currentY = y;
        }
    }

    // Also activate space for menu/restart
    keys.space = true;
    setTimeout(() => { keys.space = false; }, 100);
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

        // Check if this touch is on sprint button - scaled zone
        const sprintZone = getSprintZoneSize();
        if (x > gameCanvas.width - sprintZone && y > gameCanvas.height - sprintZone) {
            touch.isSprinting = true;
        } else if (touch.joystickActive) {
            touch.currentX = x;
            touch.currentY = y;

            // Calculate joystick direction - scaled max distance
            const s = window.gameScale || 1;
            const dx = touch.currentX - touch.startX;
            const dy = touch.currentY - touch.startY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const maxDistance = 70 * s;

            if (distance > 0) {
                const clampedDistance = Math.min(distance, maxDistance);
                touch.joystickX = (dx / distance) * (clampedDistance / maxDistance);
                touch.joystickY = (dy / distance) * (clampedDistance / maxDistance);
            }
        }
    }
}, { passive: false });

gameCanvas.addEventListener('touchend', (e) => {
    e.preventDefault();

    // Check remaining touches
    if (e.touches.length === 0) {
        touch.active = false;
        touch.joystickActive = false;
        touch.joystickX = 0;
        touch.joystickY = 0;
        touch.isSprinting = false;
    } else {
        // Check if sprint finger was lifted
        const rect = gameCanvas.getBoundingClientRect();
        const scaleX = gameCanvas.width / rect.width;
        const scaleY = gameCanvas.height / rect.height;

        let sprintTouchFound = false;
        let joystickTouchFound = false;

        const sprintZone = getSprintZoneSize();
        for (let i = 0; i < e.touches.length; i++) {
            const touchPoint = e.touches[i];
            const x = (touchPoint.clientX - rect.left) * scaleX;
            const y = (touchPoint.clientY - rect.top) * scaleY;

            if (x > gameCanvas.width - sprintZone && y > gameCanvas.height - sprintZone) {
                sprintTouchFound = true;
            } else {
                joystickTouchFound = true;
            }
        }

        touch.isSprinting = sprintTouchFound;
        if (!joystickTouchFound) {
            touch.joystickActive = false;
            touch.joystickX = 0;
            touch.joystickY = 0;
        }
    }
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
    }
});
