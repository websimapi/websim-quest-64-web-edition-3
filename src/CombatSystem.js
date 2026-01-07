import * as THREE from 'three';
import { SpellProjectile, getSpellConfig } from './Spells.js';

export class CombatSystem {
    constructor(scene, player, audioManager) {
        this.scene = scene;
        this.player = player;
        this.audioManager = audioManager;
        this.active = false;
        
        this.boundaryMesh = null;
        this.radius = 15;
        this.center = new THREE.Vector3();
        
        this.activeEnemies = [];
        this.defeatedEnemies = []; // Track who died this battle to spawn drops later
        this.projectiles = [];
        this.world = null; // Store reference

        // Turn System
        this.turn = 'PLAYER'; // 'PLAYER' | 'ENEMY'
        this.enemyTurnIndex = 0;
        this.maxMove = 8.0;
        this.currentMove = 8.0;
        this.turnTimer = 0;
        this.aiCastPending = false;
    }

    getBattleAI(dt) {
        const inputs = { x: 0, y: 0 };
        // If casting or waiting for action delay, do nothing
        if (this.player.castState.active || this.aiCastPending) return inputs;
        
        this.turnTimer += dt;
        if (this.turnTimer < 0.5) return inputs; // Reaction delay

        // Pick Target (closest)
        let target = null;
        let minDist = 999;
        this.activeEnemies.forEach(e => {
            if (e.hp > 0) {
                const d = this.player.mesh.position.distanceTo(e.mesh.position);
                if (d < minDist) { minDist = d; target = e; }
            }
        });
        
        if (!target) return inputs;

        const dist = minDist;
        
        // AI Strategy: Kiting Mage
        // 1. If too close (< 8) and have movement: Move AWAY.
        // 2. If too far (> 18) and have movement: Move CLOSER.
        // 3. If in optimal range (8-18): Stop and Cast.
        
        const optimalMin = 8;
        const optimalMax = 18;

        if (dist < optimalMin && this.currentMove > 1) {
            // Move Away
            const dir = new THREE.Vector3().subVectors(this.player.mesh.position, target.mesh.position).normalize();
            inputs.x = dir.x;
            inputs.y = -dir.z;
        } 
        else if (dist > optimalMax && this.currentMove > 1) {
            // Move Closer
            const dir = new THREE.Vector3().subVectors(target.mesh.position, this.player.mesh.position).normalize();
            inputs.x = dir.x;
            inputs.y = -dir.z;
        }
        else {
            // In Position - Attack Sequence
             if (!this.aiCastPending) {
                 this.aiCastPending = true;
                 
                 // 1. Orient to target (consumes movement if needed, but important for aim)
                 this.tryFaceTarget(target);
                 
                 // 2. Choose Element
                 const elements = ['fire', 'water', 'earth', 'wind'];
                 const el = elements[Math.floor(Math.random() * elements.length)];
                 
                 // 3. Cast
                 this.playerCast(el);
                 
                 // 4. Reset timer
                 this.turnTimer = -2.0; // Pause before next action logic
                 setTimeout(()=> { this.aiCastPending = false; }, 2000);
             }
        }
        return inputs;
    }

    initBattle(centerPos, primaryEnemy, allEnemies, world) {
        this.active = true;
        this.world = world;
        this.center.copy(centerPos);
        this.defeatedEnemies = []; // Reset
        
        // Find all enemies in radius + the primary one
        this.activeEnemies = allEnemies.filter(e => {
            if (e.hp <= 0) return false;
            if (e === primaryEnemy) return true;
            return e.mesh.position.distanceTo(centerPos) <= this.radius;
        });
        
        // Lock enemy states
        this.activeEnemies.forEach(e => {
            e.state = 'BATTLE';
            e.resetBattleState();
        });

        // Create Boundary Ring conforming to terrain
        const geometry = new THREE.TorusGeometry(this.radius, 0.2, 8, 64);
        geometry.rotateX(Math.PI / 2);
        
        // Modify vertices to sit on terrain
        const posAttribute = geometry.attributes.position;
        const vertex = new THREE.Vector3();
        
        for (let i = 0; i < posAttribute.count; i++) {
            vertex.fromBufferAttribute(posAttribute, i);
            const wx = centerPos.x + vertex.x;
            const wz = centerPos.z + vertex.z;
            const h = world.getHeight(wx, wz);
            posAttribute.setXYZ(i, wx, h + 0.5, wz);
        }
        
        geometry.computeVertexNormals();

        const material = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.6 });
        this.boundaryMesh = new THREE.Mesh(geometry, material);
        this.scene.add(this.boundaryMesh);

        this.startPlayerTurn();
    }

    startPlayerTurn() {
        this.turn = 'PLAYER';
        this.currentMove = this.maxMove;
    }

    tryFaceTarget(target) {
        if (this.turn !== 'PLAYER' || !target.mesh) return { success: false, reason: 'Not player turn' };

        const playerPos = this.player.mesh.position;
        const targetPos = target.mesh.position;

        // Dir to target
        const dir = new THREE.Vector3().subVectors(targetPos, playerPos);
        dir.y = 0; 
        dir.normalize(); // Normalize AFTER flattening Y

        // Current facing
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.player.mesh.quaternion);
        forward.y = 0;
        forward.normalize();

        const angle = forward.angleTo(dir);

        if (angle < 0.05) return { success: true, reason: 'Already facing' }; // Negligible turn

        // Cost: 180 degrees (PI) = 2.0 move units
        const cost = (angle / Math.PI) * 2.0;

        if (this.currentMove >= cost) {
            this.currentMove -= cost;
            this.player.faceTarget(targetPos);
            return { success: true };
        } else {
            return { success: false, reason: 'Not enough movement' };
        }
    }

    startEnemyTurn() {
        this.turn = 'ENEMY';
        this.enemyTurnIndex = 0;
        this.prepareNextEnemy();
    }

    prepareNextEnemy() {
        // If player is out of bounds, do not proceed with other enemies, end phase to trigger escape
        const dist = this.player.mesh.position.distanceTo(this.center);
        if (dist > this.radius) {
            this.startPlayerTurn();
            return;
        }

        while(this.enemyTurnIndex < this.activeEnemies.length) {
            const enemy = this.activeEnemies[this.enemyTurnIndex];
            if(enemy && enemy.mesh && enemy.hp > 0) {
                enemy.prepareTurn();
                return;
            }
            this.enemyTurnIndex++;
        }
        // No more enemies to act
        this.startPlayerTurn();
    }

    cleanup() {
        this.active = false;
        if(this.boundaryMesh) {
            this.scene.remove(this.boundaryMesh);
            this.boundaryMesh = null;
        }
        this.activeEnemies.forEach(e => {
            if (e.hp > 0) e.state = 'ROAM';
        });
        this.activeEnemies = [];

        this.projectiles.forEach(p => p.dispose());
        this.projectiles = [];
    }

    playerCast(element) {
        if (!this.active || this.player.castState.active) return;
        if (this.turn !== 'PLAYER') return;
        
        const level = this.player.spirits[element];
        
        // Get dynamic spell config
        const spellConfig = getSpellConfig(element, level, this.player.stats.hp, this.player.stats.maxHp);
        
        if (this.player.stats.mp < spellConfig.cost) return;

        // Start Casting (Delay)
        this.player.startCasting(spellConfig, () => {
            this.executeSpell(element, spellConfig);
            // End turn after cast completes
            setTimeout(() => this.startEnemyTurn(), 500);
        });
    }

    executeSpell(element, spellConfig) {
        this.player.stats.mp -= spellConfig.cost;

        // Visual Effects for Heal
        if (spellConfig.type === 'heal') {
            this.player.stats.hp = Math.min(this.player.stats.maxHp, this.player.stats.hp + spellConfig.power);
            this.audioManager.playSfx('cast');
            
            // Add visual healing column
            const healGeo = new THREE.CylinderGeometry(1, 1, 4, 8, 1, true);
            const healMat = new THREE.MeshBasicMaterial({ 
                color: spellConfig.color, 
                transparent: true, 
                opacity: 0.5, 
                side: THREE.DoubleSide 
            });
            const healMesh = new THREE.Mesh(healGeo, healMat);
            healMesh.position.copy(this.player.mesh.position);
            healMesh.position.y += 2;
            this.scene.add(healMesh);
            
            // Animate out
            let scale = 1;
            const anim = setInterval(() => {
                scale += 0.1;
                healMesh.scale.set(scale, 1, scale);
                healMesh.material.opacity -= 0.05;
                if(healMesh.material.opacity <= 0) {
                    clearInterval(anim);
                    this.scene.remove(healMesh);
                    healMesh.geometry.dispose();
                    healMesh.material.dispose();
                }
            }, 50);
            
            return;
        }

        const staffState = this.player.getStaffTipWorldState();
        
        let sfx = 'wind';
        if (element === 'fire') sfx = 'fire';
        if (element === 'earth') sfx = 'hit'; // Thud
        this.audioManager.playSfx(sfx);

        // Auto-target logic
        let target = null;
        if (this.activeEnemies.length > 0) {
            // Find closest enemy in front of player
            const forward = new THREE.Vector3(0,0,-1).applyQuaternion(this.player.mesh.quaternion);
            let bestDot = 0.3; // Wider cone (approx 70 deg) for better feel
            let minDist = 999;
            
            for(let e of this.activeEnemies) {
                if(e.hp <= 0) continue;
                const dist = e.mesh.position.distanceTo(this.player.mesh.position);
                const dirToEnemy = new THREE.Vector3().subVectors(e.mesh.position, this.player.mesh.position).normalize();
                const dot = forward.dot(dirToEnemy);
                
                // Prioritize closer enemies within cone
                if(dot > bestDot) {
                    if (dist < minDist) {
                        minDist = dist;
                        target = e;
                    }
                }
            }
        }

        // Calculate Aim Direction
        // Instead of using staff rotation (which might be pointing up due to animation),
        // we calculate the vector from staff tip to target (or forward).
        const spawnPos = staffState.position.clone();
        const aimObj = new THREE.Object3D();
        aimObj.position.copy(spawnPos);

        if (target) {
            // Aim at enemy center/mass
            const targetPos = target.mesh.position.clone();
            targetPos.y += (target.yOffset || 0.5);
            aimObj.lookAt(targetPos);
        } else {
            // Free aim: Use player facing direction, but leveled to horizon
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.player.mesh.quaternion);
            const targetPos = spawnPos.clone().add(forward.multiplyScalar(20));
            // Adjust height to be same as spawn height to prevent shooting into sky/ground if tilted
            targetPos.y = spawnPos.y; 
            aimObj.lookAt(targetPos);
        }

        // Fire Spell
        const projectile = new SpellProjectile(
            this.scene, 
            spawnPos, 
            aimObj.quaternion, 
            spellConfig,
            this.world,
            target
        );
        this.projectiles.push(projectile);
    }

    update(dt, inputs, world) {
        if (!this.active) return { status: 'ESCAPE' };

        // Check Victory
        const liveEnemies = this.activeEnemies.filter(e => e.mesh && e.hp > 0);
        if (liveEnemies.length === 0) {
            const xp = this.activeEnemies.reduce((sum, e) => sum + (e.xpValue || 10), 0);
            return { status: 'VICTORY', xp: xp, defeated: this.defeatedEnemies };
        }

        // Turn Logic
        let canMove = false;

        // AI override inputs for player turn
        if (this.turn === 'PLAYER' && this.player.aiControlled) {
            const aiInputs = this.getBattleAI(dt);
            if (aiInputs.x !== 0 || aiInputs.y !== 0) {
                 inputs = aiInputs;
            }
        }

        if (this.turn === 'PLAYER') {
            canMove = this.currentMove > 0;
        } else if (this.turn === 'ENEMY') {
            canMove = false;
            const enemy = this.activeEnemies[this.enemyTurnIndex];
            
            if (!enemy || !enemy.mesh || enemy.hp <= 0) {
                this.enemyTurnIndex++;
                this.prepareNextEnemy();
            } else {
                const done = enemy.executeTurn(dt, this.player, world);
                if (done) {
                    this.enemyTurnIndex++;
                    this.prepareNextEnemy();
                }
            }
        }

        this.player.update(dt, inputs, world, this.center, this.radius, canMove);
        
        if (this.turn === 'PLAYER' && this.player.isMoving) {
            this.currentMove -= dt * this.player.speed;
            if (this.currentMove < 0) this.currentMove = 0;
        }
        
        const dist = this.player.mesh.position.distanceTo(this.center);
        
        // Only trigger escape during PLAYER turn.
        // If it is ENEMY turn, we wait for the enemy to finish their attack/return animation
        // The prepareNextEnemy function will handle switching back to PLAYER turn if out of bounds.
        if (dist > this.radius && this.turn === 'PLAYER') {
            return { status: 'ESCAPE' };
        }

        // Update Projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            const result = p.update(dt, this.activeEnemies.filter(e => e.mesh && e.hp > 0));
            
            if (result.result === 'HIT') {
                this.audioManager.playSfx('hit');
                if (result.target.takeDamage(result.damage)) {
                    this.defeatedEnemies.push(result.target);
                }
                p.dispose();
                this.projectiles.splice(i, 1);
            } 
            else if (result.result === 'HIT_AOE') {
                this.audioManager.playSfx('hit');
                result.targets.forEach(t => {
                    if (t.takeDamage(result.damage)) {
                        this.defeatedEnemies.push(t);
                    }
                });
            }
            else if (result.result === 'TIMEOUT') {
                p.dispose();
                this.projectiles.splice(i, 1);
            }
        }
        
        return { status: 'CONTINUE' };
    }
}