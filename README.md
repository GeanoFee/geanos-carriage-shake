# Geano's Carriage Shake

![Geano's Carriage Shake Showcase](https://github.com/GeanoFee/geanos-carriage-shake/blob/main/GCS.jpg?raw=true)

A FoundryVTT module that adds a configurable screen shake effect to simulate a carriage ride or other unstable conditions.

## 🌟 Features

- **Scene-based Synchronization**: Uses scene flags to ensure all players see the same shake effect.
- **Configurable Intensity**: Choose from various presets ranging from "Smooth Road" to "Offroad Chaos".
- **GM Controls**: Easy access via a button in the Token Controls layer.
- **Macro API**: Full control via macros for automation.

## 🎮 Usage

1. Switch to the **Token Controls** layer.
2. Click the **Horse Icon** (Toggle Carriage Ride).
3. If the shake is inactive, a dialog will appear allowing you to select the intensity (Road Condition).
4. Click "Start Ride" to begin the effect for all players on the scene.
5. Click the button again to stop the effect.

## 🔧 Macro API

You can control the module programmatically using the exposed API:

```javascript
// Start the shake with a specific intensity (default: 6)
game.modules.get("geanos-carriage-shake").api.start(intensity);

// Stop the shake
game.modules.get("geanos-carriage-shake").api.stop();

// Toggle the shake (opens dialog if starting)
game.modules.get("geanos-carriage-shake").api.toggle();
```

## 🚀 Installation

- **Manifest URL**: `https://github.com/GeanoFee/geanos-carriage-shake/releases/latest/download/module.json`



