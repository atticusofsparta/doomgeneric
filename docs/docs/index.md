---
pageType: home

hero:
  name: DOOM AO
  text: WebAssembly-Powered DOOM Engine
  tagline: Complete documentation for the Atticus of Sparta process - modern APIs for classic DOOM gameplay
  actions:
    - theme: brand
      text: Get Started
      link: /guide/
    - theme: alt
      text: API Reference
      link: /api/
  image:
    src: /rspress-icon.png
    alt: DOOM AO Logo
features:
  - title: "🔥 Blazing Performance"
    details: "WebAssembly-powered DOOM engine with 6-13ms response times and 100% test coverage across 12 major action systems."
    icon: "⚡"
  - title: "🎮 Complete Input System" 
    details: "Full keyboard and mouse support with traditional DOOM controls plus modern enhancements like 6DOF movement."
    icon: "🎮"
  - title: "💾 Advanced Save System"
    details: "Memory-based save/load functionality with quicksave/quickload support and state persistence."
    icon: "💾"
  - title: "🧪 Fully Tested"
    details: "Comprehensive test suite with 60+ tests covering initialization, input, movement, rendering, and integration."
    icon: "🧪"
  - title: "🔌 Modern APIs"
    details: "Clean TypeScript interfaces for seamless integration with React, Vue, or any modern frontend framework."
    icon: "🔌"
  - title: "📚 Rich Documentation"
    details: "Complete guides for SDK integration, app development, process management, and API reference."
    icon: "📚"
---

<div class="hero">
  <h1 class="doom-accent doom-glow">Welcome to DOOM AO</h1>
  <p>
    The <strong>Atticus of Sparta</strong> (AO) process brings the classic DOOM experience to modern web applications through WebAssembly. 
    Built with performance, reliability, and developer experience in mind.
  </p>
</div>

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/atticusofsparta/doomgeneric

# Navigate to the project
cd doomgeneric

# Run the test suite
npm test
```

## 🎯 Key Features

- **12 Action Systems**: STRAFE, AUTORUN, Weapon Cycling, Automap, Save/Load, Vertical Look, Screen Controls
- **Mouse Integration**: Full mouse movement, clicking, and wheel support  
- **Memory Management**: In-memory save states and WAD manipulation
- **Performance Optimized**: Averages 6-13ms response time per action
- **100% Test Coverage**: Comprehensive testing across all systems

## 🏗️ Architecture

The DOOM AO system consists of three main components:

1. **Process Layer** (`C/WebAssembly`) - Core DOOM engine with message handling
2. **SDK Layer** (`TypeScript`) - Client library for easy integration  
3. **App Layer** (`Frontend Framework`) - Your application using DOOM AO

Ready to integrate DOOM into your application? Check out our [Getting Started Guide](/guide/) or dive into the [API Reference](/api/).
