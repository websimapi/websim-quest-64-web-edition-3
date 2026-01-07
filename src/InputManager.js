import nipplejs from 'nipplejs';

export class InputManager {
    constructor(game, renderer, cameraController) {
        this.game = game;
        this.renderer = renderer;
        this.cameraController = cameraController;

        this.inputState = {
            down: false,
            startX: 0,
            startY: 0,
            lastX: 0,
            lastY: 0,
            isDragging: false,
            startTime: 0
        };

        this.setupJoystick();
        this.setupKeyboard();
        this.setupPointer();
        this.setupSpellButtons();
        this.setupToolbelt();
    }

    setupToolbelt() {
        const container = document.getElementById('toolbelt-container');
        if (!container) return;
        
        let pressTimer = null;
        let isLongPress = false;

        // Disable context menu
        container.addEventListener('contextmenu', e => { 
            e.preventDefault(); 
            e.stopPropagation(); 
            return false; 
        });

        const startPress = (e) => {
            const slot = e.target.closest('.toolbelt-slot');
            if (!slot) return;
            
            e.stopPropagation(); // Stop propagation to game controls
            
            isLongPress = false;
            pressTimer = setTimeout(() => {
                isLongPress = true;
                const idx = parseInt(slot.dataset.slot);
                if (!isNaN(idx)) {
                    this.game.uiManager.openInventory(idx);
                }
            }, 400); // 400ms for long press
        };

        const endPress = (e) => {
            const slot = e.target.closest('.toolbelt-slot');
            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }
            
            if (!slot || isLongPress) return;
            
            // It was a tap
            const idx = parseInt(slot.dataset.slot);
            if (!isNaN(idx)) {
                e.stopPropagation();
                e.preventDefault(); // Prevent ghost clicks
                
                const result = this.game.player.useToolbeltItem(idx);
                if (result.success) {
                    this.game.uiManager.showMessage(`Used ${result.name}`, 1500);
                } else if (result.msg) {
                    this.game.uiManager.showMessage(result.msg, 1000);
                    // Open inventory if empty
                    if (result.msg === "Empty") {
                        this.game.uiManager.openInventory(idx);
                    }
                }
            }
        };

        const cancelPress = () => {
            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }
        };

        // Pointer events cover mouse and touch
        container.addEventListener('pointerdown', startPress);
        container.addEventListener('pointerup', endPress);
        container.addEventListener('pointerleave', cancelPress);
        container.addEventListener('pointercancel', cancelPress);
    }

    setupJoystick() {
        const zone = document.getElementById('zone-nipple');
        if (!zone) return;

        const manager = nipplejs.create({
            zone,
            mode: 'static',
            position: { left: '50%', top: '50%' },
            color: 'white'
        });

        manager.on('move', (evt, data) => {
            const angle = data.angle.radian;
            const force = Math.min(data.force, 1.0);
            this.game.inputs.x = Math.cos(angle) * force;
            this.game.inputs.y = Math.sin(angle) * force;
        });

        manager.on('end', () => {
            this.game.inputs.x = 0;
            this.game.inputs.y = 0;
        });
    }

    setupKeyboard() {
        window.addEventListener('keydown', (e) => {
            if (e.key === 'w') this.game.inputs.y = 1;
            if (e.key === 's') this.game.inputs.y = -1;
            if (e.key === 'a') this.game.inputs.x = -1;
            if (e.key === 'd') this.game.inputs.x = 1;
        });

        window.addEventListener('keyup', (e) => {
            if (['w','s'].includes(e.key)) this.game.inputs.y = 0;
            if (['a','d'].includes(e.key)) this.game.inputs.x = 0;
        });
    }

    setupSpellButtons() {
        // Delegate for dynamic spell buttons
        const container = document.getElementById('spell-controls');
        if (!container) return;

        container.addEventListener('click', (e) => {
            const btn = e.target.closest('.spell-btn');
            if (btn && btn.dataset.el) {
                e.stopPropagation();
                this.game.handleSpellCast(btn.dataset.el);
            }
        });
        
        // Allow touch interaction specifically
        container.addEventListener('touchstart', (e) => {
             const btn = e.target.closest('.spell-btn');
             if (btn && btn.dataset.el) {
                 e.stopPropagation();
                 // Prevent default click emulation to speed up reaction
                 e.preventDefault(); 
                 this.game.handleSpellCast(btn.dataset.el);
             }
        }, { passive: false });
    }

    setupPointer() {
        const dom = this.renderer.domElement;
        if (!dom) return;

        dom.addEventListener('pointerdown', (e) => {
            try { dom.setPointerCapture(e.pointerId); } catch(e) {}
            this.inputState.down = true;
            this.inputState.startX = e.clientX;
            this.inputState.startY = e.clientY;
            this.inputState.lastX = e.clientX;
            this.inputState.lastY = e.clientY;
            this.inputState.startTime = Date.now();
            this.inputState.isDragging = false;
        });

        dom.addEventListener('pointermove', (e) => {
            if (!this.inputState.down) return;

            const dx = e.clientX - this.inputState.lastX;
            const dy = e.clientY - this.inputState.lastY;

            const dist = Math.sqrt(
                (e.clientX - this.inputState.startX) ** 2 +
                (e.clientY - this.inputState.startY) ** 2
            );
            if (dist > 5) this.inputState.isDragging = true;

            if (this.inputState.isDragging && this.cameraController) {
                this.cameraController.rotate(dx, dy);
            }

            this.inputState.lastX = e.clientX;
            this.inputState.lastY = e.clientY;
        });

        dom.addEventListener('pointerup', (e) => {
            try { dom.releasePointerCapture(e.pointerId); } catch(e) {}
            this.inputState.down = false;

            // Tap Detection
            if (!this.inputState.isDragging && (Date.now() - this.inputState.startTime) < 300) {
                this.game.handleTap(e.clientX, e.clientY);
            }
        });

        dom.addEventListener('pointercancel', (e) => {
            try { dom.releasePointerCapture(e.pointerId); } catch(e) {}
            this.inputState.down = false;
        });
    }
}