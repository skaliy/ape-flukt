// Game entities: Monkey, Troll, Banana

class Monkey {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.radius = 30;
        this.speed = 6;
        this.sprintSpeed = 10;
        this.emoji = '🐵';
        this.stamina = 100;
        this.maxStamina = 100;
    }

    update(keys, canvas, mouse, touchInput = null) {
        // Check if using mouse, touch, or keyboard
        const usingMouse = mouse && mouse.active;
        const usingTouch = touchInput && touchInput.joystickActive;
        const hasKeyboardInput = keys.up || keys.down || keys.left || keys.right;

        // Stamina management
        const isSprinting = (touchInput && touchInput.isSprinting) || (mouse && mouse.clicking) || keys.shift;
        if (isSprinting && (hasKeyboardInput || usingMouse || usingTouch)) {
            this.stamina = Math.max(0, this.stamina - 1);
        } else {
            this.stamina = Math.min(this.maxStamina, this.stamina + 0.5);
        }

        const canSprint = isSprinting && this.stamina > 0;
        const currentSpeed = canSprint ? this.sprintSpeed : this.speed;

        let targetVx = 0;
        let targetVy = 0;

        if (usingTouch && !hasKeyboardInput) {
            // Touch joystick movement
            targetVx = touchInput.joystickX * currentSpeed;
            targetVy = touchInput.joystickY * currentSpeed;
        } else if (usingMouse && !hasKeyboardInput && !usingTouch) {
            // Mouse-based movement - move toward cursor
            const dx = mouse.x - this.x;
            const dy = mouse.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Only move if cursor is far enough from monkey (dead zone)
            const deadZone = 10;
            if (distance > deadZone) {
                // Normalize direction and apply speed
                targetVx = (dx / distance) * currentSpeed;
                targetVy = (dy / distance) * currentSpeed;

                // Slow down when getting close to cursor
                if (distance < currentSpeed * 3) {
                    const slowFactor = distance / (currentSpeed * 3);
                    targetVx *= slowFactor;
                    targetVy *= slowFactor;
                }
            }
        } else {
            // Keyboard-based movement
            if (keys.left) targetVx = -currentSpeed;
            if (keys.right) targetVx = currentSpeed;
            if (keys.up) targetVy = -currentSpeed;
            if (keys.down) targetVy = currentSpeed;

            // Normalize diagonal movement
            if (targetVx !== 0 && targetVy !== 0) {
                const factor = 1 / Math.sqrt(2);
                targetVx *= factor;
                targetVy *= factor;
            }
        }

        // Smooth acceleration
        this.vx += (targetVx - this.vx) * 0.3;
        this.vy += (targetVy - this.vy) * 0.3;

        // Apply friction when no input
        if (targetVx === 0) this.vx *= 0.85;
        if (targetVy === 0) this.vy *= 0.85;

        // Update position
        this.x += this.vx;
        this.y += this.vy;

        // Keep in bounds
        this.x = Math.max(this.radius, Math.min(canvas.width - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(canvas.height - this.radius, this.y));
    }

    draw(ctx) {
        ctx.font = `${this.radius * 2}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.emoji, this.x, this.y);
    }

    reset(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.stamina = this.maxStamina;
    }
}

class Troll {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.radius = 35;
        this.speed = 2.5;
        this.emoji = '👹';
        this.predictionFactor = 0;
    }

    update(monkey, canvas) {
        // Predict where monkey will be
        const predictedX = monkey.x + monkey.vx * this.predictionFactor;
        const predictedY = monkey.y + monkey.vy * this.predictionFactor;

        // Calculate direction to predicted position
        const dx = predictedX - this.x;
        const dy = predictedY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Normalize and apply speed
        if (distance > 0) {
            this.vx = (dx / distance) * this.speed;
            this.vy = (dy / distance) * this.speed;
        }

        // Update position
        this.x += this.vx;
        this.y += this.vy;

        // Keep in bounds
        this.x = Math.max(this.radius, Math.min(canvas.width - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(canvas.height - this.radius, this.y));
    }

    draw(ctx, monkey = null) {
        // Calculate danger level based on distance to monkey
        let dangerGlow = 0;
        if (monkey) {
            const dx = this.x - monkey.x;
            const dy = this.y - monkey.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const dangerDistance = 150;
            if (distance < dangerDistance) {
                dangerGlow = 1 - (distance / dangerDistance);
            }
        }

        // Red glow when close to monkey
        if (dangerGlow > 0) {
            ctx.shadowColor = `rgba(255, 0, 0, ${dangerGlow * 0.8})`;
            ctx.shadowBlur = 20 + dangerGlow * 20;
        }

        ctx.font = `${this.radius * 2}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.emoji, this.x, this.y);

        ctx.shadowBlur = 0;
    }

    reset(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
    }
}

class Banana {
    constructor(canvas, otherEntities = []) {
        this.canvas = canvas;
        this.radius = 22;
        this.emoji = '🍌';
        this.collected = false;
        this.otherEntities = otherEntities;
        this.bobOffset = Math.random() * Math.PI * 2; // For floating animation
        this.respawn();
    }

    respawn() {
        const margin = 80;
        let attempts = 0;
        const maxAttempts = 50;

        do {
            this.x = Math.random() * (this.canvas.width - margin * 2) + margin;
            this.y = Math.random() * (this.canvas.height - margin * 2 - 50) + margin; // Avoid ground
            attempts++;
        } while (this.isTooCloseToEntities() && attempts < maxAttempts);

        this.collected = false;
    }

    isTooCloseToEntities() {
        const minDistance = 100;
        for (const entity of this.otherEntities) {
            if (entity && entity.x !== undefined) {
                const dx = this.x - entity.x;
                const dy = this.y - entity.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < minDistance) {
                    return true;
                }
            }
        }
        return false;
    }

    setEntities(entities) {
        this.otherEntities = entities;
    }

    update() {
        // Floating animation
        this.bobOffset += 0.05;
    }

    collect() {
        this.collected = true;
        // Instant respawn at new location
        this.respawn();
    }

    draw(ctx) {
        if (this.collected) return;

        // Floating animation
        const bobY = Math.sin(this.bobOffset) * 5;

        // Glow effect
        ctx.shadowColor = 'rgba(255, 215, 0, 0.6)';
        ctx.shadowBlur = 15;

        ctx.font = `${this.radius * 2}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.emoji, this.x, this.y + bobY);

        ctx.shadowBlur = 0;
    }
}

// Collision detection utility
function circleCollision(obj1, obj2) {
    const dx = obj1.x - obj2.x;
    const dy = obj1.y - obj2.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < (obj1.radius + obj2.radius);
}
