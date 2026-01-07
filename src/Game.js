import * as THREE from 'three';
import { World } from './World.js';
import { Player } from './Player.js';
import { CombatSystem } from './CombatSystem.js';
import { AudioManager } from './AudioManager.js';
import { getSpellConfig } from './Spells.js';
import { UIManager } from './UIManager.js';
import { InputManager } from './InputManager.js';
import { CameraController } from './CameraController.js';
import { InteractionSystem } from './InteractionSystem.js';
import { RoamingSystem } from './RoamingSystem.js';

export class Game {
    constructor(audioCtx) {
        this.audioCtx = audioCtx;
        this.container = document.getElementById('game-container');
        this.targetItem = null; // Item player is walking towards
        
        // Setup Three.js
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // Sky blue
        this.scene.fog = new THREE.Fog(0x87CEEB, 200, 700); // Much further fog

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
        this.camera.position.set(0, 5, 10);
        
        this.renderer = new THREE.WebGLRenderer({ antialias: false });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.container.appendChild(this.renderer.domElement);

        // Inputs (populated by InputManager)
        this.inputs = { x: 0, y: 0, magic: false };

        // Subsystems
        this.audioManager = new AudioManager(audioCtx);
        this.world = new World(this.scene);
        this.player = new Player(this.scene, this.audioManager);
        this.combatSystem = new CombatSystem(this.scene, this.player, this.audioManager);
        this.uiManager = new UIManager(this.player, this.combatSystem);

        // New Refactored Systems
        this.interactionSystem = new InteractionSystem(this);
        this.roamingSystem = new RoamingSystem(this);

        // Camera controller (handles orbit & compass)
        this.cameraController = new CameraController(this.camera, this.player.mesh);

        // Input manager (joystick, keyboard, pointer)
        this.inputManager = new InputManager(this, this.renderer, this.cameraController);

        this.clock = new THREE.Clock();
        this.gameState = 'ROAMING'; // ROAMING, BATTLE, MENU
        this.messageTimer = null;
        
        // removed roamingProjectiles array; moved to RoamingSystem
    }

    takeControl() {
        this.player.aiControlled = false;
        this.uiManager.showMessage("YOU HAVE CONTROL!", 2000);
    }

    async start() {
        // Load Assets
        await Promise.all([
            this.audioManager.loadSound('bgm', 'bgm_field.mp3'),
            this.audioManager.loadSound('cast', 'sfx_cast.mp3'),
            this.audioManager.loadSound('hit', 'sfx_hit.mp3'),
            this.audioManager.loadSound('wind', 'sfx_wind.mp3'),
            this.audioManager.loadSound('fire', 'sfx_fire.mp3'),
            this.world.loadAssets(),
            this.player.loadAssets()
        ]);

        this.audioManager.playBgm('bgm');
        this.world.generate(this.player);
        this.player.mesh.position.y = this.world.getHeight(0, 0);

        // Ensure camera follows the loaded player
        if (this.cameraController) {
            this.cameraController.setTarget(this.player.mesh);
        }

        this.loop();
    }

    // removed setupInputs() {} – now handled by InputManager

    handleTap(x, y) {
        // removed body - delegated to InteractionSystem
        this.interactionSystem.handleTap(x, y);
    }

    handleSpellCast(element) {
        if (this.gameState === 'ROAMING') {
            if (this.player.castState.active) return;
            const config = getSpellConfig(element, this.player.spirits[element], this.player.stats.hp, this.player.stats.maxHp);
            
            // Check MP
            if (this.player.stats.mp < config.cost) {
                this.uiManager.showMessage("Not enough MP!", 1000);
                return;
            }

            if (this.player.startCasting(config, () => {
                this.player.stats.mp -= config.cost;
                // removed inline spawn - delegated to RoamingSystem
                this.roamingSystem.spawnProjectile(element, config);
            })) {
                // Cast started
            } else {
                this.uiManager.showMessage("Cooldown...", 500);
            }
            
        } else if (this.gameState === 'BATTLE') {
            this.combatSystem.playerCast(element);
        }
    }

    // removed updateAI(dt, inputs) {} - delegated to RoamingSystem
    
    // removed spawnRoamingProjectile(element, config) {} - delegated to RoamingSystem

    loop() {
        requestAnimationFrame(() => this.loop());
        
        let dt = Math.min(this.clock.getDelta(), 0.1);

        // Time Dilation if Menu Open
        const spellMenu = document.getElementById('spell-menu');
        if (spellMenu && spellMenu.classList.contains('active')) {
            dt *= 0.1;
        }

        // Inputs: Transform inputs to be relative to camera for Player
        const transformedInputs = { x: 0, y: 0 };
        
        if (this.player.aiControlled) {
            // removed updateAI call - delegated
            this.roamingSystem.updateAI(dt, transformedInputs);
        } else if (this.inputs.x !== 0 || this.inputs.y !== 0) {
            // Forward vector on XZ plane
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
            forward.y = 0; forward.normalize();
            const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
            right.y = 0; right.normalize();

            // input y is forward, x is right
            const moveDir = forward.multiplyScalar(this.inputs.y).add(right.multiplyScalar(this.inputs.x));
            
            transformedInputs.x = moveDir.x;
            transformedInputs.y = -moveDir.z;
        }

        // Game State Logic

        // Update Roaming Projectiles
        // removed projectile loop - delegated
        this.roamingSystem.update(dt);

        // Item Pickup Logic
        if (this.targetItem && this.world.items.includes(this.targetItem)) {
            const dist = this.player.mesh.position.distanceTo(this.targetItem.position);
            if (dist < 1.5) {
                this.collectItem(this.targetItem);
                this.targetItem = null;
                this.player.navTarget = null;
                this.player.isMoving = false;
            }
        }

        if (this.gameState === 'ROAMING') {
            this.player.update(dt, transformedInputs, this.world);
            this.world.update(dt, this.player.mesh.position, this.camera);
            
            // Check for contact encounters
            for (let enemy of this.world.enemies) {
                if (enemy.hp <= 0) continue;
                if (enemy.mesh.position.distanceTo(this.player.mesh.position) < 2.0) {
                    this.startBattle(enemy);
                    break;
                }
            }

        } else if (this.gameState === 'BATTLE') {
            // Combat system also needs camera-relative inputs
            const result = this.combatSystem.update(dt, transformedInputs, this.world);
            if (result.status === 'VICTORY') {
                this.handleVictory(result.xp);
                // Handle drops for all defeated enemies in battle
                if (result.defeated && result.defeated.length > 0) {
                    result.defeated.forEach(e => this.trySpawnDrop(e));
                }
                this.endBattle();
            } else if (result.status === 'ESCAPE') {
                this.uiManager.showMessage("ESCAPED!", 2000);
                this.endBattle();
            }
        }

        this.uiManager.update(this.gameState, this.combatSystem);

        if (this.cameraController) {
            this.cameraController.update();
        }

        this.renderer.render(this.scene, this.camera);
    }

    startBattle(enemy) {
        this.gameState = 'BATTLE';
        this.player.resetCooldowns();
        this.targetItem = null; // Clear item targeting
        this.uiManager.showMessage("BATTLE START!", 2000);
        this.combatSystem.initBattle(this.player.mesh.position, enemy, this.world.enemies, this.world);
    }

    endBattle() {
        this.gameState = 'ROAMING';
        this.combatSystem.cleanup();
    }
    
    handleVictory(xp = 20) {
        // No XP during title screen (AI mode)
        if (this.player.aiControlled) return;

        const leveledUp = this.player.gainXp(xp);
        this.uiManager.showMessage(leveledUp ? "LEVEL UP!" : `VICTORY! +${xp} XP`, 3000);
        
        if (leveledUp) {
            // Delegate level up UI and stat application to UIManager callback
            this.uiManager.showLevelUpMenu((elementKey) => {
                if (!elementKey) return;
                if (this.player.spirits[elementKey] !== undefined) {
                    this.player.spirits[elementKey]++;
                }
                this.player.recalcStats();
                this.player.stats.hp = this.player.stats.maxHp;
                this.player.stats.mp = this.player.stats.maxMp;
            });
        }
    }

    trySpawnDrop(enemy) {
        const dropType = enemy.getDrop();
        if (dropType) {
            // Spawn where enemy was
            this.world.spawnItem(dropType, enemy.lastPosition);
        }
    }

    collectItem(item) {
        if (!this.world.items.includes(item)) return;
        
        // Remove item
        item.dispose();
        const index = this.world.items.indexOf(item);
        if (index > -1) this.world.items.splice(index, 1);
        
        // Add to inventory
        const config = item.config;
        this.player.stats.addItem(item.type, 1);
        
        this.uiManager.showMessage(`Got ${config.name}!`, 1500);
        this.audioManager.playSfx('cast'); // Reuse cast sound as pickup chime
    }

    // removed showLevelUpMenu() {} – moved to UIManager
    // removed showMessage() {} – moved to UIManager

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}