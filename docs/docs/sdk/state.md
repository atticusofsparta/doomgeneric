# State Management

The DOOM AO State Management system provides reactive state stores and utilities for integrating DOOM game state with modern frontend frameworks.

## Overview

State management in DOOM AO applications involves:
- **Game state synchronization** - Keep UI in sync with game state
- **Input state management** - Handle complex input sequences
- **Save/load state** - Manage game saves and settings
- **Performance optimization** - Efficient state updates and rendering

## Framework Integration

### React Integration

#### Basic Zustand Store

```typescript
import { create } from 'zustand';
import { DoomClient } from '@doom-ao/client';

interface DoomState {
  // Connection state
  connected: boolean;
  connecting: boolean;
  
  // Game state
  gameInitialized: boolean;
  gameRunning: boolean;
  currentLevel: string;
  
  // Player state
  health: number;
  armor: number;
  ammunition: Record<string, number>;
  currentWeapon: string;
  
  // Screen state
  screenData: string | null;
  screenWidth: number;
  screenHeight: number;
  
  // Actions
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  tick: () => Promise<void>;
  updateScreen: () => Promise<void>;
}

export const useDoomStore = create<DoomState>((set, get) => ({
  // Initial state
  connected: false,
  connecting: false,
  gameInitialized: false,
  gameRunning: false,
  currentLevel: '',
  health: 100,
  armor: 0,
  ammunition: {},
  currentWeapon: 'pistol',
  screenData: null,
  screenWidth: 640,
  screenHeight: 400,
  
  // Actions
  connect: async () => {
    const { connecting } = get();
    if (connecting) return;
    
    set({ connecting: true });
    try {
      await client.connect();
      set({ connected: true, connecting: false });
    } catch (error) {
      set({ connecting: false });
      throw error;
    }
  },
  
  disconnect: async () => {
    await client.disconnect();
    set({ 
      connected: false, 
      gameInitialized: false,
      gameRunning: false 
    });
  },
  
  tick: async () => {
    await client.tick();
    // Update game state after tick
    // This would typically parse game state from the client
  },
  
  updateScreen: async () => {
    const screen = await client.getScreen();
    set({
      screenData: screen.screen,
      screenWidth: screen.width,
      screenHeight: screen.height
    });
  }
}));
```

#### React Hook Usage

```typescript
import { useDoomStore } from './stores/doomStore';

function DoomGame() {
  const { 
    connected, 
    connecting, 
    screenData, 
    connect, 
    disconnect,
    updateScreen 
  } = useDoomStore();
  
  useEffect(() => {
    if (connected) {
      const gameLoop = async () => {
        await updateScreen();
        requestAnimationFrame(gameLoop);
      };
      gameLoop();
    }
  }, [connected, updateScreen]);
  
  return (
    <div className="doom-game">
      {!connected ? (
        <button onClick={connect} disabled={connecting}>
          {connecting ? 'Connecting...' : 'Connect to DOOM'}
        </button>
      ) : (
        <div>
          <button onClick={disconnect}>Disconnect</button>
          {screenData && (
            <img 
              src={`data:image/png;base64,${screenData}`}
              alt="DOOM Screen"
            />
          )}
        </div>
      )}
    </div>
  );
}
```

### Vue Integration

#### Pinia Store

```typescript
import { defineStore } from 'pinia';
import { DoomClient } from '@doom-ao/client';

export const useDoomStore = defineStore('doom', {
  state: () => ({
    connected: false,
    connecting: false,
    gameState: null as GameState | null,
    screenData: null as string | null,
    inputState: {
      keysPressed: new Set<string>(),
      mousePosition: { x: 0, y: 0 },
      mouseButtons: new Set<number>()
    }
  }),
  
  getters: {
    isPlaying: (state) => state.connected && state.gameState?.playing,
    playerStats: (state) => state.gameState?.player,
    screenImage: (state) => 
      state.screenData ? `data:image/png;base64,${state.screenData}` : null
  },
  
  actions: {
    async connect() {
      this.connecting = true;
      try {
        await client.connect();
        this.connected = true;
      } finally {
        this.connecting = false;
      }
    },
    
    async disconnect() {
      await client.disconnect();
      this.connected = false;
      this.gameState = null;
      this.screenData = null;
    },
    
    updateInputState(type: string, data: any) {
      switch (type) {
        case 'keydown':
          this.inputState.keysPressed.add(data.key);
          break;
        case 'keyup':
          this.inputState.keysPressed.delete(data.key);
          break;
        case 'mousemove':
          this.inputState.mousePosition = data;
          break;
      }
    }
  }
});
```

#### Vue Component Usage

```vue
<template>
  <div class="doom-game">
    <div v-if="!connected" class="connection-panel">
      <button @click="connect" :disabled="connecting">
        {{ connecting ? 'Connecting...' : 'Connect to DOOM' }}
      </button>
    </div>
    
    <div v-else class="game-panel">
      <div class="game-screen">
        <img 
          v-if="screenImage" 
          :src="screenImage" 
          alt="DOOM Screen"
          @mousemove="handleMouseMove"
          @keydown="handleKeyDown"
          @keyup="handleKeyUp"
          tabindex="0"
        />
      </div>
      
      <div class="game-ui">
        <div class="player-stats" v-if="playerStats">
          <span>Health: {{ playerStats.health }}</span>
          <span>Armor: {{ playerStats.armor }}</span>
          <span>Ammo: {{ playerStats.ammo }}</span>
        </div>
        
        <button @click="disconnect">Disconnect</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useDoomStore } from '@/stores/doom';

const store = useDoomStore();

const connected = computed(() => store.connected);
const connecting = computed(() => store.connecting);
const screenImage = computed(() => store.screenImage);
const playerStats = computed(() => store.playerStats);

const connect = () => store.connect();
const disconnect = () => store.disconnect();

const handleMouseMove = (event: MouseEvent) => {
  store.updateInputState('mousemove', {
    x: event.clientX,
    y: event.clientY,
    deltaX: event.movementX,
    deltaY: event.movementY
  });
};

const handleKeyDown = (event: KeyboardEvent) => {
  store.updateInputState('keydown', { key: event.code });
};

const handleKeyUp = (event: KeyboardEvent) => {
  store.updateInputState('keyup', { key: event.code });
};
</script>
```

## State Synchronization

### Real-time Game State Updates

```typescript
class DoomStateSync {
  private store: any;
  private client: DoomClient;
  private syncInterval: number;
  
  constructor(store: any, client: DoomClient) {
    this.store = store;
    this.client = client;
    this.syncInterval = 0;
  }
  
  start() {
    this.syncInterval = setInterval(async () => {
      try {
        // Get current game state
        const gameState = await this.client.getGameState();
        
        // Update store with new state
        this.store.updateGameState(gameState);
        
        // Update screen
        const screen = await this.client.getScreen();
        this.store.updateScreen(screen);
        
      } catch (error) {
        console.error('State sync error:', error);
      }
    }, 16); // 60 FPS
  }
  
  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = 0;
    }
  }
}
```

### Optimistic Updates

Handle input with optimistic updates for responsive UI:

```typescript
class OptimisticInputHandler {
  constructor(private store: any, private client: DoomClient) {}
  
  async handleKeyPress(key: string) {
    // Optimistically update UI state
    this.store.updateInputState({ [key]: true });
    
    try {
      // Send to server
      await this.client.keyPress(key);
    } catch (error) {
      // Revert on error
      this.store.updateInputState({ [key]: false });
      throw error;
    }
  }
  
  async handleMovement(direction: string) {
    // Optimistically update player position
    const currentPos = this.store.getPlayerPosition();
    const optimisticPos = this.calculateNewPosition(currentPos, direction);
    this.store.updatePlayerPosition(optimisticPos);
    
    try {
      await this.client.move(direction);
      // Server will send authoritative position update
    } catch (error) {
      // Revert to last known good position
      this.store.updatePlayerPosition(currentPos);
    }
  }
}
```

## Save State Management

### Save Slot Management

```typescript
interface SaveSlot {
  id: number;
  description: string;
  timestamp: number;
  level: string;
  playerStats: PlayerStats;
  thumbnail?: string;
}

class SaveManager {
  private saves: SaveSlot[] = [];
  
  async saveGame(slot: number, description: string): Promise<void> {
    const gameState = await client.getGameState();
    const screen = await client.getScreen();
    
    const save: SaveSlot = {
      id: slot,
      description,
      timestamp: Date.now(),
      level: gameState.currentLevel,
      playerStats: gameState.player,
      thumbnail: screen.screen // Base64 thumbnail
    };
    
    await client.saveGame(slot, description);
    
    // Update local save list
    const existingIndex = this.saves.findIndex(s => s.id === slot);
    if (existingIndex >= 0) {
      this.saves[existingIndex] = save;
    } else {
      this.saves.push(save);
    }
    
    // Persist save metadata
    localStorage.setItem('doom-saves', JSON.stringify(this.saves));
  }
  
  async loadGame(slot: number): Promise<void> {
    await client.loadGame(slot);
    
    // Update store with loaded state
    const gameState = await client.getGameState();
    store.updateGameState(gameState);
  }
  
  getSaves(): SaveSlot[] {
    return this.saves.sort((a, b) => b.timestamp - a.timestamp);
  }
  
  deleteSave(slot: number): void {
    this.saves = this.saves.filter(s => s.id !== slot);
    localStorage.setItem('doom-saves', JSON.stringify(this.saves));
  }
}
```

## Performance Optimization

### State Update Batching

```typescript
class StateBatcher {
  private pendingUpdates: Map<string, any> = new Map();
  private flushTimer: number | null = null;
  
  queueUpdate(key: string, value: any) {
    this.pendingUpdates.set(key, value);
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
    if (this.pendingUpdates.size === 0) return;
    
    const updates = Object.fromEntries(this.pendingUpdates);
    store.batchUpdate(updates);
    
    this.pendingUpdates.clear();
  }
}
```

### Selective Re-rendering

```typescript
// React optimization with selective updates
const DoomUI = memo(() => {
  const health = useDoomStore(state => state.health);
  const armor = useDoomStore(state => state.armor);
  
  return (
    <div className="doom-ui">
      <HealthBar health={health} />
      <ArmorBar armor={armor} />
    </div>
  );
});

// Vue optimization with computed properties
const playerStatsComputed = computed(() => ({
  health: store.health,
  armor: store.armor,
  ammo: store.ammo
}));
```

## Testing State Management

```typescript
import { renderHook, act } from '@testing-library/react';
import { useDoomStore } from './doomStore';

describe('DoomStore', () => {
  test('should connect to DOOM process', async () => {
    const { result } = renderHook(() => useDoomStore());
    
    expect(result.current.connected).toBe(false);
    
    await act(async () => {
      await result.current.connect();
    });
    
    expect(result.current.connected).toBe(true);
  });
  
  test('should update screen data', async () => {
    const { result } = renderHook(() => useDoomStore());
    
    await act(async () => {
      await result.current.updateScreen();
    });
    
    expect(result.current.screenData).toBeTruthy();
  });
});
```

## Next Steps

- [Testing Tools](./testing) - Test your state management
- [Types](./types) - TypeScript definitions for state
- [Examples](./examples) - Complete state management examples
