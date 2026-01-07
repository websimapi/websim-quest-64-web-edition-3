import { getItemConfig } from './Item.js';

export class UIManager {
    constructor(player, combatSystem) {
        this.player = player;
        this.combatSystem = combatSystem;

        this.hpBar = document.getElementById('hp-bar');
        this.mpBar = document.getElementById('mp-bar');
        this.spiritStats = document.getElementById('spirit-stats');
        this.turnIndicator = document.getElementById('turn-indicator');
        this.moveBarContainer = document.getElementById('move-bar-container');
        this.moveBarFill = document.getElementById('move-bar-fill');
        this.messageBox = document.getElementById('message-box');
        this.levelupOverlay = document.getElementById('levelup-overlay');
        
        // Toolbelt & Inventory
        this.toolbeltContainer = document.getElementById('toolbelt-container');
        this.inventoryModal = document.getElementById('inventory-modal');
        this.inventoryGrid = document.getElementById('inventory-grid');
        this.editingSlot = null;

        // Inventory Close Button
        const closeInvBtn = document.getElementById('close-inv-btn');
        if (closeInvBtn) {
            closeInvBtn.addEventListener('click', () => this.closeInventory());
        }

        // Add Location Indicator
        this.locationDisplay = document.createElement('div');
        this.locationDisplay.style.cssText = "position:absolute; top:20px; width:100%; text-align:center; color:white; font-size:14px; text-shadow:2px 2px 0 #000; pointer-events:none;";
        document.body.appendChild(this.locationDisplay);

        this.messageTimer = null;
        this.lastSpiritState = "";
    }

    update(gameState, combatSystem) {
        this.updateLocation();
        this.updateStats();
        this.updateBattleHud(gameState, combatSystem);
        this.updateSpellDeck();
        this.updateCooldowns();
        this.updateToolbelt();
    }

    updateToolbelt() {
        if (!this.player || !this.toolbeltContainer) return;

        const slots = this.toolbeltContainer.querySelectorAll('.toolbelt-slot');
        this.player.stats.toolbelt.forEach((type, index) => {
            if (index >= slots.length) return;
            const slot = slots[index];
            const currentType = slot.dataset.type;
            const count = type ? (this.player.stats.inventory[type] || 0) : 0;
            const currentCount = slot.dataset.count;

            if (currentType !== String(type) || currentCount !== String(count)) {
                slot.dataset.type = type || '';
                slot.dataset.count = count;
                slot.innerHTML = '';
                
                if (type && count > 0) {
                    const config = getItemConfig(type);
                    
                    const icon = document.createElement('div');
                    icon.className = 'toolbelt-icon';
                    icon.style.backgroundColor = config.cssColor;
                    
                    const countBadge = document.createElement('div');
                    countBadge.className = 'toolbelt-count';
                    countBadge.innerText = count;
                    
                    slot.appendChild(icon);
                    slot.appendChild(countBadge);
                }
            }
        });
    }

    openInventory(slotIndex) {
        this.editingSlot = slotIndex;
        this.inventoryModal.style.display = 'flex';
        this.renderInventory();
    }

    closeInventory() {
        this.inventoryModal.style.display = 'none';
        this.editingSlot = null;
    }

    renderInventory() {
        this.inventoryGrid.innerHTML = '';
        
        // Items list
        const items = Object.entries(this.player.stats.inventory);
        let hasItems = false;

        items.forEach(([type, count]) => {
            if (count > 0) {
                hasItems = true;
                const config = getItemConfig(type);
                
                const div = document.createElement('div');
                div.className = 'inv-item';
                div.innerHTML = `
                    <div class="toolbelt-icon" style="background:${config.cssColor}; width:20px; height:20px;"></div>
                    <div>
                        <div>${config.name}</div>
                        <div style="color:#888;">x${count}</div>
                    </div>
                `;
                
                div.onclick = () => {
                    this.player.stats.toolbelt[this.editingSlot] = type;
                    this.closeInventory();
                };
                
                this.inventoryGrid.appendChild(div);
            }
        });

        // Add "Empty" option
        const clearDiv = document.createElement('div');
        clearDiv.className = 'inv-item';
        clearDiv.innerHTML = `<div>EMPTY SLOT</div>`;
        clearDiv.onclick = () => {
            this.player.stats.toolbelt[this.editingSlot] = null;
            this.closeInventory();
        };
        this.inventoryGrid.appendChild(clearDiv);
    }

    updateCooldowns() {
        if (!this.player) return;
        
        ['fire', 'water', 'earth', 'wind'].forEach(el => {
            const btns = document.querySelectorAll('.spell-btn');
            btns.forEach(btn => {
                if (btn.dataset.el === el) {
                    const cd = this.player.cooldowns[el];
                    if (cd > 0) {
                        btn.style.opacity = 0.4;
                        btn.style.borderColor = '#555';
                        btn.innerText = cd.toFixed(1);
                    } else {
                        btn.style.opacity = 1.0;
                        btn.style.borderColor = 'white';
                        if (btn.innerText !== el.toUpperCase()) {
                             btn.innerText = el.toUpperCase();
                        }
                    }
                }
            });
        });
    }

    updateSpellDeck() {
        if (!this.player) return;
        
        // Check if update needed
        const currentState = JSON.stringify(this.player.spirits);
        if (currentState === this.lastSpiritState) return;
        this.lastSpiritState = currentState;

        // Sort elements by level desc
        const entries = Object.entries(this.player.spirits).map(([key, val]) => ({ key, val }));
        // Sort: Value desc, then Alphabetical desc (Wind > Water > Fire > Earth) just to be deterministic
        entries.sort((a,b) => {
            if (b.val !== a.val) return b.val - a.val;
            return a.key.localeCompare(b.key);
        });

        const main = entries[0];
        const subs = entries.slice(1);

        this.setSpellBtn('#spell-main', main.key);
        this.setSpellBtn('#spell-sub-1', subs[0].key);
        this.setSpellBtn('#spell-sub-2', subs[1].key);
        this.setSpellBtn('#spell-sub-3', subs[2].key);
    }

    setSpellBtn(selector, element) {
        const btn = document.querySelector(selector);
        if (!btn) return;
        
        btn.dataset.el = element;
        btn.innerText = element.toUpperCase();
        
        const colors = {
            fire: '#d32f2f',
            water: '#1976d2',
            earth: '#388e3c',
            wind: '#fbc02d'
        };
        btn.style.backgroundColor = colors[element];
        btn.style.color = element === 'wind' ? 'black' : 'white';
    }

    updateLocation() {
        if (this.player && this.combatSystem && this.combatSystem.world) {
             const name = this.combatSystem.world.getRegionName(this.player.mesh.position.x, this.player.mesh.position.z);
             if (this.locationDisplay.innerText !== name) {
                 this.locationDisplay.innerText = name;
                 this.locationDisplay.style.animation = 'none';
                 this.locationDisplay.offsetHeight; /* trigger reflow */
                 this.locationDisplay.style.animation = 'fadeIn 2s';
             }
        }
    }

    updateStats() {
        if (!this.player) return;
        const { hp, maxHp, mp, maxMp } = this.player.stats;
        const s = this.player.spirits;

        if (this.hpBar) {
            this.hpBar.innerText = `HP: ${Math.floor(hp)}/${maxHp}`;
        }
        if (this.mpBar) {
            this.mpBar.innerText = `MP: ${Math.floor(mp)}/${maxMp}`;
        }
        if (this.spiritStats) {
            this.spiritStats.innerHTML =
                `<span style="color:#d32f2f">FIRE: ${s.fire}</span><br>` +
                `<span style="color:#1976d2">WATER: ${s.water}</span><br>` +
                `<span style="color:#388e3c">EARTH: ${s.earth}</span><br>` +
                `<span style="color:#fbc02d">WIND: ${s.wind}</span>`;
        }
    }

    updateBattleHud(gameState, combatSystem) {
        if (!this.turnIndicator || !this.moveBarContainer || !this.moveBarFill) return;

        if (gameState === 'BATTLE' && combatSystem) {
            this.turnIndicator.style.display = 'block';
            this.turnIndicator.innerText = combatSystem.turn + " TURN";
            this.turnIndicator.style.color = combatSystem.turn === 'PLAYER' ? '#00ff00' : '#ff0000';

            if (combatSystem.turn === 'PLAYER') {
                this.moveBarContainer.style.display = 'block';
                const pct = Math.max(0, (combatSystem.currentMove / combatSystem.maxMove) * 100);
                this.moveBarFill.style.width = pct + '%';
            } else {
                this.moveBarContainer.style.display = 'none';
            }
        } else {
            this.turnIndicator.style.display = 'none';
            this.moveBarContainer.style.display = 'none';
        }
    }

    showMessage(msg, duration = 0) {
        if (!this.messageBox) return;

        this.messageBox.style.display = msg ? 'block' : 'none';
        this.messageBox.textContent = msg || '';

        if (this.messageTimer) {
            clearTimeout(this.messageTimer);
            this.messageTimer = null;
        }

        if (duration > 0 && msg) {
            this.messageTimer = setTimeout(() => {
                if (!this.messageBox) return;
                this.messageBox.style.display = 'none';
                this.messageBox.textContent = "";
                this.messageTimer = null;
            }, duration);
        }
    }

    showLevelUpMenu(onElementChosen) {
        if (!this.levelupOverlay) return;

        const overlay = this.levelupOverlay;
        const infoP = overlay.querySelector('p');
        if (infoP) {
            infoP.innerText = "Grant 1 Spirit Point to an element:";
        }
        overlay.style.display = 'flex';

        const cleanup = () => {
            overlay.style.display = 'none';
            ['lvl-fire', 'lvl-water', 'lvl-earth', 'lvl-wind'].forEach(id => {
                const btn = document.getElementById(id);
                if (btn) btn.onclick = null;
            });
        };

        const handler = (elementKey) => {
            if (typeof onElementChosen === 'function') {
                onElementChosen(elementKey);
            }
            cleanup();
        };

        const fireBtn = document.getElementById('lvl-fire');
        const waterBtn = document.getElementById('lvl-water');
        const earthBtn = document.getElementById('lvl-earth');
        const windBtn = document.getElementById('lvl-wind');

        if (fireBtn) fireBtn.onclick = () => handler('fire');
        if (waterBtn) waterBtn.onclick = () => handler('water');
        if (earthBtn) earthBtn.onclick = () => handler('earth');
        if (windBtn) windBtn.onclick = () => handler('wind');
    }
}