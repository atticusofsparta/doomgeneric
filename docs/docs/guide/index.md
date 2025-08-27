# Getting Started

Welcome to the <span class="doom-accent">DOOM AO</span> documentation! This guide will help you get up and running with the Atticus of Sparta process.

## What is DOOM AO?

DOOM AO is a WebAssembly-powered DOOM engine that provides modern APIs for integrating classic DOOM gameplay into web applications. Built on the Atticus of Sparta (AO) process framework, it offers:

- **High Performance**: 6-13ms average response times
- **Modern Integration**: Clean TypeScript APIs
- **Full Feature Set**: Complete input system, save/load, rendering
- **Thoroughly Tested**: 100% test coverage across all systems

## Prerequisites

Before getting started, ensure you have:

- Node.js 18+ 
- npm or yarn package manager
- Basic understanding of TypeScript/JavaScript
- A WAD file (DOOM game data)

## Quick Installation

```bash
# Clone the repository
git clone https://github.com/atticusofsparta/doomgeneric
cd doomgeneric

# Install dependencies  
npm install

# Run tests to verify installation
npm test
```

## Your First DOOM Integration

Here's a simple example of how to use DOOM AO in your application:

```typescript
import { DoomTestClient } from './utils/doom-client';

// Initialize the DOOM client
const client = new DoomTestClient();

// Load a WAD file
await client.loadWAD('path/to/your/doom.wad');

// Initialize the game
await client.init();

// Start the game loop
while (gameRunning) {
  await client.tick();
  const screen = await client.getScreen();
  // Render screen data to your canvas
}
```

## System Architecture

<div class="alert alert-info">
🏗️ **Understanding the Architecture**

DOOM AO consists of three main layers that work together seamlessly:
</div>

### 1. Process Layer (C/WebAssembly)
The core DOOM engine compiled to WebAssembly, handling:
- Game logic and physics
- Rendering and graphics
- Memory management
- Input processing

### 2. SDK Layer (TypeScript)
The client library that provides:
- Type-safe APIs
- Message handling
- Convenient methods for common operations
- Testing utilities

### 3. App Layer (Your Code)
Your application integration:
- Frontend framework (React, Vue, etc.)
- Game state management
- UI components
- User interaction

## Key Features

### 🎮 Complete Input System
- **Keyboard**: All traditional DOOM keys plus modern additions
- **Mouse**: Movement, clicking, wheel support
- **Actions**: 12 major action systems including STRAFE, AUTORUN, weapon cycling

### 💾 Advanced Save System
- Memory-based save states
- Quicksave/quickload functionality
- State persistence across sessions
- WAD manipulation capabilities

### 🧪 Testing Framework
- 100% test coverage
- 60+ comprehensive tests
- Performance benchmarking
- Integration testing

### ⚡ Performance Optimized
- 6-13ms average response times
- Efficient memory management
- WebAssembly performance benefits
- Minimal overhead messaging

## Next Steps

<div class="alert alert-warning">
🔥 **Ready to dive deeper?** Check out these resources:
</div>

- **[SDK Documentation](/sdk/)** - Learn about the client library and APIs
- **[App Integration](/app/)** - Build applications with DOOM AO  
- **[Process Documentation](/process/)** - Understand the core engine
- **[API Reference](/api/)** - Complete API documentation

## Common Use Cases

### Game Development
Build modern DOOM-style games with web technologies:
- Retro-style FPS games
- Educational game development
- Prototype rapid development

### Interactive Experiences
Create unique web experiences:
- Virtual museum exhibits
- Interactive storytelling
- Immersive web applications

### Research & Education
Perfect for academic and research purposes:
- Game engine architecture studies
- WebAssembly performance research
- Computer graphics education

## Getting Help

<div class="alert alert-danger">
🆘 **Need assistance?** Here are some helpful resources:
</div>

- **Test Suite**: Comprehensive examples in `ao_c/with-emsdk-container/tests/`
- **API Docs**: Detailed documentation with examples
- **Integration Guide**: Step-by-step app development guide
- **Performance Metrics**: Benchmarking and optimization tips

## What's Next?

Now that you understand the basics, you're ready to start building! Here are some recommended next steps:

1. **Explore the SDK** - Learn about the client library and available APIs
2. **Try the Examples** - Run the test suite to see DOOM AO in action
3. **Build Your First App** - Follow our app integration guide
4. **Dive into Advanced Features** - Explore save systems, input handling, and performance optimization

Let's start building some amazing DOOM-powered applications! <span class="doom-accent doom-flicker">🔥</span>