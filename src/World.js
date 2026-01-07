import * as THREE from 'three';
import { Enemy } from './Enemy.js';
import { Noise } from './Noise.js';
import { GrassSystem } from './GrassSystem.js';
import { WaterSystem } from './WaterSystem.js';
import { Item } from './Item.js';

export class World {
    constructor(scene) {
        this.scene = scene;
        this.ground = null;
        this.size = 2000; 
        this.segments = 256; // Higher res for smoother terrain
        this.enemies = [];
        this.items = [];
        this.noise = new Noise();
        this.grassSystem = new GrassSystem(scene, this);
        this.waterSystem = new WaterSystem(scene, this);
        
        // Story Regions
        this.regions = [
            { name: "Plains of Aethelgard", biome: 'GRASSLAND', x: 0, z: 0, r: 400 },
            { name: "Whispering Woods", biome: 'FOREST', x: -500, z: -500, r: 350 },
            { name: "Crimson Wastes", biome: 'BADLANDS', x: 500, z: -500, r: 350 },
            { name: "Frostfall Ridge", biome: 'SNOW', x: 500, z: 500, r: 350 },
            { name: "Shifting Sands", biome: 'DESERT', x: -500, z: 500, r: 350 },
            { name: "Mount Celestia", biome: 'MOUNTAIN', x: 0, z: -800, r: 300 }
        ];
    }

    async loadAssets() {
        const loader = new THREE.TextureLoader();
        this.grassTexture = await loader.loadAsync('grass_texture.png');
    }

    generate(player) {
        // 1. Terrain Geometry
        const geometry = new THREE.PlaneGeometry(this.size, this.size, this.segments, this.segments);
        
        const colors = [];
        const posAttribute = geometry.attributes.position;
        const count = posAttribute.count;
        const color = new THREE.Color();
        const baseColor = new THREE.Color();

        for (let i = 0; i < count; i++) {
            const x = posAttribute.getX(i);
            const y = posAttribute.getY(i); // This is Z in 2D plane logic
            
            // Calculate Height using FBM
            const h = this.getHeight(x, -y);
            posAttribute.setZ(i, h); // Set Z (which becomes Y after rotation)

            // Determine Biome Color
            const biome = this.getBiome(x, -y);
            
            // Base colors
            if (biome === 'GRASSLAND') baseColor.setHex(0x55aa55);
            else if (biome === 'FOREST') baseColor.setHex(0x1b5e20);
            else if (biome === 'DESERT') baseColor.setHex(0xefd595); // Sand
            else if (biome === 'SNOW') baseColor.setHex(0xffffff);
            else if (biome === 'BADLANDS') baseColor.setHex(0x8d6e63);
            else if (biome === 'MOUNTAIN') baseColor.setHex(0x546e7a); // Blue-ish grey

            // Add noise to color for "Hyperrealistic" variance
            const noiseVal = this.noise.noise(x * 0.05, -y * 0.05);
            
            // Slope detection (simple)
            // We need neighboring heights to properly do slope texturing, 
            // but we can approximate with noise variance or just rely on the biome logic.
            
            // Mix
            color.copy(baseColor);
            
            // Darken based on noise (AO fake)
            color.multiplyScalar(0.8 + (noiseVal + 1) * 0.15);
            
            // Height based caps (Snow peaks in non-snow biomes)
            if (h > 45 && biome !== 'SNOW') {
                color.lerp(new THREE.Color(0xdddddd), (h - 45) / 20);
            }
            
            // Water/Beach level
            if (h < 4) {
                color.setHex(0xe0c080); // Sand edge / Underwater Sand
            }

            colors.push(color.r, color.g, color.b);
        }

        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.computeVertexNormals();
        geometry.rotateX(-Math.PI / 2); // Rotate to XZ plane

        const material = new THREE.MeshStandardMaterial({ 
            vertexColors: true,
            roughness: 0.8,
            metalness: 0.1,
            flatShading: false // Smooth shading for smoother look
        });

        this.ground = new THREE.Mesh(geometry, material);
        this.ground.receiveShadow = true;
        this.scene.add(this.ground);

        this.generateDetails();
        this.generateEnemies();
        
        // Generate Water
        this.waterSystem.create();

        // Generate Advanced Grass
        if (this.grassTexture) {
            this.grassSystem.generate(this.grassTexture, player);
        }

        // Environment
        const ambient = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambient);
        
        // Sun with warmer tone
        const sun = new THREE.DirectionalLight(0xfff0dd, 1.1);
        sun.position.set(150, 300, 100);
        sun.castShadow = true;
        sun.shadow.camera.near = 0.5;
        sun.shadow.camera.far = 1000;
        sun.shadow.camera.left = -200;
        sun.shadow.camera.right = 200;
        sun.shadow.camera.top = 200;
        sun.shadow.camera.bottom = -200;
        sun.shadow.mapSize.width = 4096; // Sharper shadows
        sun.shadow.mapSize.height = 4096;
        sun.shadow.bias = -0.0005;
        this.scene.add(sun);
        
        // Fog for atmosphere
        this.scene.fog = new THREE.Fog(0x87CEEB, 200, 900);
    }

    getHeight(x, z) {
        // Base Continent Shape (Island-ish)
        const dist = Math.sqrt(x*x + z*z);
        const islandMask = Math.max(0, 1.0 - Math.pow(dist / 950, 4)); // Falloff at edges
        
        // Large features
        let h = this.noise.fbm(x * 0.002, z * 0.002, 3, 0.5, 2.0) * 120;
        
        // Biome Specific Modifications
        const biome = this.getBiome(x, z);
        
        if (biome === 'MOUNTAIN') {
            h += Math.abs(this.noise.fbm(x * 0.01, z * 0.01, 5)) * 150;
        } else if (biome === 'GRASSLAND') {
            h *= 0.3; // Flatten
            h += this.noise.noise(x * 0.03, z * 0.03) * 2; // Rolling hills
        } else if (biome === 'DESERT') {
            h = this.noise.noise(x * 0.01, z * 0.01) * 15; // Dunes
            h += Math.sin(x * 0.05 + z * 0.02) * 5;
        } else if (biome === 'BADLANDS') {
            // Terraced look
            const raw = this.noise.fbm(x * 0.005, z * 0.005, 4);
            h = Math.floor(raw * 80 / 5) * 5; // Steps
        } else if (biome === 'FOREST') {
            h *= 0.5;
            h += this.noise.noise(x * 0.05, z * 0.05) * 5;
        }

        // Apply Mask
        return (h * islandMask) - (1.0 - islandMask) * 20; 
    }

    getBiome(x, z) {
        // Find closest region center
        let closest = this.regions[0];
        let minD = Infinity;
        
        // Add some noise to the position check for organic borders
        const warpX = x + this.noise.noise(x*0.01, z*0.01) * 100;
        const warpZ = z + this.noise.noise(z*0.01, x*0.01) * 100;

        for (let r of this.regions) {
            const dx = warpX - r.x;
            const dz = warpZ - r.z;
            const d = Math.sqrt(dx*dx + dz*dz);
            // Weight distance by region radius inverse to normalize influence? 
            // Simpler: Just check if inside radius with some bleed, otherwise default to Plains
            if (d < r.r) {
                // If multiple overlap, the closest center wins
                const realDist = Math.sqrt((warpX-r.x)**2 + (warpZ-r.z)**2);
                if (realDist < minD) {
                    minD = realDist;
                    closest = r;
                }
            }
        }
        return closest.biome;
    }

    getRegionName(x, z) {
         let closest = this.regions[0];
         let minD = Infinity;
         for (let r of this.regions) {
             const d = Math.sqrt((x-r.x)**2 + (z-r.z)**2);
             if (d < r.r * 1.2 && d < minD) {
                 minD = d;
                 closest = r;
             }
         }
         return closest.name;
    }

    generateDetails() {
        // 1. Grass System is now handled by GrassSystem.js
        // We skip the old manual InstancedMesh generation here.

        // 2. Trees and Rocks
        const treeGeo = new THREE.ConeGeometry(1.5, 6, 8); 
        const treeMat = new THREE.MeshStandardMaterial({ color: 0x1b5e20, flatShading: true, roughness: 0.9 });
        const trunkGeo = new THREE.CylinderGeometry(0.4, 0.5, 2, 6);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3e2723 });
        
        const rockGeo = new THREE.DodecahedronGeometry(1);
        const rockMat = new THREE.MeshStandardMaterial({ color: 0x757575 });

        // Ruins Pillars
        const pillarGeo = new THREE.CylinderGeometry(0.8, 0.8, 6, 8);
        const pillarMat = new THREE.MeshStandardMaterial({ color: 0x9e9e9e });

        const objectCount = 1500;
        
        for(let i=0; i<objectCount; i++) {
            const x = (Math.random() - 0.5) * 1600;
            const z = (Math.random() - 0.5) * 1600;
            const y = this.getHeight(x, z);
            
            if (y < 2) continue; // Water check

            const biome = this.getBiome(x, z);
            const slope = this.getSlopeFactor(x, z);

            if (slope > 0.8) continue; // Don't place on steep cliffs

            if (biome === 'FOREST') {
                const scale = 1 + Math.random();
                const tree = new THREE.Group();
                const trunk = new THREE.Mesh(trunkGeo, trunkMat);
                trunk.position.y = 1;
                trunk.castShadow = true;
                const leaves = new THREE.Mesh(treeGeo, treeMat);
                leaves.position.y = 4;
                leaves.castShadow = true;
                tree.add(trunk);
                tree.add(leaves);
                tree.position.set(x, y, z);
                tree.scale.setScalar(scale);
                this.scene.add(tree);
            } 
            else if (biome === 'BADLANDS') {
                 if (Math.random() > 0.8) {
                    // Ancient Ruins
                    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
                    pillar.position.set(x, y + 3, z);
                    pillar.rotation.z = (Math.random() - 0.5) * 0.5; // Ruined/tilted
                    pillar.castShadow = true;
                    this.scene.add(pillar);
                 } else {
                    const rock = new THREE.Mesh(rockGeo, new THREE.MeshStandardMaterial({color:0x8d6e63}));
                    rock.position.set(x, y + 1, z);
                    rock.scale.setScalar(2 + Math.random());
                    this.scene.add(rock);
                 }
            }
            else if (biome === 'MOUNTAIN') {
                const rock = new THREE.Mesh(rockGeo, rockMat);
                rock.position.set(x, y + 1, z);
                rock.scale.setScalar(3 + Math.random() * 3); // Giant boulders
                this.scene.add(rock);
            }
        }
    }

    getSlopeFactor(x, z) {
        // Sample height around point to determine slope
        const h = this.getHeight(x, z);
        const hx = this.getHeight(x+1, z);
        const hz = this.getHeight(x, z+1);
        const dx = Math.abs(h - hx);
        const dz = Math.abs(h - hz);
        return Math.max(dx, dz);
    }

    generateEnemies() {
        const loader = new THREE.TextureLoader();
        loader.load('enemy_texture.png', (tex) => {
            tex.magFilter = THREE.NearestFilter;
            this.enemies.forEach(e => {
                if (e.type.includes('GOBLIN')) e.setTexture(tex);
            });
        });

        const count = 200; 
        for(let i=0; i<count; i++) {
            const x = (Math.random() - 0.5) * 1600;
            const z = (Math.random() - 0.5) * 1600;
            const biome = this.getBiome(x, z);
            const y = this.getHeight(x, z);
            
            if (y < 2) continue;

            let type = 'GOBLIN';
            let level = 1 + Math.floor(Math.sqrt(x*x + z*z) / 50);

            if (biome === 'FOREST') type = Math.random() > 0.5 ? 'WOLF' : 'GOBLIN';
            if (biome === 'DESERT') type = Math.random() > 0.5 ? 'SAND_SLIME' : 'GOLEM';
            if (biome === 'SNOW') type = Math.random() > 0.6 ? 'SNOW_WOLF' : 'ICE_SPIRIT';
            if (biome === 'BADLANDS') type = 'MAGMA_GOLEM';
            if (biome === 'MOUNTAIN') type = 'GOLEM';

            const enemy = new Enemy(this.scene, x, z, type, level);
            enemy.mesh.position.y = y + enemy.yOffset;
            this.enemies.push(enemy);
        }
    }

    spawnItem(type, position) {
        const item = new Item(this.scene, type, position);
        this.items.push(item);
        return item;
    }

    update(dt, playerPos, camera) {
        this.enemies = this.enemies.filter(e => e.mesh !== null);
        this.enemies.forEach(e => {
             if(e.mesh) e.update(dt, playerPos, this);
        });
        
        this.items.forEach(item => item.update(dt, camera));

        if (this.grassSystem) {
            this.grassSystem.update(dt);
        }
        if (this.waterSystem) {
            this.waterSystem.update(dt);
        }
    }
}