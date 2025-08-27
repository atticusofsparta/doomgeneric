import { LogLevel, LogEntry } from '../types/index.js';

export class TestLogger {
  private logs: LogEntry[] = [];
  private currentLevel: keyof LogLevel = 'INFO';
  private currentTestName?: string;

  constructor(level: keyof LogLevel = 'INFO') {
    this.currentLevel = level;
  }

  setLevel(level: keyof LogLevel): void {
    this.currentLevel = level;
  }

  setCurrentTest(testName: string): void {
    this.currentTestName = testName;
  }

  clearCurrentTest(): void {
    this.currentTestName = undefined;
  }

  private shouldLog(level: keyof LogLevel): boolean {
    const levels: Record<keyof LogLevel, number> = {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3,
    };
    return levels[level] >= levels[this.currentLevel];
  }

  private formatMessage(level: keyof LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const testPrefix = this.currentTestName ? `[${this.currentTestName}] ` : '';
    const dataStr = data ? ` | ${JSON.stringify(data, null, 2)}` : '';
    return `${timestamp} ${level.padEnd(5)} ${testPrefix}${message}${dataStr}`;
  }

  debug(message: string, data?: any): void {
    if (!this.shouldLog('DEBUG')) return;
    
    const entry: LogEntry = {
      timestamp: new Date(),
      level: 'DEBUG',
      message,
      data,
      testName: this.currentTestName,
    };
    
    this.logs.push(entry);
    console.log(`🔍 ${this.formatMessage('DEBUG', message, data)}`);
  }

  info(message: string, data?: any): void {
    if (!this.shouldLog('INFO')) return;
    
    const entry: LogEntry = {
      timestamp: new Date(),
      level: 'INFO',
      message,
      data,
      testName: this.currentTestName,
    };
    
    this.logs.push(entry);
    console.log(`ℹ️  ${this.formatMessage('INFO', message, data)}`);
  }

  warn(message: string, data?: any): void {
    if (!this.shouldLog('WARN')) return;
    
    const entry: LogEntry = {
      timestamp: new Date(),
      level: 'WARN',
      message,
      data,
      testName: this.currentTestName,
    };
    
    this.logs.push(entry);
    console.warn(`⚠️  ${this.formatMessage('WARN', message, data)}`);
  }

  error(message: string, data?: any): void {
    if (!this.shouldLog('ERROR')) return;
    
    const entry: LogEntry = {
      timestamp: new Date(),
      level: 'ERROR',
      message,
      data,
      testName: this.currentTestName,
    };
    
    this.logs.push(entry);
    console.error(`❌ ${this.formatMessage('ERROR', message, data)}`);
  }

  // Test-specific logging methods
  testStart(testName: string): void {
    this.setCurrentTest(testName);
    this.info(`🧪 Starting test: ${testName}`);
  }

  testEnd(testName: string, success: boolean, duration: number): void {
    const status = success ? '✅ PASSED' : '❌ FAILED';
    this.info(`🏁 Test completed: ${testName} | ${status} | ${duration}ms`);
    this.clearCurrentTest();
  }

  aoMessage(action: string, data: any): void {
    this.debug(`📤 AO Message sent`, { action, data });
  }

  aoResponse(result: any): void {
    const { Output, Error, GasUsed, Memory } = result;
    this.debug(`📥 AO Response received`, { 
      Output, 
      Error, 
      GasUsed, 
      MemorySize: Memory ? Memory.byteLength : 0 
    });
  }

  doomOutput(output: any): void {
    if (output) {
      const outputStr = typeof output === 'string' ? output : JSON.stringify(output);
      if (outputStr && outputStr.trim()) {
        this.info(`🎮 DOOM Output: ${outputStr}`);
      }
    }
  }

  doomError(error: any): void {
    if (error) {
      const errorStr = typeof error === 'string' ? error : JSON.stringify(error);
      if (errorStr && errorStr.trim()) {
        this.error(`🎮 DOOM Error: ${errorStr}`);
      }
    }
  }

  // Extract specific data from DOOM outputs
  extractScreenData(output: any): { width: number; height: number; hasScreen: boolean } | null {
    try {
      if (typeof output === 'object' && output?.screen) {
        const width = output.width || 320;
        const height = output.height || 200;
        const hasScreen = !!output.screen;
        
        this.debug('Screen data extracted', { width, height, hasScreen });
        return { width, height, hasScreen };
      }
    } catch (e) {
      this.warn('Failed to extract screen data', { output, error: e });
    }
    return null;
  }

  extractGameState(output: string): any {
    try {
      // Look for specific game state indicators in DOOM output
      const indicators = {
        levelStarted: /startmap:\s*(\d+)/.test(output),
        episodeStarted: /startepisode:\s*(\d+)/.test(output),
        playerCount: /player\s+(\d+)\s+of\s+(\d+)/.test(output),
        skillLevel: /startskill\s+(\d+)/.test(output),
        initialized: /I_InitGraphics/.test(output),
        hudReady: /HU_Init/.test(output),
        statusBarReady: /ST_Init/.test(output),
      };

      if (Object.values(indicators).some(Boolean)) {
        this.debug('Game state indicators found', indicators);
        return indicators;
      }
    } catch (e) {
      this.warn('Failed to extract game state', { output, error: e });
    }
    return null;
  }

  // Performance tracking
  trackPerformance(operation: string, duration: number): void {
    if (duration > 1000) {
      this.warn(`⏰ Slow operation detected: ${operation} took ${duration}ms`);
    } else {
      this.debug(`⏱️  Performance: ${operation} took ${duration}ms`);
    }
  }

  // Get logs for a specific test
  getTestLogs(testName: string): LogEntry[] {
    return this.logs.filter(log => log.testName === testName);
  }

  // Get all logs
  getAllLogs(): LogEntry[] {
    return [...this.logs];
  }

  // Clear logs
  clearLogs(): void {
    this.logs = [];
  }

  // Export logs to JSON
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  // Get summary statistics
  getSummary(): { total: number; byLevel: Record<string, number>; byTest: Record<string, number> } {
    const byLevel: Record<string, number> = {};
    const byTest: Record<string, number> = {};

    this.logs.forEach(log => {
      // Count by level
      byLevel[log.level] = (byLevel[log.level] || 0) + 1;
      
      // Count by test
      if (log.testName) {
        byTest[log.testName] = (byTest[log.testName] || 0) + 1;
      }
    });

    return {
      total: this.logs.length,
      byLevel,
      byTest,
    };
  }
}

// Global logger instance
export const logger = new TestLogger('INFO');
