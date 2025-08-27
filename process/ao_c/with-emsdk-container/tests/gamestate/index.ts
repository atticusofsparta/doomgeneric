import { DoomTestClient } from '../utils/doom-client.js';
import { TestRunner } from '../utils/test-runner.js';
import { logger } from '../utils/logger.js';
import { DOOM_KEYS, DOOM_CONSTANTS } from '../types/index.js';

const runner = new TestRunner({
  logLevel: 'INFO',
  timeout: 30000, // Game state operations can be slow
});

export async function runGameStateTests(): Promise<void> {
  const client = new DoomTestClient();

  // Initialize game first
  await client.initialize();
  await client.loadWAD();
  await client.initializeGame();
  await client.waitForStableState();

  const tests = [
    {
      name: 'Game State Initialization Verification',
      fn: TestRunner.createAsyncTest(async () => {
        const state = client.getState();
        
        TestRunner.expect.truthy(state.initialized, 'Client should be initialized');
        TestRunner.expect.truthy(state.wadLoaded, 'WAD should be loaded');
        TestRunner.expect.truthy(state.gameInitialized, 'Game should be initialized');
        TestRunner.expect.truthy(state.messageCount > 0, 'Messages should have been sent');
        
        logger.info('Game state initialization verified', state);
      })
    },

    {
      name: 'Game State Persistence Through Ticks',
      fn: TestRunner.createAsyncTest(async () => {
        const initialMemorySize = client.getMemorySize();
        
        // Run many ticks to test state persistence
        const tickResults = await client.runTicks(50, 16);
        
        const finalMemorySize = client.getMemorySize();
        
        // All ticks should succeed
        const failedTicks = tickResults.filter(r => r.Error);
        TestRunner.expect.equal(failedTicks.length, 0, 'Game state should persist through many ticks');
        
        // Memory size should remain stable (within reasonable bounds)
        const memoryChange = Math.abs(finalMemorySize - initialMemorySize);
        const maxAcceptableChange = 1024 * 1024; // 1MB variance is acceptable
        
        TestRunner.expect.truthy(
          memoryChange <= maxAcceptableChange,
          `Memory should remain stable (changed by ${memoryChange} bytes)`
        );
        
        logger.info('Game state persistence verified', {
          ticksProcessed: tickResults.length,
          initialMemory: initialMemorySize,
          finalMemory: finalMemorySize,
          memoryChange
        });
      })
    },

    {
      name: 'Game State During Input Activity',
      fn: TestRunner.createAsyncTest(async () => {
        const startTime = Date.now();
        
        // Simulate active gameplay with various inputs
        const inputSequence = [
          { key: DOOM_KEYS.FORWARD, duration: 200 },
          { key: DOOM_KEYS.TURN_LEFT, duration: 150 },
          { key: DOOM_KEYS.FIRE, duration: 100 },
          { key: DOOM_KEYS.STRAFE_RIGHT, duration: 180 },
          { key: DOOM_KEYS.USE, duration: 50 },
        ];
        
        for (const input of inputSequence) {
          await client.keyPress(input.key);
          await client.runTicks(Math.floor(input.duration / 16), 16);
          await client.keyRelease(input.key);
          await client.runTicks(2, 16); // Small pause between inputs
        }
        
        const duration = Date.now() - startTime;
        logger.info(`Active gameplay simulation completed in ${duration}ms`);
        
        // Verify game is still stable after input activity
        const stableTickResults = await client.runTicks(10, 16);
        const failedTicks = stableTickResults.filter(r => r.Error);
        TestRunner.expect.equal(failedTicks.length, 0, 'Game should remain stable after input activity');
      })
    },

    {
      name: 'Game State Recovery After Invalid Operations',
      fn: TestRunner.createAsyncTest(async () => {
        // Try some potentially invalid operations
        await client.loadGame(99); // Invalid slot
        await client.runTicks(3, 16);
        
        await client.saveGame(-1); // Invalid slot
        await client.runTicks(3, 16);
        
        // Try loading from all slots (most will fail)
        for (let slot = 1; slot <= DOOM_CONSTANTS.MAX_SAVE_SLOTS; slot++) {
          await client.loadGame(slot);
          await client.runTicks(1, 16);
        }
        
        // Game should still be stable after all these invalid operations
        const recoveryTicks = await client.runTicks(10, 16);
        const failedTicks = recoveryTicks.filter(r => r.Error);
        TestRunner.expect.equal(failedTicks.length, 0, 'Game should recover from invalid operations');
        
        logger.info('Game state recovery verified after invalid operations');
      })
    },

    {
      name: 'Screen State Consistency',
      fn: TestRunner.createAsyncTest(async () => {
        // Test that screen state remains consistent
        const screenResults = [];
        
        for (let i = 0; i < 5; i++) {
          const result = await client.getScreen();
          screenResults.push(result);
          await client.runTicks(5, 16);
        }
        
        // All screen requests should succeed or fail consistently
        const errors = screenResults.filter(r => r.Error);
        const successes = screenResults.filter(r => !r.Error);
        
        // Either all should work or all should fail in the same way
        if (successes.length > 0) {
          TestRunner.expect.equal(errors.length, 0, 'Screen requests should consistently succeed');
          
          // Check screen data consistency
          const screenData = successes.map(r => {
            if (typeof r.Output === 'object') {
              return r.Output as any;
            }
            return null;
          }).filter(Boolean);
          
          if (screenData.length > 0) {
            const firstScreen = screenData[0];
            screenData.forEach((screen, index) => {
              TestRunner.expect.equal(
                screen.width, 
                firstScreen.width, 
                `Screen ${index} width should be consistent`
              );
              TestRunner.expect.equal(
                screen.height, 
                firstScreen.height, 
                `Screen ${index} height should be consistent`
              );
            });
          }
        }
        
        logger.info('Screen state consistency verified', {
          totalRequests: screenResults.length,
          successes: successes.length,
          errors: errors.length
        });
      })
    },

    {
      name: 'Menu State Integration',
      fn: TestRunner.createAsyncTest(async () => {
        // Test game state during menu operations
        const initialTicks = await client.runTicks(5, 16);
        
        // Open menu
        await client.openMenu();
        await client.runTicks(3, 16);
        
        // Try save/load from menu context
        await client.saveGame(2, 'Menu Context Save');
        await client.runTicks(2, 16);
        
        await client.loadGame(2);
        await client.runTicks(2, 16);
        
        // Close menu
        await client.keyTap(DOOM_KEYS.MENU);
        await client.runTicks(3, 16);
        
        // Verify normal gameplay resumes
        const postMenuTicks = await client.runTicks(5, 16);
        const allTicks = [...initialTicks, ...postMenuTicks];
        const failedTicks = allTicks.filter(r => r.Error);
        
        TestRunner.expect.equal(failedTicks.length, 0, 'Game state should handle menu integration properly');
        
        logger.info('Menu state integration verified');
      })
    },

    {
      name: 'Long Running Game Stability',
      fn: TestRunner.createAsyncTest(async () => {
        const startMemory = client.getMemorySize();
        const startMessageCount = client.getState().messageCount;
        
        // Run game for extended period with various activities
        for (let cycle = 0; cycle < 5; cycle++) {
          // Some movement
          await client.keyPress(DOOM_KEYS.FORWARD);
          await client.runTicks(20, 16);
          await client.keyRelease(DOOM_KEYS.FORWARD);
          
          // Some turning
          await client.keyPress(DOOM_KEYS.TURN_RIGHT);
          await client.runTicks(10, 16);
          await client.keyRelease(DOOM_KEYS.TURN_RIGHT);
          
          // Menu operations
          await client.openMenu();
          await client.runTicks(5, 16);
          await client.keyTap(DOOM_KEYS.MENU);
          await client.runTicks(5, 16);
          
          // Action
          await client.keyTap(DOOM_KEYS.FIRE);
          await client.runTicks(5, 16);
        }
        
        const endMemory = client.getMemorySize();
        const endMessageCount = client.getState().messageCount;
        
        // Verify stability
        const memoryGrowth = endMemory - startMemory;
        const maxAcceptableGrowth = 5 * 1024 * 1024; // 5MB growth limit
        
        TestRunner.expect.truthy(
          memoryGrowth <= maxAcceptableGrowth,
          `Memory growth should be limited (grew by ${memoryGrowth} bytes)`
        );
        
        TestRunner.expect.truthy(
          endMessageCount > startMessageCount,
          'Message counter should have incremented'
        );
        
        logger.info('Long running stability verified', {
          cycles: 5,
          memoryGrowth,
          messagesSent: endMessageCount - startMessageCount
        });
      }),
      options: { slow: true, timeout: 60000 }
    },

    {
      name: 'State Cleanup and Reset',
      fn: TestRunner.createAsyncTest(async () => {
        // Test that client can be properly cleaned up and reinitialized
        const initialState = client.getState();
        
        // Perform some operations
        await client.runTicks(10, 16);
        await client.keyTap(DOOM_KEYS.FORWARD);
        await client.runTicks(5, 16);
        
        const beforeCleanupState = client.getState();
        TestRunner.expect.truthy(beforeCleanupState.messageCount > initialState.messageCount);
        
        // Cleanup should work without errors
        await client.cleanup();
        
        const afterCleanupState = client.getState();
        TestRunner.expect.equal(afterCleanupState.messageCount, 0, 'Message count should reset after cleanup');
        TestRunner.expect.equal(afterCleanupState.initialized, false, 'Initialized flag should reset');
        TestRunner.expect.equal(afterCleanupState.wadLoaded, false, 'WAD loaded flag should reset');
        TestRunner.expect.equal(afterCleanupState.gameInitialized, false, 'Game initialized flag should reset');
        
        logger.info('State cleanup and reset verified');
      })
    }
  ];

  const suite = await runner.runSuite('DOOM Game State Tests', tests);
  
  // Cleanup
  await client.cleanup();
  
  if (suite.failedTests > 0) {
    throw new Error(`Game state tests failed: ${suite.failedTests}/${suite.totalTests} tests failed`);
  }
  
  logger.info('✅ All game state tests passed successfully');
}

// Allow running this test suite directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runGameStateTests()
    .then(() => {
      logger.info('🎉 Game state test suite completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('💥 Game state test suite failed', { error: error.message });
      process.exit(1);
    });
}
