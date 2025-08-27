import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
// @ts-ignore - AO Loader may not have proper TypeScript definitions
import AoLoader from '@permaweb/ao-loader';

import { 
  AOMessage, 
  AOEnvironment, 
  AOResult, 
  DoomAction, 
  DoomKeyEvent, 
  DoomTickData,
  DoomMouseMoveEvent,
  DoomMouseClickEvent,
  DoomMouseWheelEvent,
  AOLoaderConfig,
  DOOM_CONSTANTS,
  DOOM_MOUSE,
  DOOM_KEYS
} from '../types/index.js';
import { logger } from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class DoomTestClient {
  private handle: any;
  private memory: ArrayBuffer | null = null;
  private wasmBinary: Buffer;
  private config: AOLoaderConfig;
  private messageCounter = 0;
  private isInitialized = false;
  private wadLoaded = false;
  private gameInitialized = false;

  constructor(config?: Partial<AOLoaderConfig>) {
    this.config = {
      format: "wasm32-unknown-emscripten4",
      inputEncoding: "JSON-1",
      outputEncoding: "JSON-1",
      memoryLimit: "1073741824", // 1GB
      computeLimit: "9000000000",
      extensions: [],
      ...config
    };

    // Load WASM binary
    const wasmPath = path.join(__dirname, '../../src/doom_process.wasm');
    this.wasmBinary = readFileSync(wasmPath);
    logger.info(`DOOM WASM loaded: ${Math.round(this.wasmBinary.length / 1024)} KB`);
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    logger.info('Initializing AO Loader handle...');
    const startTime = Date.now();

    try {
      // AO Loader sometimes needs to be called as a function
      const loaderFn = typeof AoLoader === 'function' ? AoLoader : (AoLoader as any).default;
      this.handle = await loaderFn(this.wasmBinary, this.config);
      this.isInitialized = true;
      
      const duration = Date.now() - startTime;
      logger.trackPerformance('AO Loader initialization', duration);
      logger.info('✅ AO Loader handle created successfully');
    } catch (error) {
      logger.error('Failed to initialize AO Loader', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  private createMessage(action: string, data: any = {}): AOMessage {
    this.messageCounter++;
    
    return {
      Id: `doom-test-${this.messageCounter.toString().padStart(6, '0')}`,
      "Block-Height": "1",
      Owner: "doom-test-owner-1234567890123456789012345",
      Module: "DOOM",
      Target: "doom-process-1234567890123456789012345",
      From: "doom-test-user-1234567890123456789012345",
      Timestamp: Date.now(),
      Reference: "1",
      Tags: [{ name: "Action", value: action }],
      Data: JSON.stringify(data)
    };
  }

  private createEnvironment(): AOEnvironment {
    return {
      Process: {
        Id: "doom-process",
        Owner: "doom-test-owner",
        Tags: [
          { name: "Data-Protocol", value: "ao" },
          { name: "Type", value: "Process" },
          { name: "Variant", value: "ao.TN.1" }
        ]
      }
    };
  }

  async sendMessage(action: string, data: any = {}): Promise<AOResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const message = this.createMessage(action, data);
    const environment = this.createEnvironment();
    
    logger.aoMessage(action, data);
    const startTime = Date.now();

    try {
      const result = await this.handle(this.memory, message, environment);
      this.memory = result.Memory;
      
      const duration = Date.now() - startTime;
      logger.trackPerformance(`Message: ${action}`, duration);
      logger.aoResponse(result);

      // Log DOOM-specific outputs
      if (result.Output) {
        logger.doomOutput(result.Output);
      }
      if (result.Error) {
        logger.doomError(result.Error);
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Message ${action} failed after ${duration}ms`, { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  // WAD Management
  async loadWAD(wadPath?: string): Promise<AOResult> {
    const targetPath = wadPath || path.join(__dirname, '../../../../Doom1.WAD');
    
    logger.info(`Loading WAD file: ${targetPath}`);
    
    try {
      const wadBuffer = readFileSync(targetPath);
      const wadBase64 = wadBuffer.toString('base64');
      
      logger.info(`WAD file loaded: ${Math.round(wadBuffer.length / 1024)} KB -> ${Math.round(wadBase64.length / 1024)} KB base64`);
      
      const result = await this.sendMessage('LoadWAD', { wadData: wadBase64 });
      
      if (!result.Error) {
        this.wadLoaded = true;
        logger.info('✅ WAD loaded successfully');
      } else {
        logger.error('❌ WAD loading failed', { error: result.Error });
      }
      
      return result;
    } catch (error) {
      logger.error('Failed to read WAD file', { error: error instanceof Error ? error.message : String(error), wadPath: targetPath });
      throw error;
    }
  }

  // Game Initialization
  async initializeGame(): Promise<AOResult> {
    if (!this.wadLoaded) {
      logger.warn('WAD not loaded, loading default WAD first...');
      await this.loadWAD();
    }

    logger.info('Initializing DOOM game...');
    const result = await this.sendMessage('Init');
    
    if (!result.Error) {
      this.gameInitialized = true;
      
      // Extract game state from initialization output
      if (result.Output) {
        const gameState = logger.extractGameState(result.Output);
        if (gameState) {
          logger.info('Game state extracted from initialization', gameState);
        }
      }
      
      logger.info('✅ DOOM game initialized successfully');
    } else {
      logger.error('❌ DOOM initialization failed', { error: result.Error });
    }
    
    return result;
  }

  // Game Loop
  async tick(deltaMs: number = 16): Promise<AOResult> {
    const tickData: DoomTickData = { deltaMs };
    return this.sendMessage('Tick', tickData);
  }

  async runTicks(count: number, deltaMs: number = 16): Promise<AOResult[]> {
    logger.info(`Running ${count} game ticks with ${deltaMs}ms delta`);
    const results: AOResult[] = [];
    
    for (let i = 0; i < count; i++) {
      const result = await this.tick(deltaMs);
      results.push(result);
      
      if (result.Error) {
        logger.warn(`Tick ${i + 1}/${count} had error: ${result.Error}`);
        break;
      }
    }
    
    logger.info(`Completed ${results.length}/${count} ticks`);
    return results;
  }

  // Input Management
  async keyPress(key: string): Promise<AOResult> {
    logger.debug(`Key press: ${key}`);
    return this.sendMessage('KeyPress', { key });
  }

  async keyRelease(key: string): Promise<AOResult> {
    logger.debug(`Key release: ${key}`);
    return this.sendMessage('KeyRelease', { key });
  }

  async keyTap(key: string, holdDuration: number = 50): Promise<{ press: AOResult; release: AOResult }> {
    const press = await this.keyPress(key);
    
    // Simulate hold duration
    await new Promise(resolve => setTimeout(resolve, holdDuration));
    
    const release = await this.keyRelease(key);
    
    return { press, release };
  }

  // Action-specific convenience methods
  async strafe(pressed: boolean): Promise<AOResult> {
    return pressed ? this.keyPress(DOOM_KEYS.STRAFE) : this.keyRelease(DOOM_KEYS.STRAFE);
  }

  async strafePress(): Promise<AOResult> {
    return this.strafe(true);
  }

  async strafeRelease(): Promise<AOResult> {
    return this.strafe(false);
  }

  async strafeTap(holdDuration: number = 100): Promise<{ press: AOResult; release: AOResult }> {
    return this.keyTap(DOOM_KEYS.STRAFE, holdDuration);
  }

  async autorun(pressed: boolean): Promise<AOResult> {
    return pressed ? this.keyPress(DOOM_KEYS.AUTORUN) : this.keyRelease(DOOM_KEYS.AUTORUN);
  }

  async autorunPress(): Promise<AOResult> {
    return this.autorun(true);
  }

  async autorunRelease(): Promise<AOResult> {
    return this.autorun(false);
  }

  async autorunToggle(): Promise<{ press: AOResult; release: AOResult }> {
    return this.keyTap(DOOM_KEYS.AUTORUN, 50); // Quick tap to toggle
  }

  async nextWeapon(): Promise<{ press: AOResult; release: AOResult }> {
    return this.keyTap(DOOM_KEYS.NEXT_WEAPON, 50);
  }

  async prevWeapon(): Promise<{ press: AOResult; release: AOResult }> {
    return this.keyTap(DOOM_KEYS.PREV_WEAPON, 50);
  }

  async cycleWeapon(direction: 'next' | 'prev'): Promise<{ press: AOResult; release: AOResult }> {
    return direction === 'next' ? this.nextWeapon() : this.prevWeapon();
  }

  async automapToggle(): Promise<{ press: AOResult; release: AOResult }> {
    return this.keyTap(DOOM_KEYS.AUTOMAP, 50);
  }

  async showAutomap(): Promise<{ press: AOResult; release: AOResult }> {
    logger.info('Toggling automap display');
    return this.automapToggle();
  }

  async hideAutomap(): Promise<{ press: AOResult; release: AOResult }> {
    logger.info('Toggling automap display');
    return this.automapToggle();
  }

  async quicksave(): Promise<{ press: AOResult; release: AOResult }> {
    logger.info('Performing quicksave');
    return this.keyTap(DOOM_KEYS.QUICKSAVE, 50);
  }

  async quickload(): Promise<{ press: AOResult; release: AOResult }> {
    logger.info('Performing quickload');
    return this.keyTap(DOOM_KEYS.QUICKLOAD, 50);
  }

  async quicksaveGame(): Promise<{ press: AOResult; release: AOResult }> {
    return this.quicksave();
  }

  async quickloadGame(): Promise<{ press: AOResult; release: AOResult }> {
    return this.quickload();
  }

  async lookUp(pressed: boolean): Promise<AOResult> {
    logger.debug(`Look up ${pressed ? 'pressed' : 'released'}`);
    return pressed ? this.keyPress(DOOM_KEYS.LOOK_UP) : this.keyRelease(DOOM_KEYS.LOOK_UP);
  }

  async lookUpPress(): Promise<AOResult> {
    return this.lookUp(true);
  }

  async lookUpRelease(): Promise<AOResult> {
    return this.lookUp(false);
  }

  async lookUpTap(holdDuration: number = 100): Promise<{ press: AOResult; release: AOResult }> {
    return this.keyTap(DOOM_KEYS.LOOK_UP, holdDuration);
  }

  async lookDown(pressed: boolean): Promise<AOResult> {
    logger.debug(`Look down ${pressed ? 'pressed' : 'released'}`);
    return pressed ? this.keyPress(DOOM_KEYS.LOOK_DOWN) : this.keyRelease(DOOM_KEYS.LOOK_DOWN);
  }

  async lookDownPress(): Promise<AOResult> {
    return this.lookDown(true);
  }

  async lookDownRelease(): Promise<AOResult> {
    return this.lookDown(false);
  }

  async lookDownTap(holdDuration: number = 100): Promise<{ press: AOResult; release: AOResult }> {
    return this.keyTap(DOOM_KEYS.LOOK_DOWN, holdDuration);
  }

  async lookVertical(direction: 'up' | 'down', holdDuration: number = 100): Promise<{ press: AOResult; release: AOResult }> {
    return direction === 'up' ? this.lookUpTap(holdDuration) : this.lookDownTap(holdDuration);
  }

  async centerView(): Promise<{ press: AOResult; release: AOResult }> {
    logger.debug('Centering view');
    return this.keyTap(DOOM_KEYS.CENTER_VIEW, 50);
  }

  async centerLook(): Promise<{ press: AOResult; release: AOResult }> {
    return this.centerView();
  }

  async resetView(): Promise<{ press: AOResult; release: AOResult }> {
    logger.debug('Resetting view to center');
    return this.centerView();
  }

  async recenterView(): Promise<{ press: AOResult; release: AOResult }> {
    return this.centerView();
  }

  async messageToggle(): Promise<{ press: AOResult; release: AOResult }> {
    logger.debug('Toggling message display');
    return this.keyTap(DOOM_KEYS.MESSAGE_TOGGLE, 50);
  }

  async toggleMessages(): Promise<{ press: AOResult; release: AOResult }> {
    return this.messageToggle();
  }

  async showMessages(): Promise<{ press: AOResult; release: AOResult }> {
    logger.debug('Toggling message display');
    return this.messageToggle();
  }

  async hideMessages(): Promise<{ press: AOResult; release: AOResult }> {
    logger.debug('Toggling message display');
    return this.messageToggle();
  }

  async screenSizeIncrease(): Promise<{ press: AOResult; release: AOResult }> {
    logger.debug('Increasing screen size');
    return this.keyTap(DOOM_KEYS.SCREEN_SIZE_INCREASE, 50);
  }

  async screenSizeDecrease(): Promise<{ press: AOResult; release: AOResult }> {
    logger.debug('Decreasing screen size');
    return this.keyTap(DOOM_KEYS.SCREEN_SIZE_DECREASE, 50);
  }

  async increaseScreenSize(): Promise<{ press: AOResult; release: AOResult }> {
    return this.screenSizeIncrease();
  }

  async decreaseScreenSize(): Promise<{ press: AOResult; release: AOResult }> {
    return this.screenSizeDecrease();
  }

  async adjustScreenSize(direction: 'increase' | 'decrease'): Promise<{ press: AOResult; release: AOResult }> {
    return direction === 'increase' ? this.screenSizeIncrease() : this.screenSizeDecrease();
  }

  async screenSizePlus(): Promise<{ press: AOResult; release: AOResult }> {
    return this.screenSizeIncrease();
  }

  async screenSizeMinus(): Promise<{ press: AOResult; release: AOResult }> {
    return this.screenSizeDecrease();
  }

  // Mouse Input Management
  async mouseMove(deltaX: number, deltaY: number): Promise<AOResult> {
    logger.debug(`Mouse move: deltaX=${deltaX}, deltaY=${deltaY}`);
    const mouseEvent: DoomMouseMoveEvent = { deltaX, deltaY };
    return this.sendMessage('MouseMove', mouseEvent);
  }

  async mouseClick(button: number, pressed: boolean, x?: number, y?: number): Promise<AOResult> {
    logger.debug(`Mouse ${pressed ? 'press' : 'release'}: button=${button}${x !== undefined && y !== undefined ? `, pos=(${x},${y})` : ''}`);
    const mouseEvent: DoomMouseClickEvent = { button, pressed, x, y };
    return this.sendMessage('MouseClick', mouseEvent);
  }

  async mousePress(button: number, x?: number, y?: number): Promise<AOResult> {
    return this.mouseClick(button, true, x, y);
  }

  async mouseRelease(button: number, x?: number, y?: number): Promise<AOResult> {
    return this.mouseClick(button, false, x, y);
  }

  async mouseClickTap(button: number, holdDuration: number = 50, x?: number, y?: number): Promise<{ press: AOResult; release: AOResult }> {
    const press = await this.mousePress(button, x, y);
    
    // Simulate hold duration
    await new Promise(resolve => setTimeout(resolve, holdDuration));
    
    const release = await this.mouseRelease(button, x, y);
    
    return { press, release };
  }

  async mouseWheel(direction: number): Promise<AOResult> {
    logger.debug(`Mouse wheel: direction=${direction}`);
    const wheelEvent: DoomMouseWheelEvent = { direction };
    return this.sendMessage('MouseWheel', wheelEvent);
  }

  async mouseWheelUp(): Promise<AOResult> {
    return this.mouseWheel(DOOM_MOUSE.WHEEL_UP);
  }

  async mouseWheelDown(): Promise<AOResult> {
    return this.mouseWheel(DOOM_MOUSE.WHEEL_DOWN);
  }

  // Convenience methods for common mouse actions
  async leftClick(x?: number, y?: number, holdDuration: number = 50): Promise<{ press: AOResult; release: AOResult }> {
    return this.mouseClickTap(DOOM_MOUSE.LEFT_BUTTON, holdDuration, x, y);
  }

  async rightClick(x?: number, y?: number, holdDuration: number = 50): Promise<{ press: AOResult; release: AOResult }> {
    return this.mouseClickTap(DOOM_MOUSE.RIGHT_BUTTON, holdDuration, x, y);
  }

  async middleClick(x?: number, y?: number, holdDuration: number = 50): Promise<{ press: AOResult; release: AOResult }> {
    return this.mouseClickTap(DOOM_MOUSE.MIDDLE_BUTTON, holdDuration, x, y);
  }

  // Mouse movement patterns for testing
  async mouseMovePattern(pattern: Array<{ deltaX: number; deltaY: number; delay?: number }>): Promise<AOResult[]> {
    const results: AOResult[] = [];
    
    for (const move of pattern) {
      const result = await this.mouseMove(move.deltaX, move.deltaY);
      results.push(result);
      
      if (move.delay) {
        await new Promise(resolve => setTimeout(resolve, move.delay));
      }
    }
    
    return results;
  }

  // Screen Management
  async getScreen(): Promise<AOResult> {
    const result = await this.sendMessage('GetScreen');
    
    if (result.Output && !result.Error) {
      const screenData = logger.extractScreenData(result.Output);
      if (screenData) {
        logger.info('Screen data retrieved', screenData);
      }
    }
    
    return result;
  }

  // Save/Load Game
  async saveGame(slot: number, name?: string): Promise<AOResult> {
    logger.info(`Saving game to slot ${slot}${name ? ` (${name})` : ''}`);
    return this.sendMessage('SaveGame', { slot, name });
  }

  async loadGame(slot: number): Promise<AOResult> {
    logger.info(`Loading game from slot ${slot}`);
    return this.sendMessage('LoadGame', { slot });
  }

  // Menu Navigation
  async openMenu(): Promise<{ press: AOResult; release: AOResult }> {
    logger.info('Opening game menu');
    return this.keyTap('Escape');
  }

  async menuNavigate(direction: 'up' | 'down'): Promise<{ press: AOResult; release: AOResult }> {
    const key = direction === 'up' ? 'ArrowUp' : 'ArrowDown';
    return this.keyTap(key);
  }

  async menuSelect(): Promise<{ press: AOResult; release: AOResult }> {
    return this.keyTap('Enter');
  }

  // Utility Methods
  getState(): { initialized: boolean; wadLoaded: boolean; gameInitialized: boolean; messageCount: number } {
    return {
      initialized: this.isInitialized,
      wadLoaded: this.wadLoaded,
      gameInitialized: this.gameInitialized,
      messageCount: this.messageCounter,
    };
  }

  getMemorySize(): number {
    return this.memory ? this.memory.byteLength : 0;
  }

  async waitForStableState(maxWait: number = 5000): Promise<boolean> {
    logger.debug('Waiting for stable game state...');
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWait) {
      const result = await this.tick(16);
      
      // Check if game is in stable state (no errors, consistent output)
      if (!result.Error && result.Output === 'Tick processed') {
        logger.debug('Stable state achieved');
        return true;
      }
      
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    logger.warn(`Stable state not achieved within ${maxWait}ms`);
    return false;
  }

  // Performance Testing
  async performanceTest(iterations: number = 100): Promise<{ avgDuration: number; minDuration: number; maxDuration: number }> {
    logger.info(`Running performance test with ${iterations} iterations`);
    const durations: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      await this.tick();
      const duration = Date.now() - startTime;
      durations.push(duration);
    }
    
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);
    
    logger.info('Performance test completed', { avgDuration, minDuration, maxDuration });
    
    return { avgDuration, minDuration, maxDuration };
  }

  // Cleanup
  async cleanup(): Promise<void> {
    logger.info('Cleaning up DOOM test client');
    this.memory = null;
    this.handle = null;
    this.isInitialized = false;
    this.wadLoaded = false;
    this.gameInitialized = false;
    this.messageCounter = 0;
  }
}
