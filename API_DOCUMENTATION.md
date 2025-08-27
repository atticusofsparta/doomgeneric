# DOOM AO Process - Messaging API Documentation

## Overview

The DOOM AO Process provides a WebAssembly-based DOOM game engine that runs on the AO (Actor Oriented) platform. It communicates through a structured JSON messaging API that enables complete game control, rendering, and state management.

## API Architecture

### Message Structure

All messages follow the AO protocol format:

```typescript
interface AOMessage {
  Id: string;                    // Unique message identifier
  "Block-Height": string;        // AO block height
  Owner: string;                 // Process owner
  Module: string;                // Process module ID
  Target: string;                // Target process ID  
  From: string;                  // Sender ID
  Timestamp: number;             // Unix timestamp in milliseconds
  Reference: string;             // Reference message ID
  Tags: Array<{                  // Action and metadata tags
    name: string; 
    value: string; 
  }>;
  Data: string | object;         // Action-specific data (JSON)
}
```

### Response Structure

All responses follow this format:

```typescript
interface AOResult {
  Output?: string;               // Success message or game output
  Error?: string;                // Error message if action failed
  Messages?: any[];              // Optional additional messages
  Memory: ArrayBuffer;           // Updated process memory state
  GasUsed: number;               // Computational cost
}
```

## Core API Actions

### 1. Game Initialization

#### LoadWAD
Loads a DOOM WAD file into the game engine.

**Request:**
```json
{
  "Tags": [{"name": "Action", "value": "LoadWAD"}],
  "Data": {
    "wad": "base64_encoded_wad_file_content"
  }
}
```

**Response:**
```json
{
  "Output": "WAD loaded successfully"
}
```

#### Init
Initializes the DOOM game engine after WAD is loaded.

**Request:**
```json
{
  "Tags": [{"name": "Action", "value": "Init"}],
  "Data": {}
}
```

**Response:**
```json
{
  "Output": "Game initialized"
}
```

### 2. Game Loop & Rendering

#### Tick
Advances the game simulation by the specified time delta.

**Request:**
```json
{
  "Tags": [{"name": "Action", "value": "Tick"}],
  "Data": {
    "deltaMs": 16  // Milliseconds since last tick (60 FPS = ~16ms)
  }
}
```

**Response:**
```json
{
  "Output": "Tick processed"
}
```

#### GetScreen
Retrieves the current game screen as base64-encoded image data.

**Request:**
```json
{
  "Tags": [{"name": "Action", "value": "GetScreen"}],
  "Data": {}
}
```

**Response:**
```json
{
  "Output": "{\"screen\":\"base64_image_data\",\"width\":640,\"height\":400}"
}
```

### 3. Input Handling

#### KeyPress
Sends a key press event to the game.

**Request:**
```json
{
  "Tags": [{"name": "Action", "value": "KeyPress"}],
  "Data": {
    "key": "ArrowUp"  // Key name (see DOOM_KEYS mapping)
  }
}
```

**Response:**
```json
{
  "Output": "Key pressed"
}
```

#### KeyRelease
Sends a key release event to the game.

**Request:**
```json
{
  "Tags": [{"name": "Action", "value": "KeyRelease"}],
  "Data": {
    "key": "ArrowUp"  // Key name
  }
}
```

**Response:**
```json
{
  "Output": "Key released"
}
```

#### MouseMove
Sends mouse movement to the game.

**Request:**
```json
{
  "Tags": [{"name": "Action", "value": "MouseMove"}],
  "Data": {
    "deltaX": 10,    // Horizontal movement delta
    "deltaY": -5     // Vertical movement delta
  }
}
```

**Response:**
```json
{
  "Output": "Mouse moved"
}
```

#### MouseClick
Sends mouse button events to the game.

**Request:**
```json
{
  "Tags": [{"name": "Action", "value": "MouseClick"}],
  "Data": {
    "button": 0,     // 0=left, 1=right, 2=middle
    "pressed": true, // true=press, false=release
    "x": 320,        // Optional click coordinates
    "y": 200
  }
}
```

**Response:**
```json
{
  "Output": "Mouse clicked"
}
```

#### MouseWheel
Sends mouse wheel events to the game.

**Request:**
```json
{
  "Tags": [{"name": "Action", "value": "MouseWheel"}],
  "Data": {
    "direction": 1   // 1=scroll up, -1=scroll down
  }
}
```

**Response:**
```json
{
  "Output": "Mouse wheel"
}
```

### 4. Save/Load System

#### SaveGame
Saves the current game state.

**Request:**
```json
{
  "Tags": [{"name": "Action", "value": "SaveGame"}],
  "Data": {
    "slot": 1,                    // Save slot number (1-8)
    "description": "Quick Save"   // Optional save description
  }
}
```

**Response:**
```json
{
  "Output": "Game saved successfully"
}
```

#### LoadGame
Loads a previously saved game state.

**Request:**
```json
{
  "Tags": [{"name": "Action", "value": "LoadGame"}],
  "Data": {
    "slot": 1   // Save slot number to load
  }
}
```

**Response:**
```json
{
  "Output": "Game loaded successfully"
}
```

## Key Mappings

The game supports comprehensive keyboard and mouse controls:

### Movement Controls
- `ArrowUp` / `ArrowDown` - Forward/Backward movement
- `ArrowLeft` / `ArrowRight` - Turn left/right
- `q` / `e` - Strafe left/right
- `Shift` - Run (hold)
- `Alt` - Strafe mode (hold)
- `CapsLock` - Auto-run toggle

### Combat Controls
- `Control` - Fire weapon
- `Space` - Use/Activate
- `1`-`7` - Select weapons
- `PageUp` / `PageDown` - Cycle weapons

### View Controls
- `Insert` - Look up
- `Delete` - Look down
- `End` - Center view
- `Tab` - Toggle automap

### System Controls
- `Escape` - Menu
- `F6` / `F9` - Quicksave/Quickload
- `F8` - Toggle messages
- `Equal` / `Minus` - Increase/decrease screen size

### Mouse Controls
- **Button 0** (Left) - Fire weapon
- **Button 1** (Right) - Strafe
- **Button 2** (Middle) - Forward movement
- **Mouse Movement** - Look around (when mouse look enabled)
- **Wheel Up/Down** - Change weapons

## Game Constants

```typescript
const DOOM_CONSTANTS = {
  SCREEN_WIDTH: 320,     // Original DOOM resolution
  SCREEN_HEIGHT: 200,
  SCALED_WIDTH: 640,     // Scaled resolution for modern displays
  SCALED_HEIGHT: 400,
  MAX_HEALTH: 100,
  MAX_ARMOR: 200,
  EPISODES: [1, 2, 3, 4],
  SKILLS: [1, 2, 3, 4, 5],  // Difficulty levels
  MAX_SAVE_SLOTS: 8,
}
```

## Error Handling

The API provides detailed error messages for debugging:

```json
{
  "Error": "WAD file not loaded - call LoadWAD first"
}
```

Common error scenarios:
- WAD not loaded before Init
- Game not initialized before Tick/Input
- Invalid key names
- Invalid save slot numbers
- Malformed JSON data

## Performance Considerations

- **Frame Rate**: Target 60 FPS with 16ms tick intervals
- **Response Time**: All actions respond in 6-13ms average
- **Memory Usage**: Process maintains ~600MB memory state
- **Rendering**: Screen capture adds ~5-10ms overhead

## Data Formats

### Screen Data
- **Format**: Base64-encoded image data
- **Resolution**: 640x400 pixels (2x scaled)
- **Color Depth**: 32-bit RGBA
- **Size**: ~1MB per frame (base64 encoded)

### Save Data
- **Format**: Base64-encoded binary save state
- **Size**: ~50-100KB per save
- **Slots**: 8 available save slots
- **Compatibility**: Standard DOOM save format

## Next Steps

This API documentation provides the foundation for building frontend applications. See `FRONTEND_INTEGRATION_PLAN.md` for implementation guidance and architecture recommendations.
