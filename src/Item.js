import * as THREE from 'three';

export function getItemConfig(type) {
    switch (type) {
        case 'HP_POTION':
            return { 
                name: 'Health Potion', 
                color: 0xff3333, 
                cssColor: '#ff3333',
                value: 20, 
                stat: 'hp',
                desc: "Restores 20 HP"
            };
        case 'MP_POTION':
            return { 
                name: 'Mana Potion', 
                color: 0x3333ff, 
                cssColor: '#3333ff',
                value: 15, 
                stat: 'mp',
                desc: "Restores 15 MP"
            };
        case 'ELIXIR':
            return { 
                name: 'Elixir', 
                color: 0xffd700, 
                cssColor: '#ffd700',
                value: 50, 
                stat: 'all',
                desc: "Fully Restores Status"
            };
        case 'HERB':
            return {
                name: 'Medicinal Herb',
                color: 0x4caf50,
                cssColor: '#4caf50',
                value: 10, 
                stat: 'hp',
                desc: "Restores 10 HP"
            };
        default:
            return { name: 'Unknown', color: 0xffffff, cssColor: '#ffffff', value: 0 };
    }
}

export class Item {
    constructor(scene, type, position) {
        this.scene = scene;
        this.type = type;
        this.position = position.clone();
        this.isCollected = false;
        
        // Config based on type
        this.config = this.getConfig(type);
        
        // Mesh generation
        this.mesh = this.createMesh();
        this.mesh.position.copy(this.position);
        this.mesh.position.y += 0.5; // Float
        this.scene.add(this.mesh);

        // Animation
        this.floatOffset = Math.random() * Math.PI * 2;
    }

    getConfig(type) {
        return getItemConfig(type);
    }

    createMesh() {
        const group = new THREE.Group();

        let geo, mat;
        
        if (this.type.includes('POTION') || this.type === 'ELIXIR') {
            // Bottle shape
            const bodyGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.3, 8);
            const neckGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.15, 8);
            mat = new THREE.MeshStandardMaterial({ 
                color: this.config.color, 
                roughness: 0.2, 
                metalness: 0.5,
                emissive: this.config.color,
                emissiveIntensity: 0.2
            });
            
            const body = new THREE.Mesh(bodyGeo, mat);
            const neck = new THREE.Mesh(neckGeo, new THREE.MeshStandardMaterial({ color: 0xffffff }));
            neck.position.y = 0.225;
            
            group.add(body);
            group.add(neck);
        } else if (this.type === 'HERB') {
            geo = new THREE.DodecahedronGeometry(0.2);
            mat = new THREE.MeshStandardMaterial({ color: this.config.color, flatShading: true });
            const mesh = new THREE.Mesh(geo, mat);
            group.add(mesh);
        }

        // Glow particle/halo
        const haloGeo = new THREE.PlaneGeometry(0.8, 0.8);
        const haloMat = new THREE.MeshBasicMaterial({ 
            color: this.config.color, 
            transparent: true, 
            opacity: 0.4, 
            side: THREE.DoubleSide 
        });
        const halo = new THREE.Mesh(haloGeo, haloMat);
        halo.rotation.x = 0; // Billboarded usually, but here just facing camera? 
        // We'll make it spin or face camera in update if we cared, for now just flat
        group.add(halo);
        this.halo = halo;

        // Shadow/Base
        const shadowGeo = new THREE.CircleGeometry(0.3, 16);
        const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 });
        const shadow = new THREE.Mesh(shadowGeo, shadowMat);
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.y = -0.5; // On ground
        group.add(shadow);

        return group;
    }

    update(dt, camera) {
        if (this.isCollected) return;

        // Bob
        const t = Date.now() * 0.003 + this.floatOffset;
        this.mesh.position.y = this.position.y + 0.5 + Math.sin(t) * 0.1;
        this.mesh.rotation.y += dt;

        // Billboarding halo
        if (this.halo && camera) {
            this.halo.lookAt(camera.position);
        }
    }

    dispose() {
        this.scene.remove(this.mesh);
        // Traverse and dispose geometry/materials if strictly needed
    }
}