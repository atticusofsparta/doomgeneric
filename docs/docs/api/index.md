# API Reference

Complete API reference for the DOOM AO Process messaging system.

## Overview

The DOOM AO Process communicates through structured JSON messages following the AO protocol. This API provides complete control over the DOOM game engine, including input handling, game state management, and rendering.

## Message Structure

### Request Format
```typescript
interface AOMessage {
  Id: string;                    // Unique message identifier
  "Block-Height": string;        // AO block height
  Owner: string;                 // Process owner
  Module: string;                // Process module ID
  Target: string;                // Target process ID  
  From: string;                  // Sender ID
  Timestamp: number;             // Unix timestamp
  Reference: string;             // Reference message ID
  Tags: Array<{                  // Action and metadata
    name: string; 
    value: string; 
  }>;
  Data: string | object;         // Action-specific data
}
```

### Response Format
```typescript
interface AOResult {
  Output?: string;               // Success message
  Error?: string;                // Error message if failed
  Messages?: any[];              // Additional messages
  Memory: ArrayBuffer;           // Updated process memory
  GasUsed: number;               // Computational cost
}
```

## Core Actions

### Game Management
- [`LoadWAD`](./load-wad) - Load DOOM WAD file
- [`Init`](./init) - Initialize game engine
- [`Tick`](./tick) - Advance game simulation
- [`GetScreen`](./get-screen) - Retrieve rendered frame

### Input Handling
- [`KeyPress`](./key-press) - Send key press events
- [`KeyRelease`](./key-release) - Send key release events
- [`MouseMove`](./mouse-move) - Send mouse movement
- [`MouseClick`](./mouse-click) - Send mouse button events
- [`MouseWheel`](./mouse-wheel) - Send mouse wheel events

### Save System
- [`SaveGame`](./save-game) - Save game state
- [`LoadGame`](./load-game) - Load game state

## Quick Reference

### Common Actions
```typescript
// Initialize game
await sendMessage('LoadWAD', { wad: base64WadData });
await sendMessage('Init', {});

// Game loop
await sendMessage('Tick', { deltaMs: 16 });
const screen = await sendMessage('GetScreen', {});

// Input handling
await sendMessage('KeyPress', { key: 'ArrowUp' });
await sendMessage('KeyRelease', { key: 'ArrowUp' });

// Save/Load
await sendMessage('SaveGame', { slot: 1, description: 'Quick Save' });
await sendMessage('LoadGame', { slot: 1 });
```

### Key Mappings
Complete reference of supported keys and their DOOM engine mappings.

### Mouse Controls
Detailed mouse button and movement handling specifications.

### Error Codes
Common error conditions and troubleshooting guide.

## Performance

- **Average Response Time**: 6-13ms
- **Target Frame Rate**: 60 FPS (16ms ticks)
- **Memory Usage**: ~600MB process state
- **Screen Data**: ~1MB per frame (base64 encoded)

## Examples

- [Basic Game Setup](./examples/basic-setup)
- [Input Handling](./examples/input-handling)
- [Save/Load Implementation](./examples/save-load)
- [Error Handling](./examples/error-handling)
