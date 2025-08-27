# Input System

The DOOM AO Input System provides comprehensive keyboard and mouse handling with support for all traditional DOOM controls plus modern enhancements.

## Overview

The input system handles:
- **Traditional DOOM keys** - All classic keyboard controls
- **Modern enhancements** - Mouse look, wheel support, additional actions
- **Input queuing** - Smooth input handling without dropped events
- **Customizable mappings** - Remap keys to suit your needs

## Key Mappings

### Movement Controls

```typescript
const MOVEMENT_KEYS = {
  FORWARD: 'ArrowUp',
  BACKWARD: 'ArrowDown', 
  TURN_LEFT: 'ArrowLeft',
  TURN_RIGHT: 'ArrowRight',
  STRAFE_LEFT: 'KeyA',
  STRAFE_RIGHT: 'KeyD',
  STRAFE: 'Alt',           // Hold to enable strafing
  AUTORUN: 'CapsLock'      // Toggle run/walk
};
```

### Action Controls

```typescript
const ACTION_KEYS = {
  FIRE: 'Control',
  USE: 'Space',
  NEXT_WEAPON: 'PageUp',
  PREV_WEAPON: 'PageDown',
  AUTOMAP: 'Tab'
};
```

### System Controls

```typescript
const SYSTEM_KEYS = {
  QUICKSAVE: 'F6',
  QUICKLOAD: 'F9',
  LOOK_UP: 'Insert',
  LOOK_DOWN: 'Delete',
  CENTER_VIEW: 'End',
  MESSAGE_TOGGLE: 'F8',
  SCREEN_SIZE_INCREASE: 'Equal',
  SCREEN_SIZE_DECREASE: 'Minus'
};
```

## Basic Input Handling

### Keyboard Events

```typescript
import { DoomInput } from '@doom-ao/sdk';

const input = new DoomInput(client);

// Handle key press events
document.addEventListener('keydown', (event) => {
  input.handleKeyDown(event.code);
});

document.addEventListener('keyup', (event) => {
  input.handleKeyUp(event.code);
});
```

### Mouse Events

```typescript
// Mouse movement
canvas.addEventListener('mousemove', (event) => {
  const deltaX = event.movementX;
  const deltaY = event.movementY;
  input.handleMouseMove(deltaX, deltaY);
});

// Mouse clicks
canvas.addEventListener('mousedown', (event) => {
  input.handleMouseDown(event.button, event.clientX, event.clientY);
});

canvas.addEventListener('mouseup', (event) => {
  input.handleMouseUp(event.button, event.clientX, event.clientY);
});

// Mouse wheel
canvas.addEventListener('wheel', (event) => {
  const direction = event.deltaY > 0 ? 'down' : 'up';
  input.handleMouseWheel(direction, Math.abs(event.deltaY));
});
```

## Advanced Input Features

### Input Mapping

Create custom key mappings for different control schemes:

```typescript
const customMapping = {
  FORWARD: 'KeyW',
  BACKWARD: 'KeyS',
  STRAFE_LEFT: 'KeyA', 
  STRAFE_RIGHT: 'KeyD',
  FIRE: 'MouseLeft',
  USE: 'KeyE',
  RELOAD: 'KeyR'
};

input.setKeyMapping(customMapping);
```

### Input Modes

Switch between different input modes:

```typescript
// Classic DOOM mode (keyboard only)
input.setMode('classic');

// Modern FPS mode (mouse look + WASD)
input.setMode('modern');

// Custom mode
input.setMode('custom', customMapping);
```

### Input Buffering

Handle input buffering for smooth gameplay:

```typescript
const inputBuffer = new DoomInputBuffer({
  bufferSize: 10,           // Keep last 10 inputs
  flushInterval: 16,        // Flush every 16ms (60 FPS)
  dropDuplicates: true      // Remove duplicate inputs
});

inputBuffer.on('flush', (inputs) => {
  inputs.forEach(input => client.sendInput(input));
});
```

## Mouse Configuration

### Sensitivity Settings

```typescript
input.setMouseSensitivity({
  horizontal: 2.0,  // X-axis sensitivity
  vertical: 1.5,    // Y-axis sensitivity
  wheel: 1.0        // Wheel sensitivity
});
```

### Mouse Inversion

```typescript
input.setMouseInversion({
  invertX: false,
  invertY: true     // Invert Y-axis (flight sim style)
});
```

### Pointer Lock

For immersive first-person experience:

```typescript
canvas.addEventListener('click', () => {
  if (document.pointerLockElement !== canvas) {
    canvas.requestPointerLock();
  }
});

document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  input.setPointerLocked(locked);
});
```

## Gamepad Support

Add gamepad support for console-like experience:

```typescript
const gamepadInput = new DoomGamepadInput(client);

// Configure gamepad mapping
gamepadInput.setMapping({
  axes: {
    leftStickX: 'turn',
    leftStickY: 'move',
    rightStickX: 'strafe',
    rightStickY: 'look'
  },
  buttons: {
    0: 'fire',        // A button
    1: 'use',         // B button  
    2: 'run',         // X button
    3: 'weapon_next'  // Y button
  }
});

// Handle gamepad updates
function updateGamepad() {
  gamepadInput.update();
  requestAnimationFrame(updateGamepad);
}
updateGamepad();
```

## Input Validation

Validate and sanitize input events:

```typescript
class InputValidator {
  static isValidKey(code: string): boolean {
    return /^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|F[1-9]|F1[0-2])$/.test(code);
  }
  
  static isValidMouseButton(button: number): boolean {
    return button >= 0 && button <= 4;
  }
  
  static clampMouseDelta(delta: number): number {
    return Math.max(-100, Math.min(100, delta));
  }
}

// Use in input handlers
document.addEventListener('keydown', (event) => {
  if (InputValidator.isValidKey(event.code)) {
    input.handleKeyDown(event.code);
  }
});
```

## Performance Optimization

### Input Throttling

Prevent input spam and improve performance:

```typescript
const throttledMouseMove = throttle((deltaX, deltaY) => {
  input.handleMouseMove(deltaX, deltaY);
}, 16); // 60 FPS max

canvas.addEventListener('mousemove', (event) => {
  throttledMouseMove(event.movementX, event.movementY);
});
```

### Batch Input Processing

Group multiple inputs for efficient processing:

```typescript
class InputBatcher {
  private inputs: InputEvent[] = [];
  private flushTimer: number | null = null;
  
  addInput(input: InputEvent) {
    this.inputs.push(input);
    this.scheduleFlush();
  }
  
  private scheduleFlush() {
    if (this.flushTimer) return;
    
    this.flushTimer = requestAnimationFrame(() => {
      this.flush();
      this.flushTimer = null;
    });
  }
  
  private flush() {
    if (this.inputs.length === 0) return;
    
    client.sendBatchedInput(this.inputs);
    this.inputs = [];
  }
}
```

## Accessibility Features

Support for accessible input methods:

```typescript
// Keyboard-only navigation
input.enableKeyboardOnlyMode();

// Configurable hold/toggle modes
input.setActionMode('fire', 'hold');    // Hold to fire
input.setActionMode('run', 'toggle');   // Toggle run mode

// Visual feedback for input state
input.on('keyStateChange', (key, pressed) => {
  updateKeyIndicator(key, pressed);
});
```

## Debugging Input

Debug input issues with built-in tools:

```typescript
// Enable input logging
input.enableDebugMode();

// Monitor input events
input.on('debug', (event) => {
  console.log('Input Event:', event);
});

// Input state inspector
const state = input.getDebugState();
console.log('Current input state:', state);
```

## Next Steps

- [State Management](./state) - Manage input state in your application
- [Testing Tools](./testing) - Test input handling
- [Examples](./examples) - See complete input implementation examples
