import { DoomTestClient } from '../utils/doom-client.js';
import { TestRunner } from '../utils/test-runner.js';
import { logger } from '../utils/logger.js';
import { DOOM_KEYS } from '../types/index.js';

const runner = new TestRunner({
  logLevel: 'INFO',
  timeout: 25000,
});

export async function runMenuTests(): Promise<void> {
  const client = new DoomTestClient();

  // Initialize game first
  await client.initialize();
  await client.loadWAD();
  await client.initializeGame();
  await client.waitForStableState();

  const tests = [
    {
      name: 'Open Main Menu',
      fn: TestRunner.createAsyncTest(async () => {
        const result = await client.openMenu();
        TestRunner.expect.noError(result.press, 'Opening menu should not produce errors');
        TestRunner.expect.noError(result.release, 'Menu key release should not produce errors');
        
        // Process a few ticks to let menu state settle
        await client.runTicks(3, 16);
        
        logger.info('Main menu opened successfully');
      })
    },

    {
      name: 'Close Menu (ESC)',
      fn: TestRunner.createAsyncTest(async () => {
        // Open menu first
        await client.openMenu();
        await client.runTicks(2, 16);
        
        // Close menu with ESC
        const result = await client.keyTap(DOOM_KEYS.MENU);
        TestRunner.expect.noError(result.press, 'Closing menu should not produce errors');
        TestRunner.expect.noError(result.release, 'Menu close key release should not produce errors');
        
        await client.runTicks(2, 16);
        
        logger.info('Menu closed successfully');
      })
    },

    {
      name: 'Menu Navigation - Up/Down',
      fn: TestRunner.createAsyncTest(async () => {
        // Open menu
        await client.openMenu();
        await client.runTicks(2, 16);
        
        // Navigate up/down
        await client.menuNavigate('down');
        await client.runTicks(2, 16);
        
        await client.menuNavigate('down');
        await client.runTicks(2, 16);
        
        await client.menuNavigate('up');
        await client.runTicks(2, 16);
        
        // Close menu
        await client.keyTap(DOOM_KEYS.MENU);
        await client.runTicks(2, 16);
        
        logger.info('Menu navigation completed successfully');
      })
    },

    {
      name: 'Menu Selection with Enter',
      fn: TestRunner.createAsyncTest(async () => {
        // Open menu
        await client.openMenu();
        await client.runTicks(2, 16);
        
        // Try to select an option (might start new game or enter submenu)
        const selectResult = await client.menuSelect();
        TestRunner.expect.noError(selectResult.press, 'Menu selection should not produce errors');
        TestRunner.expect.noError(selectResult.release, 'Menu selection release should not produce errors');
        
        // Process ticks to handle selection
        await client.runTicks(5, 16);
        
        // Press ESC a few times to get back to game state
        for (let i = 0; i < 3; i++) {
          await client.keyTap(DOOM_KEYS.MENU);
          await client.runTicks(2, 16);
        }
        
        logger.info('Menu selection test completed');
      })
    },

    {
      name: 'Multiple Menu Open/Close Cycles',
      fn: TestRunner.createAsyncTest(async () => {
        for (let i = 0; i < 5; i++) {
          // Open menu
          await client.openMenu();
          await client.runTicks(2, 16);
          
          // Close menu
          await client.keyTap(DOOM_KEYS.MENU);
          await client.runTicks(2, 16);
        }
        
        logger.info('Multiple menu cycles completed successfully');
      })
    },

    {
      name: 'Menu During Gameplay',
      fn: TestRunner.createAsyncTest(async () => {
        // Start some movement
        await client.keyPress(DOOM_KEYS.FORWARD);
        await client.runTicks(5, 16);
        
        // Open menu while moving
        await client.openMenu();
        await client.runTicks(3, 16);
        
        // Close menu
        await client.keyTap(DOOM_KEYS.MENU);
        await client.runTicks(3, 16);
        
        // Stop movement
        await client.keyRelease(DOOM_KEYS.FORWARD);
        await client.runTicks(2, 16);
        
        logger.info('Menu during gameplay test completed');
      })
    },

    {
      name: 'Menu Navigation Stress Test',
      fn: TestRunner.createAsyncTest(async () => {
        // Open menu
        await client.openMenu();
        await client.runTicks(2, 16);
        
        // Rapid navigation
        for (let i = 0; i < 10; i++) {
          const direction = i % 2 === 0 ? 'down' : 'up';
          await client.menuNavigate(direction);
          await client.runTicks(1, 16);
        }
        
        // Close menu
        await client.keyTap(DOOM_KEYS.MENU);
        await client.runTicks(2, 16);
        
        logger.info('Menu navigation stress test completed');
      })
    },

    {
      name: 'Menu Input Response Time',
      fn: TestRunner.createAsyncTest(async () => {
        const inputTimes: number[] = [];
        
        for (let i = 0; i < 5; i++) {
          const startTime = Date.now();
          
          // Open menu
          await client.openMenu();
          await client.runTicks(2, 16);
          
          // Close menu
          await client.keyTap(DOOM_KEYS.MENU);
          await client.runTicks(2, 16);
          
          const duration = Date.now() - startTime;
          inputTimes.push(duration);
        }
        
        const avgResponseTime = inputTimes.reduce((a, b) => a + b, 0) / inputTimes.length;
        
        // Menu operations should be reasonably fast
        TestRunner.expect.performance(avgResponseTime, 2000, 'Menu operation response time');
        
        logger.info(`Menu response time: avg ${avgResponseTime.toFixed(2)}ms`, { inputTimes });
      }),
      options: { slow: true }
    },

    {
      name: 'Menu State Consistency',
      fn: TestRunner.createAsyncTest(async () => {
        // Test that menu state is consistent
        
        // Open menu and navigate
        await client.openMenu();
        await client.runTicks(2, 16);
        
        await client.menuNavigate('down');
        await client.runTicks(1, 16);
        
        await client.menuNavigate('down');
        await client.runTicks(1, 16);
        
        // Process multiple ticks while in menu
        const menuTickResults = await client.runTicks(10, 16);
        
        // All menu ticks should succeed
        const failedTicks = menuTickResults.filter(r => r.Error);
        TestRunner.expect.equal(failedTicks.length, 0, 'Menu ticks should not produce errors');
        
        // Close menu
        await client.keyTap(DOOM_KEYS.MENU);
        await client.runTicks(2, 16);
        
        logger.info('Menu state consistency verified');
      })
    },

    {
      name: 'Escape Sequence Test',
      fn: TestRunner.createAsyncTest(async () => {
        // Test multiple escape presses to ensure proper state handling
        
        // Start with a few ESC presses from normal game state
        for (let i = 0; i < 3; i++) {
          await client.keyTap(DOOM_KEYS.MENU);
          await client.runTicks(2, 16);
        }
        
        // Should end up back in normal game state
        const finalTicks = await client.runTicks(5, 16);
        const failedTicks = finalTicks.filter(r => r.Error);
        TestRunner.expect.equal(failedTicks.length, 0, 'Final game state should be stable');
        
        logger.info('Escape sequence test completed');
      })
    },

    {
      name: 'Menu with Game Actions',
      fn: TestRunner.createAsyncTest(async () => {
        // Test that menu properly handles other game actions
        
        // Open menu
        await client.openMenu();
        await client.runTicks(2, 16);
        
        // Try some game actions while in menu (should be ignored or handled gracefully)
        await client.keyTap(DOOM_KEYS.FIRE);
        await client.runTicks(1, 16);
        
        await client.keyTap(DOOM_KEYS.USE);
        await client.runTicks(1, 16);
        
        await client.keyTap(DOOM_KEYS.WEAPON_1);
        await client.runTicks(1, 16);
        
        // Navigate menu to ensure it's still responsive
        await client.menuNavigate('down');
        await client.runTicks(1, 16);
        
        // Close menu
        await client.keyTap(DOOM_KEYS.MENU);
        await client.runTicks(2, 16);
        
        logger.info('Menu with game actions test completed');
      })
    },

    {
      name: 'Menu Performance Impact',
      fn: TestRunner.createAsyncTest(async () => {
        // Test performance during menu operations
        
        // Baseline performance (normal gameplay)
        const baselinePerf = await client.performanceTest(10);
        
        // Open menu
        await client.openMenu();
        await client.runTicks(2, 16);
        
        // Performance during menu
        const menuPerf = await client.performanceTest(10);
        
        // Close menu
        await client.keyTap(DOOM_KEYS.MENU);
        await client.runTicks(2, 16);
        
        // Menu operations shouldn't significantly impact performance
        const perfDifference = menuPerf.avgDuration - baselinePerf.avgDuration;
        TestRunner.expect.performance(
          Math.abs(perfDifference), 
          200, 
          'Menu performance impact'
        );
        
        logger.info('Menu performance impact test completed', {
          baseline: baselinePerf.avgDuration,
          menu: menuPerf.avgDuration,
          difference: perfDifference
        });
      }),
      options: { slow: true }
    }
  ];

  const suite = await runner.runSuite('DOOM Menu Tests', tests);
  
  // Cleanup
  await client.cleanup();
  
  if (suite.failedTests > 0) {
    throw new Error(`Menu tests failed: ${suite.failedTests}/${suite.totalTests} tests failed`);
  }
  
  logger.info('✅ All menu tests passed successfully');
}

// Allow running this test suite directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMenuTests()
    .then(() => {
      logger.info('🎉 Menu test suite completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('💥 Menu test suite failed', { error: error.message });
      process.exit(1);
    });
}
