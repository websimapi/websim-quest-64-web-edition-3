import * as THREE from 'three';

const loader = new THREE.TextureLoader();
const flareTex = loader.load('particle_flare.png');

// --- spell Configuration Factory ---

export function getSpellConfig(element, level, currentHp, maxHp) {
    const config = {
        element: element,
        level: level,
        damage: 10 + (level * 2),
        cost: 2 + Math.floor(level / 2),
        speed: 15,
        scale: 0.5 + (level * 0.05),
        type: 'projectile', // projectile, ground, heal
        castTime: 0.5,
        cooldown: 1.5,
        name: 'Spell',
        color: 0xffffff
    };

    // Healing Logic for Earth/Water at low HP
    const isCriticalHp = currentHp < maxHp * 0.4;
    
    switch(element) {
        case 'earth':
            config.color = 0x8d6e63;
            if (isCriticalHp) {
                config.type = 'heal';
                config.name = "Earth's Embrace";
                config.power = 20 + (level * 5);
                config.cost = 15;
                config.castTime = 1.5;
                config.color = 0xeda955; // Amber
            } else if (level >= 20) {
                config.name = "Seismic Spike";
                config.type = 'ground_target';
                config.damage = 50 + (level * 3);
                config.scale = 2.0;
                config.cost = 12;
                config.castTime = 1.5;
            } else if (level >= 10) {
                config.name = "Boulder Crash";
                config.damage = 30 + (level * 2);
                config.scale = 1.2;
                config.speed = 12;
                config.castTime = 1.0;
            } else {
                config.name = "Rock Throw";
                config.speed = 15;
                config.castTime = 0.8;
            }
            break;
            
        case 'water':
            config.color = 0x4fc3f7;
            if (isCriticalHp) {
                config.type = 'heal';
                config.name = "Soothing Mist";
                config.power = 15 + (level * 4);
                config.cost = 10;
                config.castTime = 1.0;
                config.color = 0x00ffff;
            } else if (level >= 20) {
                config.name = "Glacial Storm";
                config.type = 'projectile'; // Turns into a storm on hit
                config.damage = 40 + (level * 2);
                config.scale = 1.5;
                config.speed = 20;
                config.castTime = 1.2;
            } else if (level >= 10) {
                config.name = "Ice Volley";
                config.count = 3; // Multishot
                config.damage = 15 + level;
                config.scale = 0.5;
                config.speed = 25;
                config.castTime = 0.8;
            } else {
                config.name = "Ice Shard";
                config.speed = 28;
                config.castTime = 0.4;
            }
            break;
            
        case 'fire':
            config.color = 0xff5722;
            if (level >= 20) {
                config.name = "Hellfire";
                config.type = 'ground_target';
                config.damage = 60 + (level * 4);
                config.scale = 4.0;
                config.cost = 20;
                config.castTime = 2.0;
            } else if (level >= 10) {
                config.name = "Flame Pillar";
                config.type = 'ground_target';
                config.damage = 40 + (level * 3);
                config.scale = 2.0;
                config.cost = 10;
                config.castTime = 1.2;
            } else {
                config.name = "Fireball";
                config.speed = 20;
                config.damage = 15 + (level * 2);
                config.castTime = 0.6;
            }
            break;
            
        case 'wind':
            config.color = 0xffeb3b;
            if (level >= 20) {
                config.name = "Tornado";
                config.type = 'homing';
                config.damage = 30 + (level * 2); // Hits multiple times
                config.scale = 2.5;
                config.speed = 10;
                config.cost = 15;
                config.castTime = 1.5;
            } else if (level >= 10) {
                config.name = "Gale Blade";
                config.count = 2;
                config.damage = 15 + level;
                config.scale = 0.8;
                config.speed = 35;
                config.castTime = 0.6;
            } else {
                config.name = "Wind Cutter";
                config.speed = 40;
                config.scale = 0.6;
                config.castTime = 0.3;
            }
            break;
    }
    
    return config;
}

// --- Spell Logic & Visuals ---

export class SpellProjectile {
    constructor(scene, startPos, directionQuat, config, world, targetEnemy = null) {
        this.scene = scene;
        this.world = world;
        this.config = config;
        this.target = targetEnemy;
        this.life = 3.0;
        this.age = 0;
        this.particles = [];
        this.dead = false;
        
        this.position = startPos.clone();
        this.velocity = new THREE.Vector3(0,0,-1).applyQuaternion(directionQuat).multiplyScalar(config.speed);
        
        // --- Geometry Selection ---
        let geo, mat;
        const color = config.color;

        if (config.element === 'earth') {
            if (config.type === 'ground_target') {
                geo = new THREE.ConeGeometry(config.scale * 0.5, config.scale * 2, 6);
            } else {
                geo = new THREE.DodecahedronGeometry(config.scale); // Jagged rock
            }
            mat = new THREE.MeshStandardMaterial({ color: color, roughness: 1.0, flatShading: true });
        } 
        else if (config.element === 'fire') {
            geo = new THREE.IcosahedronGeometry(config.scale, 1);
            mat = new THREE.MeshBasicMaterial({ color: 0xffaa00, wireframe: false }); // Core
        }
        else if (config.element === 'water') {
            if (config.name.includes('Storm')) {
                geo = new THREE.SphereGeometry(config.scale, 8, 8);
            } else {
                geo = new THREE.OctahedronGeometry(config.scale); // Crystal
                geo.scale(0.5, 0.5, 2); // Long shard
            }
            mat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.8 });
        }
        else { // Wind
             if (config.name === 'Tornado') {
                 geo = new THREE.CylinderGeometry(config.scale, config.scale*0.1, config.scale*3, 8, 1, true);
                 mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, side: THREE.DoubleSide });
             } else {
                 geo = new THREE.TorusGeometry(config.scale, config.scale*0.2, 4, 12); // Disc
                 mat = new THREE.MeshBasicMaterial({ color: 0xffffaa });
             }
        }

        // Store spawn position for range checks
        this.spawnPos = this.position.clone();

        // Calculate terrain height offset for terrain-hugging projectiles
        if (this.world) {
            const h = this.world.getHeight(this.position.x, this.position.z);
            this.heightOffset = Math.max(0.5, this.position.y - h);
        } else {
            this.heightOffset = 1.0;
        }

        // Ground Target Logic: If it's a pillar spell, we snap to target or ground instantly
        if (config.type === 'ground_target') {
            this.life = 1.0; // Duration of visual
            this.mesh = new THREE.Group();
            
            // Determine spawn point
            let spawnPos = this.position.clone().add(this.velocity.clone().normalize().multiplyScalar(5)); // Default 5 units ahead
            if (targetEnemy) {
                spawnPos = targetEnemy.mesh.position.clone();
            }
            
            // Snap to ground
            if (world) {
                spawnPos.y = world.getHeight(spawnPos.x, spawnPos.z);
            }
            this.spawnPos = spawnPos;

            // Create rising mesh
            const spike = new THREE.Mesh(geo, mat);
            spike.position.copy(spawnPos);
            spike.position.y -= config.scale * 2; // Start underground
            
            this.mesh.userData = { targetY: spawnPos.y + (config.scale), startY: spawnPos.y - config.scale * 2 };
            this.mesh.add(spike);
            
            // Add AoE indicator
            const ring = new THREE.Mesh(
                new THREE.RingGeometry(0.1, config.scale * 1.5, 16),
                new THREE.MeshBasicMaterial({ color: config.color, side: THREE.DoubleSide, transparent: true, opacity: 0.5 })
            );
            ring.rotation.x = -Math.PI/2;
            ring.position.copy(spawnPos);
            ring.position.y += 0.1;
            this.mesh.add(ring);

            this.scene.add(this.mesh);
            
            // Hit check happens once
            this.hasHit = false;

        } else {
            // Projectile
            this.mesh = new THREE.Mesh(geo, mat);
            this.mesh.position.copy(this.position);
            this.mesh.quaternion.copy(directionQuat);
            
            // Add a point light for flair
            const light = new THREE.PointLight(config.color, 2, 5);
            this.mesh.add(light);
            
            this.scene.add(this.mesh);
        }

        // Create Particle Container
        const pGeo = new THREE.BufferGeometry();
        const pCount = 50;
        const pPos = new Float32Array(pCount * 3);
        const pSizes = new Float32Array(pCount);
        pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
        pGeo.setAttribute('size', new THREE.BufferAttribute(pSizes, 1));
        
        this.pSystem = new THREE.Points(pGeo, new THREE.PointsMaterial({
            color: config.color,
            size: 0.5,
            map: flareTex,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        }));
        this.scene.add(this.pSystem);
        
        // Init particles off-screen
        for(let i=0; i<pCount*3; i++) pPos[i] = 9999;
    }

    update(dt, enemies) {
        if (this.dead) return { result: 'TIMEOUT' };
        
        this.age += dt;
        this.life -= dt;

        // Max range check (approx battle radius 20)
        if (this.spawnPos && this.mesh) {
            const currentPos = (this.config.type === 'ground_target') ? this.spawnPos : this.mesh.position;
            if (currentPos.distanceTo(this.spawnPos) > 25.0) {
                this.dispose();
                return { result: 'TIMEOUT' };
            }
        }

        if (this.life <= 0) {
            this.dispose();
            return { result: 'TIMEOUT' };
        }

        // --- Visuals Update ---
        this.updateParticles(dt);

        // --- Logic Update ---
        if (this.config.type === 'ground_target') {
            // Animate spike rising
            const spike = this.mesh.children[0];
            if (spike && this.age < 0.3) {
                const t = this.age / 0.3; // rise over 0.3s
                spike.position.y = THREE.MathUtils.lerp(this.mesh.userData.startY, this.mesh.userData.targetY, t);
            }
            
            // Check Hit Once
            if (!this.hasHit && this.age > 0.1) {
                this.hasHit = true;
                const hitEnemies = [];
                for(let e of enemies) {
                    if (e.mesh.position.distanceTo(this.spawnPos) < this.config.scale * 1.5) {
                        hitEnemies.push(e);
                    }
                }
                
                if (hitEnemies.length > 0) {
                    return { result: 'HIT_AOE', targets: hitEnemies, damage: this.config.damage };
                }
            }
            return { result: 'FLYING' };
        } 
        else {
            // Standard Projectile
            const startPos = this.mesh.position.clone();
            
            // Homing Logic for Wind Tornado
            if (this.config.type === 'homing') {
                let target = this.target;
                if ((!target || target.hp <= 0) && enemies.length > 0) {
                    // Find closest if original target dead or null
                    let d = 999;
                    for(let e of enemies) {
                        const dist = this.mesh.position.distanceTo(e.mesh.position);
                        if (dist < d) { d = dist; target = e; }
                    }
                }
                
                if (target && target.hp > 0 && this.mesh.position.distanceTo(target.mesh.position) < 25) {
                    const dir = new THREE.Vector3().subVectors(target.mesh.position, this.mesh.position).normalize();
                    this.velocity.lerp(dir.multiplyScalar(this.config.speed), dt * 3);
                }
            }

            // Determine next position with Terrain Hugging support
            let nextPos, move;

            if (this.config.type !== 'homing' && this.world) {
                // Terrain Hugging: Move XZ by velocity, force Y to terrain + offset
                const moveX = this.velocity.x * dt;
                const moveZ = this.velocity.z * dt;
                
                // Calculate next XZ
                const nextX = startPos.x + moveX;
                const nextZ = startPos.z + moveZ;
                
                // Snap Y
                const groundH = this.world.getHeight(nextX, nextZ);
                // Safety fallback for heightOffset
                const offset = (this.heightOffset !== undefined) ? this.heightOffset : 1.5;
                
                nextPos = new THREE.Vector3(nextX, groundH + offset, nextZ);
                
                // Reconstruct move vector for collisions
                move = new THREE.Vector3().subVectors(nextPos, startPos);
            } else {
                // Free Flight (Homing or no world)
                move = this.velocity.clone().multiplyScalar(dt);
                nextPos = startPos.clone().add(move);
            }

            // Move
            this.mesh.position.copy(nextPos);
            this.mesh.rotation.z += dt * 10;
            this.mesh.rotation.x += dt * 5;

            // Terrain Collision (Only check if we aren't hugging)
            if (this.config.type === 'homing' && this.world) {
                const h = this.world.getHeight(this.mesh.position.x, this.mesh.position.z);
                if (this.mesh.position.y < h) {
                    this.dispose();
                    return { result: 'TIMEOUT' }; // Hit ground
                }
            }

            // Enemy Collision with Sweep (Prevents tunneling)
            const ray = new THREE.Ray(startPos, move.clone().normalize());
            const moveDist = move.length();
            
            for (let enemy of enemies) {
                // Sphere check first
                const dist = this.mesh.position.distanceTo(enemy.mesh.position);
                const hitRadius = 1.0 + this.config.scale;
                
                if (dist < hitRadius) {
                    return { result: 'HIT', target: enemy, damage: this.config.damage };
                }
                
                // Sweep check
                const enemyVec = new THREE.Vector3().subVectors(enemy.mesh.position, startPos);
                const projectedDist = enemyVec.dot(ray.direction);
                
                if (projectedDist > 0 && projectedDist < moveDist) {
                    const closestPointOnRay = ray.at(projectedDist, new THREE.Vector3());
                    if (closestPointOnRay.distanceTo(enemy.mesh.position) < hitRadius) {
                         return { result: 'HIT', target: enemy, damage: this.config.damage };
                    }
                }
            }
        }
        
        return { result: 'FLYING' };
    }
    
    updateParticles(dt) {
        if (!this.pSystem) return;
        const positions = this.pSystem.geometry.attributes.position.array;
        let count = 0;
        
        // Spawn new particle at current mesh pos
        if (this.age < this.life - 0.5) { // Stop spawning near end
             const idx = Math.floor(Math.random() * 50) * 3;
             let spawnPos = this.mesh.position;
             if (this.config.type === 'ground_target' && this.mesh.children[0]) {
                 spawnPos = this.mesh.children[0].position; // Emit from spike
             }
             
             positions[idx] = spawnPos.x + (Math.random()-0.5);
             positions[idx+1] = spawnPos.y + (Math.random()-0.5);
             positions[idx+2] = spawnPos.z + (Math.random()-0.5);
        }

        // Move particles? Simpler to just let them jitter
        this.pSystem.geometry.attributes.position.needsUpdate = true;
    }

    dispose() {
        this.dead = true;
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.traverse(c => {
                if (c.geometry) c.geometry.dispose();
                if (c.material) c.material.dispose();
            });
            this.mesh = null;
        }
        if (this.pSystem) {
            this.scene.remove(this.pSystem);
            this.pSystem.geometry.dispose();
            this.pSystem.material.dispose();
            this.pSystem = null;
        }
    }
}