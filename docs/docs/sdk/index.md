# SDK Documentation

The DOOM AO SDK provides tools and utilities for building applications that interact with the DOOM AO Process.

## Overview

The SDK includes:

- **TypeScript Client Library** - Type-safe communication with DOOM processes
- **Input Management** - Comprehensive keyboard and mouse handling
- **Game Loop Utilities** - Optimized game loop and rendering management
- **State Management** - React/Vue store integrations
- **Testing Framework** - Complete testing utilities for DOOM applications

## Quick Start

```typescript
import { DoomClient, useDoomStore } from '@doom-ao/sdk';

// Initialize DOOM client
const client = new DoomClient({
  processId: 'your-doom-process-id',
  endpoint: 'wss://ao-node.example.com'
});

// Connect and load game
await client.connect();
await client.loadWAD(wadFile);
await client.initGame();
```

## Modules

- [Client Library](./client) - Core client for DOOM process communication
- [Input System](./input) - Keyboard and mouse input handling
- [State Management](./state) - React/Vue state integration
- [Testing Tools](./testing) - Testing utilities and frameworks
- [Types](./types) - TypeScript type definitions

## Installation

```bash
npm install @doom-ao/sdk
```

## Examples

- [Basic Game Setup](./examples/basic-setup)
- [Input Handling](./examples/input-handling)
- [Save/Load System](./examples/save-load)
- [Custom Controls](./examples/custom-controls)
