import * as THREE from 'three';

export class Enemy {
    constructor(scene, x, z, type = 'GOBLIN', level = 1) {
        this.scene = scene;
        this.type = type;
        this.level = level;
        this.state = 'ROAM';
        
        // Stats defaults
        this.baseHp = 30;
        this.speed = 3;
        this.detectRadius = 15;
        this.yOffset = 0.7;
        this.baseDamage = 5;
        
        // Configure Type
        let geo, color;
        
        switch (type) {
            case 'SLIME':
                this.baseHp = 20; this.speed = 2; this.baseDamage = 4;
                this.element = 'water';
                this.baseXp = 15;
                geo = new THREE.SphereGeometry(0.6, 8, 6);
                geo.scale(1, 0.6, 1);
                color = 0x44ff44;
                this.yOffset = 0.4;
                break;
            case 'SAND_SLIME':
                this.baseHp = 25; this.speed = 2.5; this.baseDamage = 6;
                this.element = 'earth';
                this.baseXp = 20;
                geo = new THREE.SphereGeometry(0.6, 8, 6);
                geo.scale(1, 0.6, 1);
                color = 0xeebb44; // Sand color
                this.yOffset = 0.4;
                break;
            case 'WOLF':
                this.baseHp = 25; this.speed = 6; this.baseDamage = 8;
                this.element = 'wind';
                this.baseXp = 30;
                geo = new THREE.BoxGeometry(0.5, 0.5, 1.0);
                color = 0x555555;
                this.yOffset = 0.5;
                break;
            case 'SNOW_WOLF':
                this.baseHp = 40; this.speed = 7; this.baseDamage = 12;
                this.element = 'water'; // Ice
                this.baseXp = 50;
                geo = new THREE.BoxGeometry(0.6, 0.6, 1.2);
                color = 0xddeeff;
                this.yOffset = 0.6;
                break;
            case 'GOLEM':
                this.baseHp = 80; this.speed = 1.5; this.baseDamage = 15;
                this.element = 'earth';
                this.baseXp = 80;
                geo = new THREE.CylinderGeometry(0.6, 0.6, 1.2, 6);
                color = 0x6d4c41;
                this.yOffset = 0.6;
                this.detectRadius = 10;
                break;
            case 'MAGMA_GOLEM':
                this.baseHp = 150; this.speed = 2.0; this.baseDamage = 25;
                this.element = 'fire';
                this.baseXp = 200;
                geo = new THREE.CylinderGeometry(0.8, 0.8, 1.5, 6);
                color = 0x330000;
                this.yOffset = 0.8;
                this.detectRadius = 12;
                break;
            case 'SPIRIT':
                this.baseHp = 15; this.speed = 4; this.baseDamage = 6;
                this.element = 'fire';
                this.baseXp = 25;
                geo = new THREE.OctahedronGeometry(0.5);
                color = 0x00ffff;
                this.yOffset = 1.5; // Flying
                break;
            case 'ICE_SPIRIT':
                this.baseHp = 35; this.speed = 5; this.baseDamage = 10;
                this.element = 'water';
                this.baseXp = 60;
                geo = new THREE.OctahedronGeometry(0.6);
                color = 0xaaddff;
                this.yOffset = 1.8;
                break;
            default: // GOBLIN
                this.baseHp = 30; this.speed = 3; this.baseDamage = 5;
                this.element = 'earth';
                this.baseXp = 20;
                geo = new THREE.DodecahedronGeometry(0.7);
                color = 0x882222;
                this.yOffset = 0.7;
                break;
        }

        // Apply Level Scaling
        const scale = 1 + ((level - 1) * 0.2); // +20% stats per level
        this.maxHp = Math.floor(this.baseHp * scale);
        this.hp = this.maxHp;
        this.damage = Math.floor(this.baseDamage * scale);
        this.xpValue = Math.floor((this.baseXp || 10) * (1 + (level - 1) * 0.5));
        
        // Scale size slightly
        const sizeScale = 1.0 + Math.min(0.5, (level - 1) * 0.05);
        
        this.lastPosition = new THREE.Vector3(x, this.yOffset, z);
        this.roamOrigin = new THREE.Vector3(x, this.yOffset, z);
        this.roamRadius = 20;
        this.roamTarget = this.roamOrigin.clone();
        this.waitTime = 0;
        this.baseColor = color;

        const mat = new THREE.MeshStandardMaterial({ 
            map: null,
            color: color, 
            flatShading: true,
            roughness: 0.8
        });
        
        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.castShadow = true;
        this.mesh.position.copy(this.roamOrigin);
        this.mesh.scale.setScalar(sizeScale);

        // Add emissive glow for Magma Golem
        if (type === 'MAGMA_GOLEM') {
            mat.emissive.setHex(0xff3300);
            mat.emissiveIntensity = 0.5;
        }
        
        this.scene.add(this.mesh);

        // Level Indicator (Simple floating text or just implicit)
        // For performance we skip text, but size indicates power.

        // Hitbox for easier selection
        const hitGeo = new THREE.CylinderGeometry(1.5, 1.5, 3, 8);
        const hitMat = new THREE.MeshBasicMaterial({ visible: true, transparent: true, opacity: 0, side: THREE.DoubleSide });
        const hitbox = new THREE.Mesh(hitGeo, hitMat);
        hitbox.userData = { isHitbox: true };
        this.mesh.add(hitbox);
        
        // Eye / Direction Indicator
        const eyeColor = type === 'SPIRIT' ? 0xff0000 : 0xffff00;
        const eye = new THREE.Mesh(new THREE.BoxGeometry(0.2,0.1,0.1), new THREE.MeshBasicMaterial({color: eyeColor}));
        eye.position.set(0, 0.2, 0.5); // Forward Z
        if(type === 'WOLF') eye.position.set(0, 0.2, 0.5);
        if(type === 'GOLEM') eye.position.set(0, 0.4, 0.6);
        this.mesh.add(eye);
    }

    setTexture(texture) {
        this.mesh.material.map = texture;
        this.mesh.material.needsUpdate = true;
    }

    update(dt, playerPos, world) {
        if (!this.mesh) return;
        
        // Update stored position before we move, just in case
        this.lastPosition.copy(this.mesh.position);

        // Ensure Y is correct
        if (world) {
            const h = world.getHeight(this.mesh.position.x, this.mesh.position.z);
            // Smooth lerp for visual niceness
            const targetY = h + this.yOffset;
            
            if (this.type === 'SPIRIT' || this.type === 'ICE_SPIRIT') {
                 // Flying units bob
                 this.mesh.position.y = targetY + Math.sin(Date.now() * 0.003) * 0.5;
            } else {
                 this.mesh.position.y = THREE.MathUtils.lerp(this.mesh.position.y, targetY, dt * 10);
            }
        }

        if (this.state === 'BATTLE') {
            return;
        }

        // Check distance to player
        const distToPlayer = this.mesh.position.distanceTo(playerPos);
        
        if (distToPlayer < this.detectRadius) {
            this.state = 'CHASE';
        } else if (distToPlayer > this.detectRadius * 1.5) {
            this.state = 'ROAM';
        }

        if (this.state === 'CHASE') {
            const dir = new THREE.Vector3().subVectors(playerPos, this.mesh.position).normalize();
            dir.y = 0;
            this.mesh.position.add(dir.multiplyScalar(this.speed * dt));
            this.mesh.lookAt(playerPos);
        } else {
            // Roaming logic
            if (this.waitTime > 0) {
                this.waitTime -= dt;
            } else {
                const dist = this.mesh.position.distanceTo(this.roamTarget);
                if (dist < 1) {
                    // Pick new target
                    const angle = Math.random() * Math.PI * 2;
                    const r = Math.random() * this.roamRadius;
                    this.roamTarget.set(
                        this.roamOrigin.x + Math.cos(angle) * r,
                        this.mesh.position.y,
                        this.roamOrigin.z + Math.sin(angle) * r
                    );
                    this.waitTime = 1 + Math.random() * 2;
                } else {
                    const dir = new THREE.Vector3().subVectors(this.roamTarget, this.mesh.position).normalize();
                    this.mesh.position.add(dir.multiplyScalar((this.speed * 0.5) * dt));
                    this.mesh.lookAt(this.roamTarget);
                }
            }
        }

    }

    takeDamage(amount) {
        this.hp -= amount;
        
        // Flash white
        this.mesh.material.color.setHex(0xffffff);
        setTimeout(() => {
            if(this.mesh) this.mesh.material.color.setHex(this.baseColor);
        }, 100);

        if (this.hp <= 0) {
            this.dispose();
            return true;
        }
        return false;
    }

    highlight() {
        if (!this.mesh) return;
        this.mesh.material.color.setHex(0xffff00);
        setTimeout(() => {
            if(this.mesh) this.mesh.material.color.setHex(this.baseColor);
        }, 200);
    }

    resetBattleState() {
        this.turnPhase = 0;
        this.turnTimer = 0;
    }

    prepareTurn() {
        this.turnPhase = 'MOVE';
        this.turnTimer = 1.0;
        this.hasHit = false;
    }

    executeTurn(dt, player, world) {
        if (!this.mesh || !player.mesh) return true;

        const playerPos = player.mesh.position;
        const dist = this.mesh.position.distanceTo(playerPos);
        const dir = new THREE.Vector3().subVectors(playerPos, this.mesh.position).normalize();
        dir.y = 0;

        // Base color restoration helper
        const resetColor = () => {
            if (this.mesh) this.mesh.material.color.setHex(this.baseColor);
        };

        switch (this.turnPhase) {
            case 'MOVE':
                this.mesh.lookAt(playerPos);
                
                // Different movement goals
                let stopDist = 3.0;
                if (this.type === 'SPIRIT') stopDist = 8.0; // Stay ranged
                if (this.type === 'GOLEM') stopDist = 4.0; // AoE range

                if (dist > stopDist) {
                    this.mesh.position.add(dir.multiplyScalar(this.speed * dt));
                    if (world) this.mesh.position.y = world.getHeight(this.mesh.position.x, this.mesh.position.z) + this.yOffset;
                }
                
                this.turnTimer -= dt;
                if (this.turnTimer <= 0) {
                    this.turnPhase = 'ATTACK_WARN';
                    this.turnTimer = (this.type === 'GOLEM') ? 1.5 : 0.5; // Longer telegraph for Golem
                }
                break;

            case 'ATTACK_WARN':
                // Flash Warning
                const color = (Date.now() % 100 < 50) ? 0xff0000 : 0xffffff;
                this.mesh.material.color.setHex(color);
                
                this.turnTimer -= dt;
                if (this.turnTimer <= 0) {
                    this.turnPhase = 'ATTACK_EXEC';
                    this.turnTimer = 0.5;
                    this.mesh.material.color.setHex(0xffffff);
                }
                break;

            case 'ATTACK_EXEC':
                let damage = 0;
                let hit = false;
                
                if (this.type === 'GOLEM' || this.type === 'MAGMA_GOLEM') {
                    // AoE Slam - No movement, just radius check
                    const radius = (this.type === 'MAGMA_GOLEM') ? 8.0 : 6.0;
                    if (dist < radius) { 
                        damage = this.damage * 1.5; // Heavy hit
                        hit = true;
                    }
                    // Visual shake
                    this.mesh.position.y += Math.sin(Date.now() * 0.5) * 0.1;
                } 
                else if (this.type === 'SPIRIT' || this.type === 'ICE_SPIRIT') {
                    // Ranged zap
                    if (dist < 14.0) {
                        damage = this.damage;
                        hit = true;
                    }
                } 
                else {
                    // Melee Dash (Goblin, Wolf, Slime, etc)
                    const dashSpeed = this.speed * 4;
                    this.mesh.position.add(dir.multiplyScalar(dashSpeed * dt));
                    if (world) this.mesh.position.y = world.getHeight(this.mesh.position.x, this.mesh.position.z) + this.yOffset;

                    if (dist < 2.5) {
                        damage = this.damage;
                        hit = true;
                        // Bounce player
                        const bounce = dir.clone().multiplyScalar(3.0);
                        player.mesh.position.add(bounce);
                    }
                }

                if (hit && !this.hasHit) {
                    player.takeDamage(damage, this.element);
                    this.hasHit = true; // Ensure one hit per turn
                }

                this.turnTimer -= dt;
                if (this.turnTimer <= 0) {
                    this.turnPhase = 'RETURN';
                    this.turnTimer = 0.5;
                    this.hasHit = false; // Reset for next time
                }
                break;

            case 'RETURN':
                resetColor();
                // Melee units back off
                if (this.type !== 'GOLEM' && this.type !== 'SPIRIT') {
                    this.mesh.position.sub(dir.multiplyScalar(this.speed * dt));
                    if (world) this.mesh.position.y = world.getHeight(this.mesh.position.x, this.mesh.position.z) + this.yOffset;
                }
                
                this.turnTimer -= dt;
                if (this.turnTimer <= 0) {
                    return true;
                }
                break;
        }

        return false;
    }

    getDrop() {
        const roll = Math.random();
        
        // Default Drop Table
        // 30% chance for Herb
        // 15% chance for HP Potion
        // 15% chance for MP Potion
        // 1% chance for Elixir
        
        if (roll < 0.01) return 'ELIXIR';
        if (roll < 0.16) return 'MP_POTION';
        if (roll < 0.31) return 'HP_POTION';
        if (roll < 0.61) return 'HERB';
        
        return null;
    }

    dispose() {
        if (this.mesh) {
            this.lastPosition.copy(this.mesh.position); // Final save
            this.scene.remove(this.mesh);
            if (this.mesh.geometry) this.mesh.geometry.dispose();
            if (this.mesh.material) this.mesh.material.dispose();
            this.mesh = null;
        }
    }
}