export class AudioManager {
    constructor(context) {
        this.context = context;
        this.buffers = {};
        this.bgmSource = null;
        this.masterGain = context.createGain();
        this.masterGain.connect(context.destination);
        this.masterGain.gain.value = 0.5;
    }

    async loadSound(name, url) {
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
            this.buffers[name] = audioBuffer;
        } catch (e) {
            console.error(`Failed to load sound: ${name}`, e);
        }
    }

    playSfx(name, pitch = 1.0) {
        if (!this.buffers[name]) return;
        const source = this.context.createBufferSource();
        source.buffer = this.buffers[name];
        source.playbackRate.value = pitch;
        source.connect(this.masterGain);
        source.start(0);
    }

    playBgm(name) {
        if (!this.buffers[name]) return;
        if (this.bgmSource) this.bgmSource.stop();
        
        this.bgmSource = this.context.createBufferSource();
        this.bgmSource.buffer = this.buffers[name];
        this.bgmSource.loop = true;
        this.bgmSource.connect(this.masterGain);
        this.bgmSource.start(0);
    }
}