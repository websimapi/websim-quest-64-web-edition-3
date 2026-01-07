import * as THREE from 'three';

export class CameraController {
    constructor(camera, targetObject = null) {
        this.camera = camera;
        this.targetObject = targetObject;

        this.state = {
            radius: 12,
            theta: Math.PI,
            phi: Math.PI * 0.35,
            target: new THREE.Vector3()
        };
    }

    setTarget(object3D) {
        this.targetObject = object3D;
    }

    rotate(dx, dy) {
        const sensitivity = 0.012;
        this.state.theta -= dx * sensitivity;
        this.state.phi -= dy * sensitivity;

        // Clamp vertical rotation
        this.state.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.1, this.state.phi));
    }

    update() {
        if (!this.targetObject) return;

        const playerPos = this.targetObject.position;
        const center = new THREE.Vector3(playerPos.x, playerPos.y + 1.5, playerPos.z);

        this.state.target.lerp(center, 0.1);

        const r = this.state.radius;
        const theta = this.state.theta;
        const phi = this.state.phi;

        const x = r * Math.sin(phi) * Math.sin(theta);
        const y = r * Math.cos(phi);
        const z = r * Math.sin(phi) * Math.cos(theta);

        this.camera.position.copy(this.state.target).add(new THREE.Vector3(x, y, z));
        this.camera.lookAt(this.state.target);

        // Compass update
        const compassArrow = document.getElementById('compass-arrow');
        if (compassArrow && this.targetObject && this.targetObject.quaternion) {
            const playerForward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.targetObject.quaternion);
            const angle = Math.atan2(playerForward.x, playerForward.z);
            compassArrow.style.transform = `translate(-50%, -100%) rotate(${-angle}rad)`;
        }
    }
}