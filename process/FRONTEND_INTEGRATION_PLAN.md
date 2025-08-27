# DOOM AO Process - Frontend Integration Plan

## Overview

This document outlines the architecture, implementation strategy, and technical requirements for building a modern web frontend that integrates with the DOOM AO Process messaging API.

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Frontend  │────│  AO Connector   │────│  DOOM Process   │
│   (React/Vue)   │    │   (WebSocket)   │    │    (WASM)       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
    ┌─────────┐              ┌─────────┐              ┌─────────┐
    │   UI    │              │ Message │              │  DOOM   │
    │ Layer   │              │ Queue   │              │ Engine  │
    └─────────┘              └─────────┘              └─────────┘
```

## Technology Stack Recommendations

### Frontend Framework Options

#### Option 1: React + TypeScript (Recommended)
```typescript
// Modern React with hooks and TypeScript
interface DoomGameProps {
  processId: string;
  aoEndpoint: string;
}

const DoomGame: React.FC<DoomGameProps> = ({ processId, aoEndpoint }) => {
  // Game state management with React hooks
  const [gameState, setGameState] = useState<GameState>();
  const [isConnected, setIsConnected] = useState(false);
  const [screenData, setScreenData] = useState<string>();
  
  // AO connector hook
  const { sendMessage, onMessage } = useAOConnector(processId, aoEndpoint);
  
  return (
    <div className="doom-game-container">
      <GameCanvas screenData={screenData} />
      <GameControls onAction={handleGameAction} />
      <GameHUD gameState={gameState} />
    </div>
  );
};
```

**Pros:**
- Excellent TypeScript support
- Large ecosystem and community
- Great performance with modern hooks
- Easy testing and debugging

#### Option 2: Vue 3 + Composition API
```typescript
// Vue 3 with Composition API
export default defineComponent({
  name: 'DoomGame',
  props: {
    processId: String,
    aoEndpoint: String
  },
  setup(props) {
    const gameState = ref<GameState>();
    const isConnected = ref(false);
    const screenData = ref<string>();
    
    const { sendMessage, onMessage } = useAOConnector(
      props.processId, 
      props.aoEndpoint
    );
    
    return {
      gameState,
      isConnected,
      screenData,
      sendMessage
    };
  }
});
```

**Pros:**
- Clean composition API
- Excellent TypeScript integration
- Good performance
- Smaller bundle size

### State Management

#### Zustand (Recommended for React)
```typescript
interface DoomStore {
  // Game state
  isGameLoaded: boolean;
  isGameRunning: boolean;
  gameStats: GameStats;
  
  // Connection state
  isConnected: boolean;
  connectionError: string | null;
  
  // Actions
  loadWAD: (wadFile: File) => Promise<void>;
  initGame: () => Promise<void>;
  sendInput: (input: InputEvent) => Promise<void>;
  updateScreen: (screenData: string) => void;
}

const useDoomStore = create<DoomStore>((set, get) => ({
  // Initial state
  isGameLoaded: false,
  isGameRunning: false,
  gameStats: {},
  isConnected: false,
  connectionError: null,
  
  // Actions
  loadWAD: async (wadFile) => {
    const base64WAD = await fileToBase64(wadFile);
    await sendAOMessage({
      action: 'LoadWAD',
      data: { wad: base64WAD }
    });
    set({ isGameLoaded: true });
  },
  
  // ... other actions
}));
```

#### Pinia (Recommended for Vue)
```typescript
export const useDoomStore = defineStore('doom', {
  state: (): DoomState => ({
    isGameLoaded: false,
    isGameRunning: false,
    gameStats: {},
    isConnected: false,
    connectionError: null,
  }),
  
  actions: {
    async loadWAD(wadFile: File) {
      const base64WAD = await fileToBase64(wadFile);
      await this.sendAOMessage({
        action: 'LoadWAD',
        data: { wad: base64WAD }
      });
      this.isGameLoaded = true;
    },
    
    // ... other actions
  }
});
```

### AO Connector Layer

```typescript
interface AOConnectorConfig {
  processId: string;
  endpoint: string;
  timeout: number;
  retryAttempts: number;
}

class AOConnector {
  private config: AOConnectorConfig;
  private messageQueue: Map<string, Promise<AOResult>>;
  private websocket: WebSocket | null = null;
  private messageCounter = 0;
  
  constructor(config: AOConnectorConfig) {
    this.config = config;
    this.messageQueue = new Map();
  }
  
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.websocket = new WebSocket(this.config.endpoint);
      
      this.websocket.onopen = () => {
        console.log('Connected to AO');
        resolve();
      };
      
      this.websocket.onerror = (error) => {
        console.error('AO connection error:', error);
        reject(error);
      };
      
      this.websocket.onmessage = (event) => {
        this.handleMessage(JSON.parse(event.data));
      };
    });
  }
  
  async sendMessage(action: string, data: any = {}): Promise<AOResult> {
    const messageId = `msg-${++this.messageCounter}`;
    
    const message: AOMessage = {
      Id: messageId,
      "Block-Height": "1",
      Owner: "user-id",
      Module: "DOOM",
      Target: this.config.processId,
      From: "frontend-client",
      Timestamp: Date.now(),
      Reference: "1",
      Tags: [{ name: "Action", value: action }],
      Data: JSON.stringify(data)
    };
    
    return new Promise((resolve, reject) => {
      // Store promise resolver in queue
      this.messageQueue.set(messageId, { resolve, reject });
      
      // Send message
      if (this.websocket?.readyState === WebSocket.OPEN) {
        this.websocket.send(JSON.stringify(message));
      } else {
        reject(new Error('WebSocket not connected'));
      }
      
      // Timeout handling
      setTimeout(() => {
        if (this.messageQueue.has(messageId)) {
          this.messageQueue.delete(messageId);
          reject(new Error('Message timeout'));
        }
      }, this.config.timeout);
    });
  }
  
  private handleMessage(response: any): void {
    const messageId = response.Id;
    const resolver = this.messageQueue.get(messageId);
    
    if (resolver) {
      this.messageQueue.delete(messageId);
      
      if (response.Error) {
        resolver.reject(new Error(response.Error));
      } else {
        resolver.resolve(response);
      }
    }
  }
}

// React hook for AO connector
export function useAOConnector(processId: string, endpoint: string) {
  const [connector] = useState(() => new AOConnector({
    processId,
    endpoint,
    timeout: 10000,
    retryAttempts: 3
  }));
  
  const [isConnected, setIsConnected] = useState(false);
  
  useEffect(() => {
    connector.connect()
      .then(() => setIsConnected(true))
      .catch(console.error);
  }, [connector]);
  
  const sendMessage = useCallback(async (action: string, data?: any) => {
    return connector.sendMessage(action, data);
  }, [connector]);
  
  return {
    isConnected,
    sendMessage,
    connector
  };
}
```

## Core Components Architecture

### 1. Game Canvas Component

```typescript
interface GameCanvasProps {
  screenData: string | null;
  width?: number;
  height?: number;
  onKeyDown?: (event: KeyboardEvent) => void;
  onKeyUp?: (event: KeyboardEvent) => void;
  onMouseMove?: (event: MouseEvent) => void;
  onMouseDown?: (event: MouseEvent) => void;
  onMouseUp?: (event: MouseEvent) => void;
  onWheel?: (event: WheelEvent) => void;
}

const GameCanvas: React.FC<GameCanvasProps> = ({
  screenData,
  width = 640,
  height = 400,
  onKeyDown,
  onKeyUp,
  onMouseMove,
  onMouseDown,
  onMouseUp,
  onWheel
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null);
  
  // Initialize canvas context
  useEffect(() => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      setContext(ctx);
    }
  }, []);
  
  // Render screen data to canvas
  useEffect(() => {
    if (context && screenData) {
      const img = new Image();
      img.onload = () => {
        context.clearRect(0, 0, width, height);
        context.drawImage(img, 0, 0, width, height);
      };
      img.src = `data:image/png;base64,${screenData}`;
    }
  }, [context, screenData, width, height]);
  
  // Input event handlers
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    event.preventDefault();
    onKeyDown?.(event);
  }, [onKeyDown]);
  
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      
      onMouseMove?.({
        ...event,
        offsetX: x,
        offsetY: y,
        movementX: event.movementX,
        movementY: event.movementY
      });
    }
  }, [onMouseMove]);
  
  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onKeyUp={onKeyUp}
      onMouseMove={handleMouseMove}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onWheel={onWheel}
      style={{
        border: '1px solid #333',
        backgroundColor: '#000',
        cursor: 'none', // Hide cursor for immersive experience
        outline: 'none' // Remove focus outline
      }}
    />
  );
};
```

### 2. Input Manager

```typescript
interface InputMapping {
  [key: string]: string; // Maps web keys to DOOM keys
}

const DEFAULT_INPUT_MAPPING: InputMapping = {
  'KeyW': 'ArrowUp',        // WASD movement
  'KeyS': 'ArrowDown',
  'KeyA': 'q',
  'KeyD': 'e',
  'ArrowUp': 'ArrowUp',     // Arrow keys
  'ArrowDown': 'ArrowDown',
  'ArrowLeft': 'ArrowLeft',
  'ArrowRight': 'ArrowRight',
  'Space': 'Space',         // Use
  'ControlLeft': 'Control', // Fire
  'ShiftLeft': 'Shift',     // Run
  'AltLeft': 'Alt',         // Strafe
  'Tab': 'Tab',             // Automap
  'Escape': 'Escape',       // Menu
  // ... complete mapping
};

class InputManager {
  private mapping: InputMapping;
  private pressedKeys: Set<string>;
  private onInputCallback: (action: string, data: any) => void;
  
  constructor(
    mapping: InputMapping = DEFAULT_INPUT_MAPPING,
    onInput: (action: string, data: any) => void
  ) {
    this.mapping = mapping;
    this.pressedKeys = new Set();
    this.onInputCallback = onInput;
  }
  
  handleKeyDown(event: KeyboardEvent): void {
    const doomKey = this.mapping[event.code];
    if (doomKey && !this.pressedKeys.has(event.code)) {
      this.pressedKeys.add(event.code);
      this.onInputCallback('KeyPress', { key: doomKey });
    }
  }
  
  handleKeyUp(event: KeyboardEvent): void {
    const doomKey = this.mapping[event.code];
    if (doomKey && this.pressedKeys.has(event.code)) {
      this.pressedKeys.delete(event.code);
      this.onInputCallback('KeyRelease', { key: doomKey });
    }
  }
  
  handleMouseMove(event: MouseEvent): void {
    if (event.movementX !== 0 || event.movementY !== 0) {
      this.onInputCallback('MouseMove', {
        deltaX: event.movementX,
        deltaY: event.movementY
      });
    }
  }
  
  handleMouseDown(event: MouseEvent): void {
    this.onInputCallback('MouseClick', {
      button: event.button,
      pressed: true,
      x: event.offsetX,
      y: event.offsetY
    });
  }
  
  handleMouseUp(event: MouseEvent): void {
    this.onInputCallback('MouseClick', {
      button: event.button,
      pressed: false,
      x: event.offsetX,
      y: event.offsetY
    });
  }
  
  handleWheel(event: WheelEvent): void {
    const direction = event.deltaY > 0 ? -1 : 1; // Normalize direction
    this.onInputCallback('MouseWheel', { direction });
  }
}

// React hook for input management
export function useInputManager(onInput: (action: string, data: any) => void) {
  const [inputManager] = useState(() => new InputManager(DEFAULT_INPUT_MAPPING, onInput));
  
  return {
    handleKeyDown: inputManager.handleKeyDown.bind(inputManager),
    handleKeyUp: inputManager.handleKeyUp.bind(inputManager),
    handleMouseMove: inputManager.handleMouseMove.bind(inputManager),
    handleMouseDown: inputManager.handleMouseDown.bind(inputManager),
    handleMouseUp: inputManager.handleMouseUp.bind(inputManager),
    handleWheel: inputManager.handleWheel.bind(inputManager),
  };
}
```

### 3. Game Loop Manager

```typescript
interface GameLoopConfig {
  targetFPS: number;
  maxFrameSkip: number;
}

class GameLoopManager {
  private config: GameLoopConfig;
  private isRunning: boolean = false;
  private lastFrameTime: number = 0;
  private frameId: number | null = null;
  private onTick: (deltaMs: number) => Promise<void>;
  private onRender: () => Promise<void>;
  
  constructor(
    config: GameLoopConfig,
    onTick: (deltaMs: number) => Promise<void>,
    onRender: () => Promise<void>
  ) {
    this.config = config;
    this.onTick = onTick;
    this.onRender = onRender;
  }
  
  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.lastFrameTime = performance.now();
    this.gameLoop();
  }
  
  stop(): void {
    this.isRunning = false;
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
  }
  
  private async gameLoop(): Promise<void> {
    if (!this.isRunning) return;
    
    const currentTime = performance.now();
    const deltaMs = currentTime - this.lastFrameTime;
    const targetFrameTime = 1000 / this.config.targetFPS;
    
    if (deltaMs >= targetFrameTime) {
      // Send tick to game engine
      await this.onTick(Math.min(deltaMs, targetFrameTime * this.config.maxFrameSkip));
      
      // Request screen update
      await this.onRender();
      
      this.lastFrameTime = currentTime;
    }
    
    this.frameId = requestAnimationFrame(() => this.gameLoop());
  }
}

// React hook for game loop
export function useGameLoop(
  onTick: (deltaMs: number) => Promise<void>,
  onRender: () => Promise<void>,
  config: GameLoopConfig = { targetFPS: 60, maxFrameSkip: 5 }
) {
  const [gameLoop] = useState(() => new GameLoopManager(config, onTick, onRender));
  const [isRunning, setIsRunning] = useState(false);
  
  const start = useCallback(() => {
    gameLoop.start();
    setIsRunning(true);
  }, [gameLoop]);
  
  const stop = useCallback(() => {
    gameLoop.stop();
    setIsRunning(false);
  }, [gameLoop]);
  
  useEffect(() => {
    return () => {
      gameLoop.stop();
    };
  }, [gameLoop]);
  
  return { start, stop, isRunning };
}
```

## Implementation Phases

### Phase 1: Basic Connection & Rendering (Week 1)
- [ ] Set up React/Vue project with TypeScript
- [ ] Implement AOConnector class
- [ ] Create basic GameCanvas component
- [ ] Implement LoadWAD functionality
- [ ] Basic screen rendering from AO process
- [ ] Simple game initialization flow

### Phase 2: Input System (Week 2)
- [ ] Implement InputManager class
- [ ] Add keyboard input handling
- [ ] Add mouse input handling
- [ ] Implement key mapping system
- [ ] Add input configuration UI
- [ ] Test all DOOM control actions

### Phase 3: Game Loop & State Management (Week 3)
- [ ] Implement GameLoopManager
- [ ] Add game state management (Zustand/Pinia)
- [ ] Implement save/load system
- [ ] Add error handling and recovery
- [ ] Performance optimization
- [ ] Add debugging tools

### Phase 4: UI/UX Enhancement (Week 4)
- [ ] Create game HUD components
- [ ] Add menu system
- [ ] Implement settings panel
- [ ] Add loading screens
- [ ] Mobile responsiveness
- [ ] Accessibility features

### Phase 5: Advanced Features (Week 5+)
- [ ] Multiplayer support (if available)
- [ ] Mod loading system
- [ ] Recording/replay functionality
- [ ] Performance metrics
- [ ] Advanced graphics options
- [ ] Social features (sharing, leaderboards)

## Performance Optimization

### 1. Rendering Optimization
```typescript
// Use OffscreenCanvas for better performance
const useOffscreenCanvas = () => {
  const [offscreenCanvas] = useState(() => new OffscreenCanvas(640, 400));
  const [context] = useState(() => offscreenCanvas.getContext('2d'));
  
  const renderFrame = useCallback(async (imageData: ImageData) => {
    if (context) {
      context.putImageData(imageData, 0, 0);
      return offscreenCanvas.transferToImageBitmap();
    }
  }, [context]);
  
  return { renderFrame };
};
```

### 2. Input Debouncing
```typescript
const useThrottledInput = (callback: Function, delay: number) => {
  const lastCall = useRef<number>(0);
  
  return useCallback((...args: any[]) => {
    const now = Date.now();
    if (now - lastCall.current >= delay) {
      lastCall.current = now;
      callback(...args);
    }
  }, [callback, delay]);
};
```

### 3. Message Queue Optimization
```typescript
class OptimizedMessageQueue {
  private queue: AOMessage[] = [];
  private isProcessing: boolean = false;
  private batchSize: number = 10;
  
  async addMessage(message: AOMessage): Promise<void> {
    this.queue.push(message);
    
    if (!this.isProcessing) {
      this.processBatch();
    }
  }
  
  private async processBatch(): Promise<void> {
    this.isProcessing = true;
    
    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.batchSize);
      await this.sendBatch(batch);
    }
    
    this.isProcessing = false;
  }
}
```

## Deployment Strategy

### Development Environment
```bash
# Package.json scripts
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest",
    "preview": "vite preview",
    "type-check": "tsc --noEmit"
  }
}
```

### Production Build
```typescript
// Vite config for production optimization
export default defineConfig({
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          'doom-engine': ['./src/lib/doom'],
          'ao-connector': ['./src/lib/ao'],
          'vendor': ['react', 'react-dom']
        }
      }
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
    exclude: ['@permaweb/ao-loader']
  }
});
```

### Container Deployment
```dockerfile
# Multi-stage Docker build
FROM node:18-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## Testing Strategy

### Unit Tests
```typescript
// Jest/Vitest tests for core components
describe('AOConnector', () => {
  it('should send messages correctly', async () => {
    const connector = new AOConnector(mockConfig);
    const result = await connector.sendMessage('Init', {});
    expect(result.Output).toBe('Game initialized');
  });
});

describe('InputManager', () => {
  it('should map keys correctly', () => {
    const inputManager = new InputManager(testMapping, mockCallback);
    inputManager.handleKeyDown(new KeyboardEvent('keydown', { code: 'KeyW' }));
    expect(mockCallback).toHaveBeenCalledWith('KeyPress', { key: 'ArrowUp' });
  });
});
```

### Integration Tests
```typescript
// End-to-end tests with Playwright
test('complete game flow', async ({ page }) => {
  await page.goto('/doom');
  
  // Load WAD file
  await page.setInputFiles('[data-testid="wad-input"]', 'test.wad');
  await page.click('[data-testid="load-button"]');
  
  // Wait for game initialization
  await page.waitForSelector('[data-testid="game-canvas"]');
  
  // Test input
  await page.keyboard.press('ArrowUp');
  
  // Verify game response
  await expect(page.locator('[data-testid="game-status"]')).toContainText('Running');
});
```

## Security Considerations

### 1. Input Validation
```typescript
const validateGameInput = (action: string, data: any): boolean => {
  const allowedActions = ['LoadWAD', 'Init', 'Tick', 'KeyPress', 'KeyRelease', 'MouseMove', 'MouseClick', 'MouseWheel', 'GetScreen', 'SaveGame', 'LoadGame'];
  
  if (!allowedActions.includes(action)) {
    throw new Error(`Invalid action: ${action}`);
  }
  
  // Validate data structure based on action
  switch (action) {
    case 'KeyPress':
    case 'KeyRelease':
      if (!data.key || typeof data.key !== 'string') {
        throw new Error('Invalid key data');
      }
      break;
    // ... other validations
  }
  
  return true;
};
```

### 2. WAD File Validation
```typescript
const validateWADFile = (file: File): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const buffer = event.target?.result as ArrayBuffer;
      const view = new DataView(buffer);
      
      // Check WAD header
      const header = String.fromCharCode(
        view.getUint8(0),
        view.getUint8(1),
        view.getUint8(2),
        view.getUint8(3)
      );
      
      if (header === 'IWAD' || header === 'PWAD') {
        resolve(true);
      } else {
        reject(new Error('Invalid WAD file format'));
      }
    };
    
    reader.readAsArrayBuffer(file.slice(0, 4));
  });
};
```

## Monitoring & Analytics

### Performance Monitoring
```typescript
interface PerformanceMetrics {
  frameRate: number;
  inputLatency: number;
  messageLatency: number;
  memoryUsage: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    frameRate: 0,
    inputLatency: 0,
    messageLatency: 0,
    memoryUsage: 0
  };
  
  startFrameRateMonitoring(): void {
    let frameCount = 0;
    let lastTime = performance.now();
    
    const measureFPS = () => {
      const currentTime = performance.now();
      frameCount++;
      
      if (currentTime - lastTime >= 1000) {
        this.metrics.frameRate = frameCount;
        frameCount = 0;
        lastTime = currentTime;
      }
      
      requestAnimationFrame(measureFPS);
    };
    
    measureFPS();
  }
  
  measureInputLatency(startTime: number): void {
    this.metrics.inputLatency = performance.now() - startTime;
  }
  
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }
}
```

This comprehensive plan provides a solid foundation for building a modern, performant DOOM web frontend that integrates seamlessly with the AO Process messaging API.
