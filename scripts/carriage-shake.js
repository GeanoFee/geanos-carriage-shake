// Carriage Shake Module für FoundryVTT - Scene Flag basiert (OHNE Sockets!)
const MODULE_ID = "geanos-carriage-shake";

class CarriageShake {
    constructor() {
        this.isActive = false;
        this.intensity = 6;
        this.shakeOffset = { x: 0, y: 0 };
        // Bind the ticker function so we can add/remove it easily
        this._tickerFunction = this._animate.bind(this);
    }

    startShake(intensity = 6) {
        if (this.isActive) return;

        this.intensity = intensity;
        this.isActive = true;

        // Use Foundry's shared ticker for smoother animation synced with the render loop
        canvas.app.ticker.add(this._tickerFunction);

        ui.notifications.info("🐴 Kutschenfahrt gestartet");
        // Update Controls UI to reflect state change
        if (ui.controls) ui.controls.render();
        console.log(`${MODULE_ID} | Shake started with intensity ${intensity}`);
    }

    stopShake() {
        if (!this.isActive) return;

        this.isActive = false;

        // Remove from ticker
        if (canvas.app.ticker) canvas.app.ticker.remove(this._tickerFunction);

        // Reset any remaining offset
        this._resetShake();

        ui.notifications.info("🛑 Kutschenfahrt beendet");
        // Update Controls UI to reflect state change
        if (ui.controls) ui.controls.render();
        console.log(`${MODULE_ID} | Shake stopped`);
    }

    _animate() {
        // Killswitch: If stopped (but ticker still running for some reason), exit immediately
        // and ensure we don't apply new offsets.
        if (!this.isActive) {
            // Safety: Try removing again if we are here
            if (canvas?.app?.ticker) canvas.app.ticker.remove(this._tickerFunction);
            return;
        }

        // If we are not on a canvas, do nothing
        if (!canvas.stage || !canvas.ready) return;

        // 1. Remove the previous frame's shake from the pivot 
        // (We must "undo" our shake before Foundry calculates the new frame's camera position,
        // otherwise we drift away forever!)
        canvas.stage.pivot.x -= this.shakeOffset.x;
        canvas.stage.pivot.y -= this.shakeOffset.y;

        // 2. Calculate NEW shake
        const variation = 0.8;
        const randomX = (Math.random() - 0.5) * this.intensity * variation;
        const randomY = (Math.random() - 0.5) * this.intensity * variation;
        // Slower wave for "rolling" feel
        const wave = Math.sin(Date.now() / 200) * (this.intensity * 0.4);

        this.shakeOffset.x = randomX + wave;
        this.shakeOffset.y = randomY;

        // 3. Apply NEW shake to the pivot
        canvas.stage.pivot.x += this.shakeOffset.x;
        canvas.stage.pivot.y += this.shakeOffset.y;
    }

    _resetShake() {
        if (!canvas.stage) return;
        // Undo the last applied offset so we land exactly where we should be
        canvas.stage.pivot.x -= this.shakeOffset.x;
        canvas.stage.pivot.y -= this.shakeOffset.y;
        this.shakeOffset = { x: 0, y: 0 };
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

    // Register API
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

// Macro-Button zur Szenensteuerung hinzufügen
Hooks.on("getSceneControlButtons", (controls) => {
    // Debug logging
    // console.log(`${MODULE_ID} | getSceneControlButtons fired`, controls);

    if (!game.user.isGM) return;

    let tokenControls;

    // V13 Strategy: Check direct property access first
    // It seems V13 uses "tokens" (plural) as key in the controls object
    if (controls.tokens) {
        tokenControls = controls.tokens;
    }
    // Fallback: Check "token" (singular, V12 style maybe?)
    else if (controls.token) {
        tokenControls = controls.token;
    }
    // Fallback: Array search (V11/V12 standard)
    else if (Array.isArray(controls)) {
        tokenControls = controls.find(c => c.name === "token" || c.name === "tokens");
    }
    // Fallback: Object values search
    else {
        tokenControls = Object.values(controls).find(c => c.name === "token" || c.name === "tokens");
    }

    if (tokenControls) {
        // V13 Safety: tools might not be an array anymore
        const tools = tokenControls.tools;

        // REMOVE any existing tool to force a fresh state (avoid stale references)
        if (Array.isArray(tools)) {
            const idx = tools.findIndex(t => t.name === "carriage-shake");
            if (idx !== -1) tools.splice(idx, 1);
        } else if (tools instanceof Map) {
            tools.delete("carriage-shake");
        } else if (typeof tools === "object" && tools !== null) {
            delete tools["carriage-shake"];
        }

        // Define our tool button (new instance)
        const shakeTool = {
            name: "carriage-shake",
            title: "Kutschenfahrt umschalten",
            icon: "fas fa-horse",
            toggle: true,

            // Check if active, default to false if instance not ready yet
            active: (typeof carriageShake !== "undefined" && carriageShake?.isActive) || false,

            // V13: Use onChange instead of onClick for toggles
            onChange: (active) => {
                // Determine direction based on the new 'active' state
                if (active) toggleCarriageShake(true);
                else toggleCarriageShake(false);
            }
        };

        if (Array.isArray(tools)) {
            // V12 Standard
            tools.push(shakeTool);
        } else if (tools instanceof Map) {
            // V13 Potential (Collection/Map)
            tools.set("carriage-shake", shakeTool);
        } else if (typeof tools === "object" && tools !== null) {
            // V13 Potential (Object)
            tools["carriage-shake"] = shakeTool;
        } else {
            console.warn(`${MODULE_ID} | 'tools' property has unexpected type:`, tools);
        }
    } else {
        console.warn(`${MODULE_ID} | Could not find 'token' or 'tokens' controls. Available keys:`, Object.keys(controls));
    }
});

// Überwache Scene Flag Änderungen (funktioniert für ALLE Clients automatisch!)
Hooks.on("updateScene", (scene, changes, options, userId) => {
    // Nur reagieren wenn es die aktuelle Szene ist
    if (scene.id !== canvas.scene?.id) return;

    // Prüfen ob unser Flag geändert wurde
    const flagPath = `flags.${MODULE_ID}.shake`;
    if (foundry.utils.hasProperty(changes, flagPath)) {
        // console.log(`${MODULE_ID} | Scene flag changed, updating shake state`);
        checkSceneFlag();
    }
});

// Prüft den aktuellen Scene Flag Status und startet/stoppt entsprechend
function checkSceneFlag() {
    if (!canvas.scene || !carriageShake) return;

    const shakeData = canvas.scene.getFlag(MODULE_ID, "shake");
    // console.log(`${MODULE_ID} | Checking scene flag:`, shakeData);

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
        // Force stop local shake effect (but don't change flag) 
        // so we don't carry over momentum to new scene until we check flags
        carriageShake.stopShake();
    }
    // Prüfe Flag der neuen Szene
    checkSceneFlag();
});

// Setzt den Scene Flag (nur GM)
async function setSceneShakeFlag(active, intensity = 6) {
    if (!canvas.scene) return;

    // console.log(`${MODULE_ID} | Setting scene flag: active=${active}, intensity=${intensity}`);

    await canvas.scene.setFlag(MODULE_ID, "shake", {
        active: active,
        intensity: intensity
    });
}

// Toggle-Funktion für das UI
// Updated to accept explicit state (from onChange) or toggle logic (from API)
async function toggleCarriageShake(forceState = null) {
    if (!game.user.isGM) {
        ui.notifications.warn("⚠️ Nur der GM kann die Kutschenfahrt steuern");
        return;
    }

    const isCurrentlyActive = carriageShake && carriageShake.isActive;
    const targetState = forceState !== null ? forceState : !isCurrentlyActive;

    // Debug logging removed for release
    /*
    console.log(`${MODULE_ID} | toggleCarriageShake called`, {
        forceState,
        isCurrentlyActive,
        targetState
    });
    */

    if (!targetState) {
        // Turning OFF
        // console.log(`${MODULE_ID} | Attempting to turn OFF`);
        // console.log(`${MODULE_ID} | GM stopping shake via scene flag`);
        await setSceneShakeFlag(false);

    } else {
        // Turning ON
        // console.log(`${MODULE_ID} | Attempting to turn ON`);
        if (!isCurrentlyActive) {

            // V13: Use ApplicationV2 (DialogV2)
            const { DialogV2 } = foundry.applications.api;

            const intensity = await DialogV2.wait({
                window: { title: "🐴 Kutschenfahrt Einstellungen" },
                content: `
                    <form>
                        <div class="form-group">
                            <label>Straßenzustand:</label>
                            <select id="shake-intensity" name="intensity" style="width: 100%; margin-top: 5px;">
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
                buttons: [{
                    action: "start",
                    label: "Fahrt starten",
                    icon: "fas fa-play",
                    default: true,
                    callback: (event, button, dialog) => {
                        return dialog.element.querySelector("#shake-intensity").value;
                    }
                }, {
                    action: "cancel",
                    label: "Abbrechen",
                    icon: "fas fa-times",
                    callback: (event, button, dialog) => {
                        return null;
                    }
                }],
                close: () => {
                    // Ensure UI sync on close if not started
                    // We need a small delay or check because close happens before we might start?
                    // Actually, if we return from wait, we proceed below. 
                    // The old close handler was to ensure UI reset if cancelled. 
                    // Here, if we don't start, we might want to ensure UI is off.
                }
            });

            if (intensity) {
                // console.log(`${MODULE_ID} | GM starting shake via scene flag with intensity ${intensity}`);
                await setSceneShakeFlag(true, parseInt(intensity));
            } else {
                // Cancelled or closed
                // console.log(`${MODULE_ID} | Cancelled shake start`);
                if (ui.controls) ui.controls.render();
            }

        } else {
            console.log(`${MODULE_ID} | Auto-correction: Shake matches UI state (OFF)`);
            await setSceneShakeFlag(false);
        }
    }
}