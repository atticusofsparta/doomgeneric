# DOOM Frontend - Implementation Starter

This document provides ready-to-use code templates and examples for quickly implementing a DOOM web frontend.

## Quick Start Template

### 1. Project Setup

```bash
# Create new React + TypeScript project
npm create vite@latest doom-frontend -- --template react-ts
cd doom-frontend

# Install dependencies
npm install
npm install @permaweb/ao-loader zustand

# Install dev dependencies
npm install -D @types/node
```

### 2. Basic App Structure

```typescript
// src/App.tsx
import React, { useState, useCallback } from 'react';
import { DoomGame } from './components/DoomGame';
import { WADLoader } from './components/WADLoader';
import { useDoomStore } from './store/doomStore';
import './App.css';

const App: React.FC = () => {
  const { isGameLoaded, isConnected, connectionError } = useDoomStore();
  const [showGame, setShowGame] = useState(false);

  const handleWADLoaded = useCallback(() => {
    setShowGame(true);
  }, []);

  if (connectionError) {
    return (
      <div className="error-container">
        <h1>Connection Error</h1>
        <p>{connectionError}</p>
        <button onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="loading-container">
        <h1>Connecting to AO...</h1>
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>DOOM - AO Edition</h1>
        <div className="status">
          {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
        </div>
      </header>

      <main className="app-main">
        {!showGame ? (
          <WADLoader onWADLoaded={handleWADLoaded} />
        ) : (
          <DoomGame />
        )}
      </main>
    </div>
  );
};

export default App;
```

### 3. WAD Loader Component

```typescript
// src/components/WADLoader.tsx
import React, { useCallback, useState } from 'react';
import { useDoomStore } from '../store/doomStore';

interface WADLoaderProps {
  onWADLoaded: () => void;
}

export const WADLoader: React.FC<WADLoaderProps> = ({ onWADLoaded }) => {
  const { loadWAD, initGame } = useDoomStore();
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setProgress(0);

    try {
      // Validate WAD file
      if (!file.name.toLowerCase().endsWith('.wad')) {
        throw new Error('Please select a valid WAD file');
      }

      setProgress(25);

      // Load WAD
      await loadWAD(file);
      setProgress(75);

      // Initialize game
      await initGame();
      setProgress(100);

      // Short delay to show completion
      setTimeout(() => {
        onWADLoaded();
      }, 500);

    } catch (error) {
      console.error('Failed to load WAD:', error);
      alert(`Failed to load WAD: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsLoading(false);
      setProgress(0);
    }
  }, [loadWAD, initGame, onWADLoaded]);

  return (
    <div className="wad-loader">
      <div className="wad-loader-content">
        <h2>Load DOOM WAD File</h2>
        <p>Select a DOOM WAD file to start playing</p>

        {!isLoading ? (
          <div className="file-input-container">
            <input
              type="file"
              accept=".wad"
              onChange={handleFileSelect}
              id="wad-file-input"
              className="file-input"
            />
            <label htmlFor="wad-file-input" className="file-input-label">
              Choose WAD File
            </label>
            <p className="file-help">
              Supports DOOM, DOOM II, and compatible WAD files
            </p>
          </div>
        ) : (
          <div className="loading-container">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${progress}%` }}
              />
            </div>
            <p>Loading... {progress}%</p>
          </div>
        )}
      </div>
    </div>
  );
};
```

### 4. Main Game Component

```typescript
// src/components/DoomGame.tsx
import React, { useEffect, useRef, useCallback } from 'react';
import { useDoomStore } from '../store/doomStore';
import { useGameLoop } from '../hooks/useGameLoop';
import { useInputManager } from '../hooks/useInputManager';
import { GameCanvas } from './GameCanvas';
import { GameHUD } from './GameHUD';
import { GameControls } from './GameControls';

export const DoomGame: React.FC = () => {
  const { 
    screenData, 
    gameStats, 
    isGameRunning,
    sendInput, 
    sendTick, 
    requestScreen,
    startGame,
    pauseGame
  } = useDoomStore();

  const gameContainerRef = useRef<HTMLDivElement>(null);

  // Game loop management
  const { start: startGameLoop, stop: stopGameLoop, isRunning } = useGameLoop(
    useCallback(async (deltaMs: number) => {
      await sendTick(deltaMs);
    }, [sendTick]),
    useCallback(async () => {
      await requestScreen();
    }, [requestScreen])
  );

  // Input management
  const inputHandlers = useInputManager(
    useCallback(async (action: string, data: any) => {
      await sendInput(action, data);
    }, [sendInput])
  );

  // Auto-start game when component mounts
  useEffect(() => {
    startGame();
    startGameLoop();

    return () => {
      stopGameLoop();
    };
  }, [startGame, startGameLoop, stopGameLoop]);

  // Handle pause/resume with spacebar when not in game
  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Escape' && !event.repeat) {
        if (isGameRunning) {
          pauseGame();
          stopGameLoop();
        } else {
          startGame();
          startGameLoop();
        }
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [isGameRunning, startGame, pauseGame, startGameLoop, stopGameLoop]);

  return (
    <div 
      ref={gameContainerRef}
      className="doom-game"
      tabIndex={0}
    >
      <div className="game-main">
        <GameCanvas
          screenData={screenData}
          width={640}
          height={400}
          {...inputHandlers}
        />
        
        <GameHUD 
          gameStats={gameStats}
          isRunning={isGameRunning}
          fps={60} // TODO: Calculate actual FPS
        />
      </div>

      <GameControls
        isRunning={isGameRunning}
        onPause={() => {
          pauseGame();
          stopGameLoop();
        }}
        onResume={() => {
          startGame();
          startGameLoop();
        }}
        onSave={() => sendInput('SaveGame', { slot: 1, description: 'Quick Save' })}
        onLoad={() => sendInput('LoadGame', { slot: 1 })}
      />

      {!isGameRunning && (
        <div className="game-overlay">
          <div className="pause-menu">
            <h2>Game Paused</h2>
            <p>Press ESC to resume</p>
            <button onClick={() => {
              startGame();
              startGameLoop();
            }}>
              Resume Game
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
```

### 5. Game Canvas Component

```typescript
// src/components/GameCanvas.tsx
import React, { useRef, useEffect, useCallback } from 'react';

interface GameCanvasProps {
  screenData: string | null;
  width: number;
  height: number;
  onKeyDown: (event: KeyboardEvent) => void;
  onKeyUp: (event: KeyboardEvent) => void;
  onMouseMove: (event: MouseEvent) => void;
  onMouseDown: (event: MouseEvent) => void;
  onMouseUp: (event: MouseEvent) => void;
  onWheel: (event: WheelEvent) => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  screenData,
  width,
  height,
  onKeyDown,
  onKeyUp,
  onMouseMove,
  onMouseDown,
  onMouseUp,
  onWheel
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);

  // Initialize canvas context
  useEffect(() => {
    if (canvasRef.current && !contextRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        contextRef.current = ctx;
        // Set image smoothing for pixel-perfect rendering
        ctx.imageSmoothingEnabled = false;
      }
    }
  }, []);

  // Render screen data
  useEffect(() => {
    if (contextRef.current && screenData) {
      const ctx = contextRef.current;
      const img = new Image();
      
      img.onload = () => {
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
      };
      
      img.onerror = () => {
        console.error('Failed to load screen image');
      };
      
      img.src = `data:image/png;base64,${screenData}`;
    }
  }, [screenData, width, height]);

  // Input event handlers with proper event binding
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    event.preventDefault();
    onKeyDown(event.nativeEvent);
  }, [onKeyDown]);

  const handleKeyUp = useCallback((event: React.KeyboardEvent) => {
    event.preventDefault();
    onKeyUp(event.nativeEvent);
  }, [onKeyUp]);

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    onMouseMove(event.nativeEvent);
  }, [onMouseMove]);

  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    onMouseDown(event.nativeEvent);
  }, [onMouseDown]);

  const handleMouseUp = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    onMouseUp(event.nativeEvent);
  }, [onMouseUp]);

  const handleWheel = useCallback((event: React.WheelEvent) => {
    event.preventDefault();
    onWheel(event.nativeEvent);
  }, [onWheel]);

  // Focus canvas when clicked
  const handleCanvasClick = useCallback(() => {
    canvasRef.current?.focus();
  }, []);

  return (
    <div className="game-canvas-container">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        tabIndex={0}
        onClick={handleCanvasClick}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()} // Disable right-click menu
        className="game-canvas"
      />
      
      {!screenData && (
        <div className="canvas-placeholder">
          <p>Loading game screen...</p>
        </div>
      )}
    </div>
  );
};
```

### 6. Zustand Store

```typescript
// src/store/doomStore.ts
import { create } from 'zustand';
import { AOConnector } from '../lib/AOConnector';

interface GameStats {
  health?: number;
  armor?: number;
  ammo?: number[];
  weapons?: number[];
  level?: number;
  episode?: number;
}

interface DoomStore {
  // Connection state
  isConnected: boolean;
  connectionError: string | null;
  aoConnector: AOConnector | null;
  
  // Game state
  isGameLoaded: boolean;
  isGameRunning: boolean;
  gameStats: GameStats;
  screenData: string | null;
  
  // Actions
  connect: (processId: string, endpoint: string) => Promise<void>;
  loadWAD: (wadFile: File) => Promise<void>;
  initGame: () => Promise<void>;
  startGame: () => void;
  pauseGame: () => void;
  sendInput: (action: string, data: any) => Promise<void>;
  sendTick: (deltaMs: number) => Promise<void>;
  requestScreen: () => Promise<void>;
  saveGame: (slot: number, description?: string) => Promise<void>;
  loadGame: (slot: number) => Promise<void>;
}

// Helper function to convert File to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix to get pure base64
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const useDoomStore = create<DoomStore>((set, get) => ({
  // Initial state
  isConnected: false,
  connectionError: null,
  aoConnector: null,
  isGameLoaded: false,
  isGameRunning: false,
  gameStats: {},
  screenData: null,

  // Connect to AO
  connect: async (processId: string, endpoint: string) => {
    try {
      const connector = new AOConnector({
        processId,
        endpoint,
        timeout: 10000,
        retryAttempts: 3
      });

      await connector.connect();
      
      set({ 
        aoConnector: connector, 
        isConnected: true, 
        connectionError: null 
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown connection error';
      set({ 
        connectionError: errorMessage,
        isConnected: false 
      });
      throw error;
    }
  },

  // Load WAD file
  loadWAD: async (wadFile: File) => {
    const { aoConnector } = get();
    if (!aoConnector) throw new Error('Not connected to AO');

    try {
      const base64WAD = await fileToBase64(wadFile);
      const result = await aoConnector.sendMessage('LoadWAD', { wad: base64WAD });
      
      if (result.Error) {
        throw new Error(result.Error);
      }
      
      set({ isGameLoaded: true });
    } catch (error) {
      console.error('Failed to load WAD:', error);
      throw error;
    }
  },

  // Initialize game
  initGame: async () => {
    const { aoConnector } = get();
    if (!aoConnector) throw new Error('Not connected to AO');

    try {
      const result = await aoConnector.sendMessage('Init', {});
      
      if (result.Error) {
        throw new Error(result.Error);
      }
      
      console.log('Game initialized:', result.Output);
    } catch (error) {
      console.error('Failed to initialize game:', error);
      throw error;
    }
  },

  // Start/pause game
  startGame: () => set({ isGameRunning: true }),
  pauseGame: () => set({ isGameRunning: false }),

  // Send input to game
  sendInput: async (action: string, data: any) => {
    const { aoConnector, isGameRunning } = get();
    if (!aoConnector || !isGameRunning) return;

    try {
      const result = await aoConnector.sendMessage(action, data);
      
      if (result.Error) {
        console.error('Input error:', result.Error);
      }
    } catch (error) {
      console.error('Failed to send input:', error);
    }
  },

  // Send game tick
  sendTick: async (deltaMs: number) => {
    const { aoConnector, isGameRunning } = get();
    if (!aoConnector || !isGameRunning) return;

    try {
      const result = await aoConnector.sendMessage('Tick', { deltaMs });
      
      if (result.Error) {
        console.error('Tick error:', result.Error);
      }
    } catch (error) {
      console.error('Failed to send tick:', error);
    }
  },

  // Request screen update
  requestScreen: async () => {
    const { aoConnector, isGameRunning } = get();
    if (!aoConnector || !isGameRunning) return;

    try {
      const result = await aoConnector.sendMessage('GetScreen', {});
      
      if (result.Error) {
        console.error('Screen request error:', result.Error);
        return;
      }

      if (result.Output) {
        try {
          const screenResponse = JSON.parse(result.Output);
          if (screenResponse.screen) {
            set({ screenData: screenResponse.screen });
          }
        } catch (parseError) {
          console.error('Failed to parse screen data:', parseError);
        }
      }
    } catch (error) {
      console.error('Failed to request screen:', error);
    }
  },

  // Save game
  saveGame: async (slot: number, description = 'Save Game') => {
    const { aoConnector } = get();
    if (!aoConnector) throw new Error('Not connected to AO');

    try {
      const result = await aoConnector.sendMessage('SaveGame', { slot, description });
      
      if (result.Error) {
        throw new Error(result.Error);
      }
      
      console.log('Game saved:', result.Output);
    } catch (error) {
      console.error('Failed to save game:', error);
      throw error;
    }
  },

  // Load game
  loadGame: async (slot: number) => {
    const { aoConnector } = get();
    if (!aoConnector) throw new Error('Not connected to AO');

    try {
      const result = await aoConnector.sendMessage('LoadGame', { slot });
      
      if (result.Error) {
        throw new Error(result.Error);
      }
      
      console.log('Game loaded:', result.Output);
    } catch (error) {
      console.error('Failed to load game:', error);
      throw error;
    }
  },
}));

// Auto-connect when store is created (in a real app, this would be configurable)
const store = useDoomStore.getState();
store.connect('doom-process-id', 'ws://localhost:8080/ao');
```

### 7. CSS Styles

```css
/* src/App.css */
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #000;
  color: #fff;
  font-family: 'Courier New', monospace;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #1a1a1a;
  border-bottom: 1px solid #333;
}

.app-header h1 {
  margin: 0;
  color: #ff6b35;
  font-size: 1.5rem;
}

.status {
  font-size: 0.9rem;
}

.app-main {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1rem;
}

/* WAD Loader */
.wad-loader {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
}

.wad-loader-content {
  text-align: center;
  max-width: 400px;
  padding: 2rem;
  background: #1a1a1a;
  border-radius: 8px;
  border: 1px solid #333;
}

.file-input {
  display: none;
}

.file-input-label {
  display: inline-block;
  padding: 1rem 2rem;
  background: #ff6b35;
  color: white;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.file-input-label:hover {
  background: #e55a2b;
}

.file-help {
  margin-top: 1rem;
  font-size: 0.9rem;
  color: #999;
}

/* Progress Bar */
.progress-bar {
  width: 100%;
  height: 20px;
  background: #333;
  border-radius: 10px;
  overflow: hidden;
  margin: 1rem 0;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #ff6b35, #ff8c42);
  transition: width 0.3s ease;
}

/* Game Components */
.doom-game {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
}

.game-main {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}

.game-canvas-container {
  position: relative;
  border: 2px solid #333;
  border-radius: 4px;
  background: #000;
}

.game-canvas {
  display: block;
  image-rendering: pixelated;
  image-rendering: -moz-crisp-edges;
  image-rendering: crisp-edges;
  cursor: none;
}

.game-canvas:focus {
  outline: 2px solid #ff6b35;
}

.canvas-placeholder {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #666;
}

/* Game Overlay */
.game-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.pause-menu {
  background: #1a1a1a;
  padding: 2rem;
  border-radius: 8px;
  border: 1px solid #333;
  text-align: center;
}

.pause-menu button {
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  background: #ff6b35;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
}

.pause-menu button:hover {
  background: #e55a2b;
}

/* Loading and Error States */
.loading-container, .error-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100vh;
  text-align: center;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #333;
  border-top: 4px solid #ff6b35;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 1rem 0;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Responsive Design */
@media (max-width: 768px) {
  .app-header {
    padding: 0.5rem;
  }
  
  .app-header h1 {
    font-size: 1.2rem;
  }
  
  .game-canvas {
    max-width: 100%;
    height: auto;
  }
  
  .wad-loader-content {
    margin: 1rem;
    padding: 1.5rem;
  }
}
```

This starter template provides a complete foundation for building a DOOM frontend with all the essential components, proper state management, and a clean architecture that can be easily extended.
