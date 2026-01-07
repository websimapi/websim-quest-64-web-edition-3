import * as THREE from 'three';

export class PlayerModel {
    constructor(scene) {
        this.scene = scene;
        this.mesh = new THREE.Group();
        this.model = null; // Container for bobbing animations
        this.rightArm = null;
        this.leftArm = null;
        this.staffMesh = null;
    }

    create() {
        // Detailed Magical Girl Model Construction
        const skinMat = new THREE.MeshStandardMaterial({ color: 0xffe0bd, roughness: 0.5 }); // Pale skin
        const dressMat = new THREE.MeshStandardMaterial({ color: 0x3366cc, roughness: 0.7 }); // Blue dress
        const accentMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }); // White accents
        const hairMat = new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.6 }); // Blonde hair
        const staffMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63 });
        const gemMat = new THREE.MeshStandardMaterial({ color: 0xff0055, emissive: 0xaa0033, emissiveIntensity: 0.5 });

        // Container for bobbing animations
        this.model = new THREE.Group();
        this.mesh.add(this.model);

        // -- TORSO & DRESS --
        // Skirt (Cone-ish)
        const skirtGeo = new THREE.ConeGeometry(0.5, 0.8, 8, 1, true);
        const skirt = new THREE.Mesh(skirtGeo, dressMat);
        skirt.position.y = 0.4;
        skirt.castShadow = true;
        this.model.add(skirt);
        
        // Underskirt fill
        const skirtFill = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.1, 8), accentMat);
        skirtFill.position.y = -0.35;
        skirt.add(skirtFill);

        // Chest
        const chestGeo = new THREE.CylinderGeometry(0.25, 0.35, 0.5, 8);
        const torso = new THREE.Mesh(chestGeo, accentMat);
        torso.position.y = 1.05;
        torso.castShadow = true;
        this.model.add(torso);

        // Vest/Top layer
        const vestGeo = new THREE.CylinderGeometry(0.26, 0.36, 0.3, 8);
        const vest = new THREE.Mesh(vestGeo, dressMat);
        vest.position.y = 0.05;
        torso.add(vest);

        // -- HEAD --
        const headGeo = new THREE.BoxGeometry(0.35, 0.4, 0.35); 
        const head = new THREE.Mesh(headGeo, skinMat);
        head.position.y = 1.6;
        head.castShadow = true;
        this.model.add(head);

        // Eyes (Simple planes)
        const eyeGeo = new THREE.PlaneGeometry(0.08, 0.1);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0044aa });
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.1, 0.05, 0.18);
        head.add(leftEye);
        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.1, 0.05, 0.18);
        head.add(rightEye);

        // -- HAIR --
        // 1. Hair Cap (Base layer to prevent bald spots)
        const capGeo = new THREE.BoxGeometry(0.37, 0.22, 0.37);
        const hairCap = new THREE.Mesh(capGeo, hairMat);
        hairCap.position.set(0, 0.1, 0); // Top of head
        head.add(hairCap);

        // 2. Bangs (More detailed)
        // Center Bangs
        const bangsCenterGeo = new THREE.BoxGeometry(0.14, 0.18, 0.05);
        const bangsCenter = new THREE.Mesh(bangsCenterGeo, hairMat);
        bangsCenter.position.set(0, 0.05, 0.18);
        head.add(bangsCenter);
        
        // Left Side Bang
        const bangsSideGeo = new THREE.BoxGeometry(0.12, 0.25, 0.05);
        const bangsLeft = new THREE.Mesh(bangsSideGeo, hairMat);
        bangsLeft.position.set(-0.13, 0.0, 0.18);
        bangsLeft.rotation.z = 0.1;
        head.add(bangsLeft);
        
        // Right Side Bang
        const bangsRight = new THREE.Mesh(bangsSideGeo, hairMat);
        bangsRight.position.set(0.13, 0.0, 0.18);
        bangsRight.rotation.z = -0.1;
        head.add(bangsRight);

        // 3. Side Locks (Framing the face)
        const sideLockGeo = new THREE.BoxGeometry(0.08, 0.45, 0.12);
        const leftLock = new THREE.Mesh(sideLockGeo, hairMat);
        leftLock.position.set(-0.19, -0.1, 0.12);
        head.add(leftLock);
        
        const rightLock = new THREE.Mesh(sideLockGeo, hairMat);
        rightLock.position.set(0.19, -0.1, 0.12);
        head.add(rightLock);

        // 4. Back Hair (Fuller)
        const backHairGeo = new THREE.BoxGeometry(0.42, 0.9, 0.2);
        const backHair = new THREE.Mesh(backHairGeo, hairMat);
        backHair.position.set(0, -0.2, -0.12);
        backHair.rotation.x = 0.15; 
        head.add(backHair);

        // 5. Twin Tails (More dynamic)
        const tailGeo = new THREE.BoxGeometry(0.12, 0.7, 0.12);
        
        const leftTail = new THREE.Mesh(tailGeo, hairMat);
        leftTail.position.set(-0.28, 0.1, -0.05);
        leftTail.rotation.z = 0.3;
        leftTail.rotation.x = 0.1;
        head.add(leftTail);
        
        const rightTail = new THREE.Mesh(tailGeo, hairMat);
        rightTail.position.set(0.28, 0.1, -0.05);
        rightTail.rotation.z = -0.3;
        rightTail.rotation.x = 0.1;
        head.add(rightTail);

        // -- ARMS --
        const armGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.5);
        
        // Left Arm
        this.leftArm = new THREE.Group();
        this.leftArm.position.set(-0.35, 1.15, 0);
        const laMesh = new THREE.Mesh(armGeo, skinMat);
        laMesh.position.y = -0.2; // Pivot from shoulder
        laMesh.castShadow = true;
        this.leftArm.add(laMesh);
        // Sleeve
        const sleeveGeo = new THREE.CylinderGeometry(0.1, 0.15, 0.2);
        const laSleeve = new THREE.Mesh(sleeveGeo, dressMat);
        laSleeve.position.y = 0;
        this.leftArm.add(laSleeve);
        this.model.add(this.leftArm);

        // Right Arm (Holding Staff)
        this.rightArm = new THREE.Group();
        this.rightArm.position.set(0.35, 1.15, 0);
        const raMesh = new THREE.Mesh(armGeo, skinMat);
        raMesh.position.y = -0.2;
        raMesh.castShadow = true;
        this.rightArm.add(raMesh);
        const raSleeve = new THREE.Mesh(sleeveGeo, dressMat);
        raSleeve.position.y = 0;
        this.rightArm.add(raSleeve);
        this.model.add(this.rightArm);

        // -- STAFF --
        const staffStickGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.8);
        this.staffMesh = new THREE.Mesh(staffStickGeo, staffMat);
        this.staffMesh.rotation.x = Math.PI / 2; // Perpendicular to arm
        this.staffMesh.position.set(0, -0.4, 0.5); // Hold in hand
        
        // Staff Head
        const staffTopGeo = new THREE.TorusGeometry(0.15, 0.03, 8, 16);
        const staffTop = new THREE.Mesh(staffTopGeo, accentMat); // Gold/White ring
        staffTop.position.y = 0.9;
        this.staffMesh.add(staffTop);

        const gemGeo = new THREE.OctahedronGeometry(0.08);
        const gem = new THREE.Mesh(gemGeo, gemMat);
        gem.position.y = 0.9;
        this.staffMesh.add(gem);

        this.rightArm.add(this.staffMesh);
        
        // Default pose
        this.rightArm.rotation.x = -0.5; // Angled slightly forward
        this.leftArm.rotation.z = 0.2;

        this.scene.add(this.mesh);
    }

    animate(isMoving, castTimer, castMaxTime) {
        if (castTimer > 0) {
            // Casting Animation (shake)
            const vibration = Math.sin(Date.now() * 0.05) * 0.02;
            if(this.model) this.model.position.x = vibration;
            
            // Animate staff to point forward
            // Staff is child of rightArm.
            if(this.rightArm) {
                const progress = 1 - (castTimer / castMaxTime);
                // Rotate arm forward (+1.5 is forward, -0.5 is default)
                this.rightArm.rotation.x = -0.5 + (2.0) * progress;
                
                // Rotate staff to align with arm (point forward)
                if(this.staffMesh) {
                    this.staffMesh.rotation.x = (Math.PI / 2) + (Math.PI / 2) * progress;
                }
            }
        } else {
            // Reset Casting artifacts
            if(this.model) this.model.position.x = 0; // Reset vibration
            if (this.staffMesh) this.staffMesh.rotation.x = Math.PI / 2;
            
            if (isMoving) {
                // Bobbing animation
                const walkCycle = Date.now() * 0.015;
                if(this.model) this.model.position.y = Math.sin(walkCycle * 2) * 0.05;
                
                // Arm swing
                if (this.leftArm) this.leftArm.rotation.x = Math.sin(walkCycle) * 0.5;
                if (this.rightArm) this.rightArm.rotation.x = -0.5 + Math.sin(walkCycle + Math.PI) * 0.5;
            } else {
                 // Idle
                 if(this.model) this.model.position.y = 0;
                 if (this.leftArm) this.leftArm.rotation.x = THREE.MathUtils.lerp(this.leftArm.rotation.x, 0, 0.1);
                 if (this.rightArm) this.rightArm.rotation.x = THREE.MathUtils.lerp(this.rightArm.rotation.x, -0.5, 0.1);
            }
        }
    }

    getStaffTipWorldState() {
        if (!this.staffMesh) return { position: this.mesh.position, quaternion: this.mesh.quaternion };

        const tipPos = new THREE.Vector3(0, 0.9, 0).applyMatrix4(this.staffMesh.matrixWorld);
        const handlePos = new THREE.Vector3(0, -0.9, 0).applyMatrix4(this.staffMesh.matrixWorld);
        
        const dummy = new THREE.Object3D();
        dummy.position.copy(handlePos);
        dummy.lookAt(tipPos);

        return {
            position: tipPos,
            quaternion: dummy.quaternion
        };
    }
}