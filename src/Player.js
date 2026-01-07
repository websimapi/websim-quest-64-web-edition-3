import * as THREE from 'three';
import { PlayerStats } from './PlayerStats.js';
import { PlayerModel } from './PlayerModel.js';
import { getItemConfig } from './Item.js';

export class Player {
    constructor(scene, audioManager) {
        this.scene = scene;
        this.audioManager = audioManager;
        
        // Composition for cleaner architecture
        this.stats = new PlayerStats();
        this.visuals = new PlayerModel(scene);
        this.mesh = this.visuals.mesh; // Proxy mesh for compatibility

        this.speed = 8;
        this.currentSpeed = 8;
        this.isMoving = false;
        this.aiControlled = true;
        
        this.castState = {
            active: false,
            timer: 0,
            maxTime: 0,
            onComplete: null
        };

        this.cooldowns = {
            fire: 0,
            water: 0,
            earth: 0,
            wind: 0
        };
        
        this.targetRotation = null;
        this.navTarget = null;
    }

    async loadAssets() {
        // removed massive threejs geometry construction block
        this.visuals.create();
    }
    
    // Proxy accessors for stats
    get spirits() { return this.stats.spirits; }
    get xp() { return this.stats.xp; }
    get level() { return this.stats.level; }
    get nextLevelXp() { return this.stats.nextLevelXp; }

    // removed recalcStats() {}
    recalcStats() { this.stats.recalcStats(); }

    // removed takeDamage() {}
    takeDamage(amount, element) { this.stats.takeDamage(amount, element); }

    // removed gainXp() {}
    gainXp(amount) { return this.stats.gainXp(amount); }

    // removed regenMp() {}

    update(dt, inputs, world, boundaryCenter = null, boundaryRadius = 0, canMove = true) {
        this.stats.regenMp(dt);

        // Update Cooldowns
        for (const el in this.cooldowns) {
            if (this.cooldowns[el] > 0) {
                this.cooldowns[el] -= dt;
                if (this.cooldowns[el] < 0) this.cooldowns[el] = 0;
            }
        }

        // Update Location Name UI if world exists
        if (world && Math.random() < 0.05) { 
            const regionName = world.getRegionName(this.mesh.position.x, this.mesh.position.z);
            // Hacky way to show location without spamming UIManager. Leaving for now.
        }

        // Handle Rotation (Allowed during cast for aiming adjustments)
        if (this.targetRotation && !this.isMoving) {
            this.mesh.quaternion.slerp(this.targetRotation, 10 * dt);
            if (this.mesh.quaternion.angleTo(this.targetRotation) < 0.01) {
                this.mesh.quaternion.copy(this.targetRotation);
                this.targetRotation = null;
            }
        }

        // Casting State logic
        if (this.castState.active) {
            this.castState.timer -= dt;

            // Visuals are updated via this.visuals.animate call at the end
            
            if (this.castState.timer <= 0) {
                if (this.castState.onComplete) this.castState.onComplete();
                this.stopCasting();
            }
            
            this.isMoving = false;
            // Fallthrough to visual update, but bypass movement logic
        } else {
            // Movement Logic
            
            // Override movement if disabled
            if (!canMove) {
                this.isMoving = false;
                this.navTarget = null;
            } else {
                // Check Input first (Joystick/WASD overrides Click-to-Move)
                if (inputs.x !== 0 || inputs.y !== 0) {
                    this.isMoving = true;
                    this.navTarget = null; 
                } else if (this.navTarget) {
                     this.isMoving = true;
                } else {
                    this.isMoving = false;
                }
            }

            // Water Physics Pre-calc
            let speedMult = 1.0;
            if (world && world.waterSystem) {
                const waterH = world.waterSystem.getHeightAt(this.mesh.position.x, this.mesh.position.z);
                if (this.mesh.position.y < waterH) {
                    speedMult = 0.5; // Underwater penalty
                }
            }

            if (this.isMoving) {
                this.targetRotation = null; // User input overrides auto-turn

                let moveVec;

                if (this.navTarget) {
                    const dist = this.mesh.position.distanceTo(this.navTarget);
                    if (dist < 0.5) {
                        this.navTarget = null;
                        this.isMoving = false;
                        moveVec = new THREE.Vector3(0,0,0);
                    } else {
                        moveVec = new THREE.Vector3().subVectors(this.navTarget, this.mesh.position).normalize();
                        moveVec.y = 0;
                    }
                } else {
                    moveVec = new THREE.Vector3(inputs.x, 0, -inputs.y).normalize();
                }

                if (this.isMoving) {
                    // Rotate player to face movement
                    const angle = Math.atan2(moveVec.x, moveVec.z);
                    const targetQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), angle);
                    this.mesh.quaternion.slerp(targetQuat, 10 * dt);

                    // Move
                    const moveAmount = moveVec.multiplyScalar(this.speed * speedMult * dt);
                    const nextPos = this.mesh.position.clone().add(moveAmount);

                    this.mesh.position.copy(nextPos);
                }
            }
        }

        // Delegate animation to PlayerModel
        // removed animation logic block (bobbing, arm rotation)
        this.visuals.animate(this.isMoving, this.castState.active ? this.castState.timer : 0, this.castState.maxTime);

        // Always clamp to terrain (even when not moving)
        if (world) {
            const x = this.mesh.position.x;
            const z = this.mesh.position.z;
            const groundH = world.getHeight(x, z);
            
            if (this.mesh.position.y < groundH) {
                 this.mesh.position.y = groundH;
            } else {
                 this.mesh.position.y = THREE.MathUtils.lerp(this.mesh.position.y, groundH, dt * 10);
            }
        }
    }

    smoothLookAt(quat) {
        this.targetRotation = quat;
    }

    faceTarget(pos) {
        const dummy = new THREE.Object3D();
        dummy.position.copy(this.mesh.position);
        dummy.lookAt(pos.x, this.mesh.position.y, pos.z);
        this.smoothLookAt(dummy.quaternion);
    }

    startCasting(spellConfig, onComplete) {
        // Check Cooldown
        if (this.cooldowns[spellConfig.element] > 0) return false;

        this.castState.active = true;
        this.castState.maxTime = spellConfig.castTime || 1.0;
        this.castState.timer = this.castState.maxTime;
        this.castState.onComplete = onComplete;
        
        // Set Cooldown
        this.cooldowns[spellConfig.element] = spellConfig.cooldown || 1.5;

        this.audioManager.playSfx('cast');
        return true;
    }

    resetCooldowns() {
        this.cooldowns = { fire: 0, water: 0, earth: 0, wind: 0 };
    }

    stopCasting() {
        this.castState.active = false;
        this.castState.onComplete = null;
        // Visual reset handled in visuals.animate()
    }

    // removed getStaffTipWorldState() {}
    getStaffTipWorldState() {
        return this.visuals.getStaffTipWorldState();
    }
    
    // Legacy method for roaming instant cast (if needed)
    castSpell(element) {
         this.audioManager.playSfx('cast');
    }

    useToolbeltItem(slotIndex) {
        if (slotIndex < 0 || slotIndex >= 3) return false;
        
        const type = this.stats.toolbelt[slotIndex];
        if (!type) return false;

        if (this.stats.hasItem(type)) {
            const config = getItemConfig(type);
            
            // Apply Effects
            let used = false;
            
            // Check if needed? Nah, just use it.
            if (config.stat === 'hp' || config.stat === 'all') {
                if (this.stats.hp < this.stats.maxHp || config.stat === 'all') {
                    this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + config.value);
                    used = true;
                }
            }
            if (config.stat === 'mp' || config.stat === 'all') {
                 if (this.stats.mp < this.stats.maxMp || config.stat === 'all') {
                    this.stats.mp = Math.min(this.stats.maxMp, this.stats.mp + config.value);
                    used = true;
                 }
            }

            if (used) {
                this.stats.consumeItem(type);
                this.audioManager.playSfx('cast'); // Use cast sound for potion
                return { success: true, name: config.name };
            } else {
                return { success: false, msg: "Full Health/Mana" };
            }
        }
        return { success: false, msg: "Empty" };
    }
}