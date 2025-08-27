# Process Documentation

Complete documentation for the DOOM AO Process - the WebAssembly DOOM engine running on the AO platform.

## Overview

The DOOM AO Process is a fully functional DOOM game engine compiled to WebAssembly and integrated with the AO (Actor Oriented) messaging system. It provides complete DOOM gameplay through a structured JSON API.

## Features

### ✅ Complete Control System (12 Actions)
- **Movement Controls** - STRAFE, AUTORUN, directional movement
- **Weapon System** - Weapon cycling, selection, and firing
- **View Controls** - Vertical look (up/down/center)
- **System Controls** - Automap, save/load, UI toggles

### ✅ Advanced Capabilities
- **Mouse Support** - Complete mouse input with movement and clicking
- **Save/Load System** - 8 save slots with game state persistence
- **Screen Rendering** - Real-time frame capture with base64 encoding
- **Performance Optimized** - 60 FPS target with 6-13ms response times

## Architecture

```
Frontend → AO Connector → AO Process → DOOM Engine → Response
```

### Core Components
- **Message Handler** - Processes incoming AO messages
- **Input System** - Manages keyboard and mouse events
- **Game Integration** - Interfaces with DOOM engine
- **Screen Capture** - Renders frames for display

## API Reference

### Message Format
```json
{
  "Id": "unique-message-id",
  "Tags": [{"name": "Action", "value": "ActionName"}],
  "Data": "JSON string with action data"
}
```

### Core Actions
- `LoadWAD` - Load DOOM WAD file
- `Init` - Initialize game engine
- `Tick` - Advance game simulation
- `KeyPress/KeyRelease` - Handle input
- `GetScreen` - Retrieve rendered frame
- `SaveGame/LoadGame` - Manage save states

## Implementation

### Key Mappings
```typescript
const DOOM_KEYS = {
  // Movement
  FORWARD: 'ArrowUp',
  BACKWARD: 'ArrowDown',
  STRAFE: 'Alt',
  AUTORUN: 'CapsLock',
  
  // Actions
  FIRE: 'Control',
  USE: 'Space',
  AUTOMAP: 'Tab',
  
  // System
  QUICKSAVE: 'F6',
  QUICKLOAD: 'F9',
  // ... complete mapping
};
```

### Performance Metrics
- **Response Time**: 6-13ms average
- **Frame Rate**: 60 FPS target
- **Memory Usage**: ~600MB
- **Test Coverage**: 62+ tests, 100% pass rate

## Sections

- [Installation & Setup](./setup) - Build and deploy the process
- [Message API](./api) - Complete API reference
- [Input System](./input) - Keyboard and mouse handling
- [Save System](./saves) - Game state persistence
- [Testing](./testing) - Comprehensive test suite
- [Performance](./performance) - Optimization and benchmarks
- [Troubleshooting](./troubleshooting) - Common issues and solutions
