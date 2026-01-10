// Carriage Shake Module für FoundryVTT - Scene Flag basiert (OHNE Sockets!)
const MODULE_ID = "geanos-carriage-shake";

class CarriageShake {
    constructor() {
        this.isActive = false;
        this.interval = null;
        this.originalPivot = null;
        this.intensity = 6;
        this.speed = 45;
        this.variation = 0.8;
    }

    startShake(intensity = 6) {
        if (this.isActive) return;

        this.intensity = intensity;
        this.isActive = true;

        // Speichere die Basisposition VOR jedem Shake-Update
        this.baseX = canvas.stage.pivot.x;
        this.baseY = canvas.stage.pivot.y;

        this.interval = setInterval(() => {
            // Hol die AKTUELLE Position (die könnte sich durch Pan geändert haben)
            const currentX = canvas.stage.pivot.x;
            const currentY = canvas.stage.pivot.y;

            // Berechne die Differenz zum letzten Frame
            const deltaX = currentX - this.baseX;
            const deltaY = currentY - this.baseY;

            // Update Basis wenn sich Position geändert hat (User hat gepannt)
            if (Math.abs(deltaX) > 0.1 || Math.abs(deltaY) > 0.1) {
                this.baseX = currentX;
                this.baseY = currentY;
            }

            // Shake relativ zur aktuellen Basis
            const randomX = (Math.random() - 0.5) * this.intensity * this.variation;
            const randomY = (Math.random() - 0.5) * this.intensity * this.variation;
            const wave = Math.sin(Date.now() / 200) * (this.intensity * 0.4);

            canvas.stage.pivot.set(
                this.baseX + randomX + wave,
                this.baseY + randomY
            );
        }, this.speed);

        ui.notifications.info("🐴 Kutschenfahrt gestartet");
        console.log(`${MODULE_ID} | Shake started with intensity ${intensity}`);
    }

    stopShake() {
        if (!this.isActive) return;

        this.isActive = false;

        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }

        // Zur letzten Basisposition zurückkehren (ohne Shake-Offset)
        if (this.baseX !== undefined && this.baseY !== undefined) {
            canvas.stage.pivot.set(this.baseX, this.baseY);
        }

        ui.notifications.info("🛑 Kutschenfahrt beendet");
        console.log(`${MODULE_ID} | Shake stopped`);
    }
}

// Globale Instanz
let carriageShake = null;

// Initialisierung
Hooks.once("ready", () => {
    carriageShake = new CarriageShake();
    console.log(`${MODULE_ID} | Module initialized`);

    // Prüfe beim Start, ob Shake aktiv sein sollte
    checkSceneFlag();
});

// Macro-Button zur Szenensteuerung hinzufügen
Hooks.on("getSceneControlButtons", (controls) => {
    if (!game.user.isGM) return;

    const tokenControls = controls.find(c => c.name === "token");

    tokenControls.tools.push({
        name: "carriage-shake",
        title: "Kutschenfahrt umschalten",
        icon: "fas fa-horse",
        toggle: true,
        active: carriageShake?.isActive || false,
        onClick: () => toggleCarriageShake(),
        button: true
    });
});

// Überwache Scene Flag Änderungen (funktioniert für ALLE Clients automatisch!)
Hooks.on("updateScene", (scene, changes, options, userId) => {
    // Nur reagieren wenn es die aktuelle Szene ist
    if (scene.id !== canvas.scene?.id) return;

    // Prüfen ob unser Flag geändert wurde
    const flagPath = `flags.${MODULE_ID}.shake`;
    if (hasProperty(changes, flagPath)) {
        console.log(`${MODULE_ID} | Scene flag changed, updating shake state`);
        checkSceneFlag();
    }
});

// Prüft den aktuellen Scene Flag Status und startet/stoppt entsprechend
function checkSceneFlag() {
    if (!canvas.scene) return;

    const shakeData = canvas.scene.getFlag(MODULE_ID, "shake");
    console.log(`${MODULE_ID} | Checking scene flag:`, shakeData);

    if (shakeData?.active) {
        // Shake sollte aktiv sein
        if (!carriageShake.isActive) {
            console.log(`${MODULE_ID} | Starting shake from scene flag with intensity ${shakeData.intensity}`);
            carriageShake.startShake(shakeData.intensity);
        }
    } else {
        // Shake sollte inaktiv sein
        if (carriageShake.isActive) {
            console.log(`${MODULE_ID} | Stopping shake from scene flag`);
            carriageShake.stopShake();
        }
    }
}

// Cleanup beim Szenenwechsel
Hooks.on("canvasReady", () => {
    if (carriageShake?.isActive) {
        carriageShake.stopShake();
    }
    // Prüfe Flag der neuen Szene
    checkSceneFlag();
});

// Setzt den Scene Flag (nur GM)
async function setSceneShakeFlag(active, intensity = 6) {
    if (!canvas.scene) return;

    console.log(`${MODULE_ID} | Setting scene flag: active=${active}, intensity=${intensity}`);

    await canvas.scene.setFlag(MODULE_ID, "shake", {
        active: active,
        intensity: intensity
    });
}

// Toggle-Funktion für das UI
async function toggleCarriageShake() {
    if (!game.user.isGM) {
        ui.notifications.warn("⚠️ Nur der GM kann die Kutschenfahrt steuern");
        return;
    }

    if (carriageShake.isActive) {
        // Stoppen für alle über Scene Flag
        console.log(`${MODULE_ID} | GM stopping shake via scene flag`);
        await setSceneShakeFlag(false);
    } else {
        // Dialog zur Intensitätsauswahl
        new Dialog({
            title: "🐴 Kutschenfahrt Einstellungen",
            content: `
                <form>
                    <div class="form-group">
                        <label>Straßenzustand:</label>
                        <select id="shake-intensity" style="width: 100%; margin-top: 5px;">
                            <option value="2">Glatte Straße (sanft)</option>
                            <option value="4">Normale Straße</option>
                            <option value="6" selected>Kopfsteinpflaster</option>
                            <option value="8">Holpriger Feldweg</option>
                            <option value="12">Extrem rauer Weg</option>
                            <option value="15">Offroad Chaos</option>
                        </select>
                    </div>
                </form>
            `,
            buttons: {
                start: {
                    icon: '<i class="fas fa-play"></i>',
                    label: "Fahrt starten",
                    callback: async (html) => {
                        const intensity = parseInt(html.find("#shake-intensity").val());
                        console.log(`${MODULE_ID} | GM starting shake via scene flag with intensity ${intensity}`);
                        await setSceneShakeFlag(true, intensity);
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "Abbrechen"
                }
            },
            default: "start"
        }).render(true);
    }
}

// API für Macros
Hooks.once("ready", () => {
    game.modules.get(MODULE_ID).api = {
        start: async (intensity = 6) => {
            if (!game.user.isGM) {
                ui.notifications.warn("⚠️ Nur der GM kann die Kutschenfahrt steuern");
                return;
            }
            console.log(`${MODULE_ID} | API: Starting shake via scene flag with intensity ${intensity}`);
            await setSceneShakeFlag(true, intensity);
        },
        stop: async () => {
            if (!game.user.isGM) {
                ui.notifications.warn("⚠️ Nur der GM kann die Kutschenfahrt steuern");
                return;
            }
            console.log(`${MODULE_ID} | API: Stopping shake via scene flag`);
            await setSceneShakeFlag(false);
        },
        toggle: () => toggleCarriageShake()
    };

    console.log(`${MODULE_ID} | API registered`);
});