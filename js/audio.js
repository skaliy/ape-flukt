// Audio Manager - Synthesized sounds using Web Audio API
const AudioManager = {
    audioContext: null,
    muted: false,
    volume: 0.5,
    initialized: false,

    init() {
        if (this.initialized) return;

        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.muted = localStorage.getItem('audioMuted') === 'true';
            this.initialized = true;
        } catch (e) {
            console.warn('Web Audio API not supported');
        }
    },

    resume() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    },

    setMute(muted) {
        this.muted = muted;
        localStorage.setItem('audioMuted', muted);
    },

    toggleMute() {
        this.setMute(!this.muted);
        return this.muted;
    },

    play(soundName) {
        if (!this.initialized || this.muted || !this.audioContext) return;

        this.resume();

        switch (soundName) {
            case 'collect':
                this.playCollect();
                break;
            case 'gameover':
                this.playGameOver();
                break;
            case 'levelComplete':
                this.playLevelComplete();
                break;
            case 'freezeTrap':
                this.playFreezeTrap();
                break;
            case 'trollFreeze':
                this.playTrollFreeze();
                break;
        }
    },

    // Banana collection - cheerful rising tone
    playCollect() {
        const ctx = this.audioContext;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(523, now); // C5
        osc.frequency.exponentialRampToValueAtTime(784, now + 0.1); // G5

        gain.gain.setValueAtTime(this.volume * 0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.15);
    },

    // Game over - descending ominous tone
    playGameOver() {
        const ctx = this.audioContext;
        const now = ctx.currentTime;

        // Main descending tone
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();

        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(440, now);
        osc1.frequency.exponentialRampToValueAtTime(110, now + 0.5);

        gain1.gain.setValueAtTime(this.volume * 0.2, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

        osc1.connect(gain1);
        gain1.connect(ctx.destination);

        osc1.start(now);
        osc1.stop(now + 0.5);

        // Second tone for depth
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(220, now);
        osc2.frequency.exponentialRampToValueAtTime(55, now + 0.6);

        gain2.gain.setValueAtTime(this.volume * 0.15, now);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

        osc2.connect(gain2);
        gain2.connect(ctx.destination);

        osc2.start(now);
        osc2.stop(now + 0.6);
    },

    // Level complete - victory fanfare
    playLevelComplete() {
        const ctx = this.audioContext;
        const now = ctx.currentTime;

        const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
        const durations = [0.1, 0.1, 0.1, 0.3];
        let time = now;

        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, time);

            gain.gain.setValueAtTime(this.volume * 0.2, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + durations[i]);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(time);
            osc.stop(time + durations[i] + 0.05);

            time += durations[i];
        });
    },

    // Freeze trap placed - ice crackle
    playFreezeTrap() {
        const ctx = this.audioContext;
        const now = ctx.currentTime;

        // White noise burst for crackle effect
        const bufferSize = ctx.sampleRate * 0.15;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(3000, now);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(this.volume * 0.3, now);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        noise.start(now);
    },

    // Troll frozen - crystalline shatter
    playTrollFreeze() {
        const ctx = this.audioContext;
        const now = ctx.currentTime;

        // High shimmer tone
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.exponentialRampToValueAtTime(2400, now + 0.05);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.2);

        gain.gain.setValueAtTime(this.volume * 0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.25);

        // Ice crackle overlay
        const bufferSize = ctx.sampleRate * 0.2;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(4000, now);

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(this.volume * 0.2, now);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(ctx.destination);

        noise.start(now);
    }
};

// Initialize on first user interaction (required for mobile)
['click', 'touchstart', 'keydown'].forEach(event => {
    document.addEventListener(event, function initAudio() {
        AudioManager.init();
        document.removeEventListener(event, initAudio);
    }, { once: true });
});
