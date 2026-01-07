import * as THREE from 'three';

export class InteractionSystem {
    constructor(game) {
        this.game = game;
        this.raycaster = new THREE.Raycaster();
    }

    handleTap(x, y) {
        // Prevent click if clicking UI
        const el = document.elementFromPoint(x, y);
        if (el && el !== this.game.renderer.domElement) return;

        const mouse = new THREE.Vector2();
        mouse.x = (x / window.innerWidth) * 2 - 1;
        mouse.y = -(y / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(mouse, this.game.camera);

        // 1. Check Items (Priority over move)
        if (this.game.gameState === 'ROAMING' && this.game.world.items.length > 0) {
             const itemMeshes = this.game.world.items.map(i => i.mesh);
             const intersects = this.raycaster.intersectObjects(itemMeshes, true);
             if (intersects.length > 0) {
                 const hitObj = intersects[0].object;
                 const targetItem = this.game.world.items.find(i => {
                     let current = hitObj;
                     while(current) { if (current === i.mesh) return true; current = current.parent; }
                     return false;
                 });

                 if (targetItem) {
                     this.game.player.navTarget = targetItem.position.clone(); // Walk to it
                     this.game.targetItem = targetItem;
                     this.game.uiManager.showMessage(targetItem.config.name, 1000);
                     return;
                 }
             }
        }

        // 2. Check Enemies (Priority)
        const enemies = (this.game.gameState === 'BATTLE') 
            ? this.game.combatSystem.activeEnemies 
            : this.game.world.enemies.filter(e => e.hp > 0);
            
        const enemyMeshes = enemies.map(e => e.mesh).filter(m => m);
        if (enemyMeshes.length > 0) {
            const intersects = this.raycaster.intersectObjects(enemyMeshes, true);
            if (intersects.length > 0) {
                const hitObj = intersects[0].object;
                const target = enemies.find(e => {
                    let current = hitObj;
                    while(current) { if (current === e.mesh) return true; current = current.parent; }
                    return false;
                });
                
                if (target) {
                    target.highlight();
                    this.game.targetItem = null; // Cancel item pickup
                    if (this.game.gameState === 'BATTLE') {
                        const result = this.game.combatSystem.tryFaceTarget(target);
                        if (!result.success && result.reason === 'Not enough movement') {
                            this.game.uiManager.showMessage("Not enough movement!", 1000);
                        }
                    } else {
                        // Roaming: Just face them
                        this.game.player.faceTarget(target.mesh.position);
                    }
                    return; // Handled enemy click
                }
            }
        }

        // 3. Check Ground (Move)
        if (this.game.world.ground) {
            const intersects = this.raycaster.intersectObject(this.game.world.ground);
            if (intersects.length > 0) {
                const pt = intersects[0].point;
                // Update nav target - works for both states now
                this.game.player.navTarget = pt;
                this.game.targetItem = null; // Cancel item pickup on manual move
            }
        }
    }
}