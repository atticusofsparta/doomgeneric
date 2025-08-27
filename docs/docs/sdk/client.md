# Client Library

The DOOM AO Client Library provides a comprehensive TypeScript interface for communicating with DOOM AO processes.

## Overview

The client library handles all the complexity of AO message formatting, process communication, and response parsing, giving you a clean API to work with DOOM game instances.

## Installation

```bash
npm install @doom-ao/client
```

## Basic Usage

```typescript
import { DoomClient } from '@doom-ao/client';

// Create a new client instance
const client = new DoomClient({
  processId: 'your-doom-process-id',
  aoNode: 'https://ao-node.example.com'
});

// Connect to the process
await client.connect();

// Load a WAD file
await client.loadWAD(wadFileBuffer);

// Initialize the game
await client.init();

// Start the game loop
const gameLoop = () => {
  client.tick();
  const screen = client.getScreen();
  // Render screen to your canvas
  requestAnimationFrame(gameLoop);
};
gameLoop();
```

## Core Methods

### Connection Management

#### `connect()`
Establishes connection to the AO process.

```typescript
await client.connect();
```

#### `disconnect()`
Closes the connection to the AO process.

```typescript
await client.disconnect();
```

### Game Management

#### `loadWAD(wadData: ArrayBuffer)`
Loads a DOOM WAD file into the process.

```typescript
const wadFile = await fetch('/doom1.wad').then(r => r.arrayBuffer());
await client.loadWAD(wadFile);
```

#### `init()`
Initializes the DOOM game engine.

```typescript
await client.init();
```

#### `tick(deltaMs?: number)`
Advances the game simulation by one frame.

```typescript
// Default 16ms (60 FPS)
await client.tick();

// Custom delta time
await client.tick(33); // 30 FPS
```

#### `getScreen()`
Retrieves the current rendered frame.

```typescript
const screen = await client.getScreen();
// Returns: { screen: string, width: number, height: number }
```

### Input Handling

#### Keyboard Input

```typescript
// Press and release keys
await client.keyPress('ArrowUp');
await client.keyRelease('ArrowUp');

// Convenient key tap (press + release)
await client.keyTap('Space');
```

#### Mouse Input

```typescript
// Mouse movement
await client.mouseMove(deltaX, deltaY);

// Mouse clicks
await client.mouseClick('left');
await client.mouseClick('right', x, y); // With coordinates

// Mouse wheel
await client.mouseWheel('up');
await client.mouseWheel('down', 3); // Multiple notches
```

### Save System

#### `saveGame(slot: number, description?: string)`
Saves the current game state.

```typescript
await client.saveGame(1, 'Boss fight checkpoint');
```

#### `loadGame(slot: number)`
Loads a previously saved game state.

```typescript
await client.loadGame(1);
```

#### `quickSave()` / `quickLoad()`
Quick save/load operations.

```typescript
await client.quickSave();
await client.quickLoad();
```

## Configuration Options

```typescript
interface DoomClientConfig {
  processId: string;          // AO process ID
  aoNode: string;             // AO node URL
  timeout?: number;           // Request timeout (default: 5000ms)
  retries?: number;           // Retry attempts (default: 3)
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}
```

## Error Handling

```typescript
try {
  await client.loadWAD(wadData);
} catch (error) {
  if (error instanceof DoomAOError) {
    console.error('DOOM AO Error:', error.message);
    console.error('Error Code:', error.code);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Events

The client emits various events for monitoring game state:

```typescript
client.on('connected', () => {
  console.log('Connected to DOOM process');
});

client.on('disconnected', () => {
  console.log('Disconnected from DOOM process');
});

client.on('error', (error) => {
  console.error('Client error:', error);
});

client.on('gameStateChanged', (state) => {
  console.log('Game state:', state);
});
```

## Performance Tips

- **Batch operations**: Group multiple input events together
- **Frame rate management**: Use consistent tick intervals
- **Memory management**: Dispose of screen data after rendering
- **Connection pooling**: Reuse client instances when possible

## Next Steps

- [Input System](./input) - Learn about comprehensive input handling
- [State Management](./state) - Integrate with frontend state stores
- [Testing Tools](./testing) - Test your DOOM integrations
