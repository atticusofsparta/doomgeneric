# DOOM AO Integration

This project successfully integrates the classic DOOM game with the AO (Actor Oriented) Network, allowing DOOM to run as an AO process that responds to JSON messages.

## Architecture

The integration consists of several key components:

### 1. `doomgeneric_ao.c`
- Platform-specific implementation for the AO environment
- Handles key input via message queues instead of real-time input
- Manages timing through message-driven updates
- Provides base64 encoding of the screen buffer for transmission

### 2. `doom_ao_process.c`
- Main AO process that wraps DOOM in the required `handle()` function
- Processes JSON messages with different action types
- Manages game initialization and state

### 3. Updated Makefile
- Compiles DOOM with Emscripten for WASM output
- Links with Jansson for JSON processing
- Produces an AO-compatible WASM module

## Message Protocol

The DOOM AO process responds to messages with the following action types:

### `Init`
Initializes the DOOM game engine.

```json
{
  "Tags": [{"name": "Action", "value": "Init"}]
}
```

**Response:**
```json
{
  "ok": true,
  "response": {
    "Output": "Game initialized",
    "width": 640,
    "height": 400
  }
}
```

### `Tick`
Processes a single game frame with optional delta time.

```json
{
  "Tags": [{"name": "Action", "value": "Tick"}],
  "Data": {
    "deltaMs": 16
  }
}
```

**Response:**
```json
{
  "ok": true,
  "response": {
    "Output": "Tick processed",
    "deltaMs": 16
  }
}
```

### `KeyPress` / `KeyRelease`
Sends keyboard input to the game.

```json
{
  "Tags": [{"name": "Action", "value": "KeyPress"}],
  "Data": {
    "key": "ArrowLeft"
  }
}
```

**Supported Keys:**
- Arrow keys: `ArrowLeft`, `ArrowRight`, `ArrowUp`, `ArrowDown`
- Action keys: `Space` (use), `Control` (fire), `Shift` (run), `Alt`
- Navigation: `Enter`, `Escape`, `Tab`, `Backspace`
- Function keys: `F1` through `F12`
- Characters: `a-z`, `0-9`
- Symbols: `Equal`/`Plus`, `Minus`

### `GetScreen`
Retrieves the current screen buffer as base64-encoded image data.

```json
{
  "Tags": [{"name": "Action", "value": "GetScreen"}]
}
```

**Response:**
```json
{
  "ok": true,
  "response": {
    "Output": {
      "screen": "base64-encoded-image-data...",
      "width": 640,
      "height": 400
    }
  }
}
```

## Building

### Prerequisites
- Docker
- Make

### Build Steps

1. **Build the WASM module:**
   ```bash
   cd ao_c/with-emsdk-container
   make wasm
   ```

2. **Test the module:**
   ```bash
   make test
   ```

## Game Requirements

Note: To fully run DOOM, you need a WAD file (game data). The shareware version `doom1.wad` is freely available. In the current implementation, DOOM will attempt to find a default WAD file.

For production use, you would need to:
1. Include the WAD file in the build process
2. Modify the initialization to load the WAD from a specific location
3. Possibly embed the WAD data directly in the WASM module

## Usage in AO

Once deployed as an AO module, you can:

1. **Initialize a game session:**
   ```javascript
   ao.message({
     process: "your-doom-process-id",
     tags: [{ name: "Action", value: "Init" }]
   })
   ```

2. **Start the game loop by sending regular tick messages:**
   ```javascript
   setInterval(() => {
     ao.message({
       process: "your-doom-process-id",
       tags: [{ name: "Action", value: "Tick" }],
       data: JSON.stringify({ deltaMs: 16 })
     })
   }, 16) // 60 FPS
   ```

3. **Send keyboard input:**
   ```javascript
   // Start moving left
   ao.message({
     process: "your-doom-process-id",
     tags: [{ name: "Action", value: "KeyPress" }],
     data: JSON.stringify({ key: "ArrowLeft" })
   })

   // Stop moving left
   ao.message({
     process: "your-doom-process-id",
     tags: [{ name: "Action", value: "KeyRelease" }],
     data: JSON.stringify({ key: "ArrowLeft" })
   })
   ```

4. **Get the current screen:**
   ```javascript
   ao.message({
     process: "your-doom-process-id",
     tags: [{ name: "Action", value: "GetScreen" }]
   })
   ```

## Technical Details

- **Screen Resolution:** 640x400 pixels (classic DOOM resolution)
- **Color Depth:** 32-bit RGBA
- **Memory Requirements:** ~64MB initial memory with growth allowed
- **Frame Rate:** Variable, controlled by tick frequency
- **Input Latency:** Depends on AO message processing speed

## Limitations

1. **No Audio:** The current implementation doesn't include audio support
2. **WAD File:** Requires manual WAD file setup
3. **Save/Load:** Game state persistence would need additional implementation
4. **Multiplayer:** Network play features are not supported in this AO version

## Future Enhancements

- Add audio support through Web Audio API integration
- Implement game state serialization for persistence
- Add support for loading different WAD files via messages
- Optimize screen data transmission (compression, delta encoding)
- Add multiplayer support through AO process communication
