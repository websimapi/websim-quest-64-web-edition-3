import { Game } from './Game.js';

const overlay = document.getElementById('start-overlay');
let game;

// Initialize Audio Context (suspended initially)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

game = new Game(audioCtx);
game.start(); // Starts in AI mode

overlay.addEventListener('click', async () => {
    overlay.style.display = 'none';
    
    // Resume Audio Context on interaction
    if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
    }
    
    game.takeControl();
});

// Handle resize
window.addEventListener('resize', () => {
    if(game) game.onResize();
});