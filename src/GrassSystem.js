import * as THREE from 'three';

export class GrassSystem {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        
        // LOD Configuration
        this.chunkSize = 25; // Small chunks for fine-grained culling/loading
        this.renderRadius = 3; // Radius in chunks to render around player
        
        this.activeChunks = new Map(); // Key: "x,z", Value: Mesh
        this.player = null;
        
        this.uniforms = {
            time: { value: 0 },
            playerPos: { value: new THREE.Vector3() }
        };
        
        this.bladeGeometry = null;
        this.material = null;
        this.depthMaterial = null;
        this.grassTexture = null;
    }

    generate(grassTexture, player) {
        this.player = player;
        this.grassTexture = grassTexture;

        // --- 1. Construct Tapered Blade Geometry ---
        // A simple curved blade shape (Triangle-ish)
        // 5 vertices: 
        // 0: Bottom Left
        // 1: Bottom Right
        // 2: Mid Left
        // 3: Mid Right
        // 4: Top
        
        const bladeWidth = 0.12;
        const bladeHeight = 1.0;
        const midHeight = 0.4;
        
        const positions = [
            -bladeWidth/2, 0, 0,      // 0
             bladeWidth/2, 0, 0,      // 1
            -bladeWidth/3, midHeight, 0.1, // 2 (slight curve Z)
             bladeWidth/3, midHeight, 0.1, // 3
             0, bladeHeight, 0.3      // 4 (Top, curve Z)
        ];
        
        const indices = [
            0, 1, 2,
            2, 1, 3,
            2, 3, 4
        ];
        
        // UVs for gradient
        const uvs = [
            0, 0,
            1, 0,
            0, 0.4,
            1, 0.4,
            0.5, 1.0
        ];

        this.bladeGeometry = new THREE.BufferGeometry();
        this.bladeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        this.bladeGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        this.bladeGeometry.setIndex(indices);
        this.bladeGeometry.computeVertexNormals();
        
        // Bounding sphere for culling must allow for chunk size
        this.bladeGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0,0,0), this.chunkSize * 1.5);

        // --- 2. Material with Custom Shader ---
        this.material = new THREE.MeshStandardMaterial({
            color: 0xffffff, // Driven by shader
            roughness: 0.4,
            metalness: 0.0,
            side: THREE.DoubleSide
        });

        const onBeforeCompile = (shader) => {
            shader.uniforms.time = this.uniforms.time;
            shader.uniforms.playerPos = this.uniforms.playerPos;
            
            shader.vertexShader = `
                uniform float time;
                uniform vec3 playerPos;
                varying float vHeight;
                varying vec3 vWorldPos;
                
                ${shader.vertexShader}
            `;
            
            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `
                #include <begin_vertex>
                
                vHeight = uv.y;
                
                // Instance World Position (using instanceMatrix)
                vec4 instPos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
                vWorldPos = instPos.xyz;
                
                // --- WIND ANIMATION ---
                // Simple Perlin-ish Approximation
                float freq = 0.4;
                float speed = 1.5;
                float windX = sin(time * speed + instPos.x * freq + instPos.z * freq * 0.5);
                float windZ = cos(time * speed * 0.8 + instPos.x * freq * 0.5 + instPos.z * freq);
                
                // Detail turbulence
                float turb = sin(time * 3.0 + instPos.x + instPos.z);
                
                float strength = 0.2 + 0.1 * turb;
                float bend = pow(vHeight, 2.0); // Stiff bottom, bendy top
                
                transformed.x += windX * strength * bend;
                transformed.z += windZ * strength * bend;
                transformed.y -= abs(windX) * strength * 0.2 * bend; // Minor dip when bending
                
                // --- INTERACTION ---
                float dist = distance(instPos.xyz, playerPos);
                float radius = 2.5;
                
                if (dist < radius) {
                    float push = (1.0 - dist/radius);
                    push = push * push; // Smooth ease
                    
                    // Flatten grass near player
                    transformed.y *= (1.0 - push * 0.8);
                    
                    // Spread out fake
                    transformed.x += push * 0.5;
                    transformed.z += push * 0.5;
                }
                `
            );

            shader.fragmentShader = `
                varying float vHeight;
                varying vec3 vWorldPos;
                ${shader.fragmentShader}
            `;
            
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <color_fragment>',
                `
                #include <color_fragment>
                
                // Gradient Colors
                vec3 colBottom = vec3(0.05, 0.2, 0.02); // Dark rich green
                vec3 colTop = vec3(0.4, 0.75, 0.2); // Vibrant lime
                
                // Add some world-based noise variation
                float noise = sin(vWorldPos.x * 0.1) * cos(vWorldPos.z * 0.1);
                colTop += noise * 0.05;

                vec3 finalCol = mix(colBottom, colTop, vHeight);
                
                // Specular Shine
                float shine = smoothstep(0.8, 1.0, vHeight);
                finalCol += vec3(0.1, 0.2, 0.1) * shine;
                
                diffuseColor.rgb *= finalCol;
                `
            );
        };
        
        this.material.onBeforeCompile = onBeforeCompile;
        
        // Depth material for shadow casting
        this.depthMaterial = new THREE.MeshDepthMaterial({
            depthPacking: THREE.RGBADepthPacking,
        });
        this.depthMaterial.onBeforeCompile = onBeforeCompile;
    }

    update(dt) {
        this.uniforms.time.value += dt;
        
        if (!this.player || !this.player.mesh) return;
        
        this.uniforms.playerPos.value.copy(this.player.mesh.position);
        
        // --- DYNAMIC CHUNK LOADING ---
        // Get player chunk coord
        const px = this.player.mesh.position.x;
        const pz = this.player.mesh.position.z;
        
        const chunkX = Math.floor(px / this.chunkSize);
        const chunkZ = Math.floor(pz / this.chunkSize);
        
        const neededChunks = new Set();
        
        // Determine chunks in radius
        for (let x = -this.renderRadius; x <= this.renderRadius; x++) {
            for (let z = -this.renderRadius; z <= this.renderRadius; z++) {
                const cx = chunkX + x;
                const cz = chunkZ + z;
                // Circular check
                if (x*x + z*z > this.renderRadius * this.renderRadius) continue;
                
                const key = `${cx},${cz}`;
                neededChunks.add(key);
                
                if (!this.activeChunks.has(key)) {
                    this.createChunk(cx, cz);
                }
            }
        }
        
        // Unload old chunks
        for (const [key, mesh] of this.activeChunks) {
            if (!neededChunks.has(key)) {
                this.disposeChunk(key);
            }
        }
    }

    createChunk(cx, cz) {
        // High density count
        const density = 600; // Blades per chunk
        const dummy = new THREE.Object3D();
        const matrices = [];
        
        // Base chunk position
        const baseX = cx * this.chunkSize;
        const baseZ = cz * this.chunkSize;
        
        for (let i = 0; i < density; i++) {
            const lx = Math.random() * this.chunkSize;
            const lz = Math.random() * this.chunkSize;
            const wx = baseX + lx;
            const wz = baseZ + lz;
            
            // Validate Position
            const biome = this.world.getBiome(wx, wz);
            if (biome !== 'GRASSLAND' && biome !== 'FOREST') continue;
            
            const h = this.world.getHeight(wx, wz);
            if (h < 2.5) continue; // Water
            
            const slope = this.world.getSlopeFactor(wx, wz);
            if (slope > 0.8) continue;
            
            // Randomize transforms
            dummy.position.set(wx, h, wz);
            dummy.rotation.set(
                (Math.random() - 0.5) * 0.2, // Slight random tilt X
                Math.random() * Math.PI * 2, // Random Yaw
                (Math.random() - 0.5) * 0.2  // Slight random tilt Z
            );
            
            // Random Scale
            const s = 0.8 + Math.random() * 0.6;
            dummy.scale.set(s, s * (0.8 + Math.random() * 0.4), s);
            
            dummy.updateMatrix();
            matrices.push(dummy.matrix.clone());
        }
        
        if (matrices.length === 0) {
            this.activeChunks.set(`${cx},${cz}`, null); // Mark visited empty
            return;
        }
        
        const mesh = new THREE.InstancedMesh(this.bladeGeometry, this.material, matrices.length);
        mesh.castShadow = false; // Shadows on grass are expensive, rely on self-shade
        mesh.receiveShadow = true;
        mesh.customDepthMaterial = this.depthMaterial;
        
        for (let i = 0; i < matrices.length; i++) {
            mesh.setMatrixAt(i, matrices[i]);
        }
        
        mesh.instanceMatrix.needsUpdate = true;
        this.scene.add(mesh);
        this.activeChunks.set(`${cx},${cz}`, mesh);
    }

    disposeChunk(key) {
        const mesh = this.activeChunks.get(key);
        if (mesh) {
            this.scene.remove(mesh);
            mesh.dispose(); // Custom dispose if extended
        }
        this.activeChunks.delete(key);
    }
}