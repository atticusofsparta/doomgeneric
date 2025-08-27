// Core AO Message Types
export interface AOMessage {
  Id: string;
  "Block-Height": string;
  Owner: string;
  Module: string;
  Target: string;
  From: string;
  Timestamp: number;
  Reference: string;
  Tags: Array<{ name: string; value: string }>;
  Data: string | object;
}

export interface AOEnvironment {
  Process: {
    Id: string;
    Owner: string;
    Tags: Array<{ name: string; value: string }>;
  };
}

export interface AOResult {
  Output?: string;
  Error?: string;
  Messages?: any[];
  Memory: ArrayBuffer;
  GasUsed: number;
}

// DOOM Specific Types
export interface DoomAction {
  action: 'LoadWAD' | 'Init' | 'Tick' | 'KeyPress' | 'KeyRelease' | 'MouseMove' | 'MouseClick' | 'MouseWheel' | 'GetScreen' | 'SaveGame' | 'LoadGame' | 'Menu';
  data?: any;
}

export interface DoomKeyEvent {
  key: string;
  timestamp?: number;
}

export interface DoomMouseMoveEvent {
  deltaX: number;
  deltaY: number;
}

export interface DoomMouseClickEvent {
  button: number; // 0 = left, 1 = right, 2 = middle
  pressed: boolean;
  x?: number; // Optional click coordinates
  y?: number;
}

export interface DoomMouseWheelEvent {
  direction: number; // Positive = scroll up, negative = scroll down
}

export interface DoomTickData {
  deltaMs: number;
}

export interface DoomScreenData {
  screen: string; // base64 encoded
  width: number;
  height: number;
}

export interface DoomGameState {
  level?: number;
  episode?: number;
  skill?: number;
  health?: number;
  armor?: number;
  weapons?: number[];
  ammo?: number[];
}

export interface DoomSaveData {
  slot: number;
  name?: string;
  data: string; // base64 encoded save data
}

// Test Result Types
export interface TestResult {
  name: string;
  success: boolean;
  duration: number;
  error?: string;
  data?: any;
  logs?: string[];
}

export interface TestSuite {
  name: string;
  results: TestResult[];
  totalTests: number;
  passedTests: number;
  failedTests: number;
  duration: number;
}

// Logger Types
export interface LogLevel {
  DEBUG: 'debug';
  INFO: 'info';
  WARN: 'warn';
  ERROR: 'error';
}

export interface LogEntry {
  timestamp: Date;
  level: keyof LogLevel;
  message: string;
  data?: any;
  testName?: string;
}

// AO Loader Configuration
export interface AOLoaderConfig {
  format: string;
  inputEncoding: string;
  outputEncoding: string;
  memoryLimit: string;
  computeLimit: string;
  extensions: any[];
}

// Test Configuration
export interface TestConfig {
  wadPath?: string;
  timeout: number;
  retries: number;
  skipSlowTests: boolean;
  logLevel: keyof LogLevel;
  aoLoaderConfig: AOLoaderConfig;
}

// DOOM Constants
export const DOOM_CONSTANTS = {
  SCREEN_WIDTH: 320,
  SCREEN_HEIGHT: 200,
  SCALED_WIDTH: 640,
  SCALED_HEIGHT: 400,
  MAX_HEALTH: 100,
  MAX_ARMOR: 200,
  EPISODES: [1, 2, 3, 4],
  SKILLS: [1, 2, 3, 4, 5], // Too Young to Die, Hey Not Too Rough, Hurt Me Plenty, Ultra-Violence, Nightmare
  MAX_SAVE_SLOTS: 8,
} as const;

// Key mappings for DOOM
export const DOOM_KEYS = {
  // Movement
  FORWARD: 'ArrowUp',
  BACKWARD: 'ArrowDown', 
  TURN_LEFT: 'ArrowLeft',
  TURN_RIGHT: 'ArrowRight',
  STRAFE_LEFT: 'q',
  STRAFE_RIGHT: 'e',
  RUN: 'Shift',
  
  // Actions
  FIRE: 'Control',
  USE: 'Space',
  STRAFE: 'Alt',
  AUTORUN: 'CapsLock',
  AUTOMAP: 'Tab',
  LOOK_UP: 'Insert',
  LOOK_DOWN: 'Delete',
  CENTER_VIEW: 'End',
  
  // Weapons
  WEAPON_1: '1',
  WEAPON_2: '2',
  WEAPON_3: '3',
  WEAPON_4: '4',
  WEAPON_5: '5',
  WEAPON_6: '6',
  WEAPON_7: '7',
  NEXT_WEAPON: 'PageUp',
  PREV_WEAPON: 'PageDown',
  
  // Menu
  MENU: 'Escape',
  ENTER: 'Enter',
  
  // System
  PAUSE: 'p',
  SCREENSHOT: 'F1',
  SAVE_GAME: 'F2',
  LOAD_GAME: 'F3',
  SOUND_VOLUME: 'F4',
  HUD: 'F5',
  QUICKSAVE: 'F6',
  ENDGAME: 'F7',
  MESSAGE_TOGGLE: 'F8',
  QUICKLOAD: 'F9',
  QUIT: 'F10',
  GAMMA: 'F11',
  SPION: 'F12',
  
  // Screen size controls
  SCREEN_SIZE_INCREASE: 'Equal',
  SCREEN_SIZE_DECREASE: 'Minus',
} as const;

export type DoomKey = typeof DOOM_KEYS[keyof typeof DOOM_KEYS];

// Mouse button mappings for DOOM
export const DOOM_MOUSE = {
  // Mouse buttons (follows standard web convention)
  LEFT_BUTTON: 0,
  RIGHT_BUTTON: 1,  
  MIDDLE_BUTTON: 2,
  
  // Mouse wheel directions
  WHEEL_UP: 1,
  WHEEL_DOWN: -1,
  
  // Mouse sensitivity settings
  DEFAULT_SENSITIVITY: 1.0,
  MIN_SENSITIVITY: 0.1,
  MAX_SENSITIVITY: 5.0,
} as const;

export type DoomMouseButton = typeof DOOM_MOUSE.LEFT_BUTTON | typeof DOOM_MOUSE.RIGHT_BUTTON | typeof DOOM_MOUSE.MIDDLE_BUTTON;
