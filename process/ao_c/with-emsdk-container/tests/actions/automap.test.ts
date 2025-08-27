import { DoomTestClient } from '../utils/doom-client.js';
import { TestRunner } from '../utils/test-runner.js';
import { logger } from '../utils/logger.js';
import { DOOM_KEYS } from '../types/index.js';

const runner = new TestRunner({
  logLevel: 'INFO',
  timeout: 15000,
});

export async function runAutomapActionTest(): Promise<void> {
  const client = new DoomTestClient();

  // Initialize game first
  await client.initialize();
  await client.loadWAD();
  await client.initializeGame();
  await client.waitForStableState();

  const tests = [
    {
      name: 'AUTOMAP Action - Basic Toggle',
      fn: TestRunner.createAsyncTest(async () => {
        const result = await client.automapToggle();
        TestRunner.expect.noError(result.press, 'AUTOMAP toggle press should not produce errors');
        TestRunner.expect.noError(result.release, 'AUTOMAP toggle release should not produce errors');
        TestRunner.expect.contains(result.press.Output || '', 'Key pressed', 'Should confirm AUTOMAP toggle press');
        TestRunner.expect.contains(result.release.Output || '', 'Key released', 'Should confirm AUTOMAP toggle release');
      })
    },

    {
      name: 'AUTOMAP Action - Show/Hide Methods',
      fn: TestRunner.createAsyncTest(async () => {
        // Test showAutomap method
        const showResult = await client.showAutomap();
        TestRunner.expect.noError(showResult.press, 'Show automap should not produce errors');
        TestRunner.expect.noError(showResult.release, 'Show automap release should not produce errors');

        // Process some ticks to let automap state settle
        await client.runTicks(2, 16);

        // Test hideAutomap method
        const hideResult = await client.hideAutomap();
        TestRunner.expect.noError(hideResult.press, 'Hide automap should not produce errors');
        TestRunner.expect.noError(hideResult.release, 'Hide automap release should not produce errors');
      })
    },

    {
      name: 'AUTOMAP Multiple Toggles',
      fn: TestRunner.createAsyncTest(async () => {
        // Test multiple toggle cycles
        for (let i = 0; i < 4; i++) {
          const result = await client.automapToggle();
          TestRunner.expect.noError(result.press, `AUTOMAP toggle ${i + 1} press should work`);
          TestRunner.expect.noError(result.release, `AUTOMAP toggle ${i + 1} release should work`);
          
          // Small delay between toggles
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      })
    },

    {
      name: 'AUTOMAP with Movement Test',
      fn: TestRunner.createAsyncTest(async () => {
        // Open automap
        await client.automapToggle();
        
        // Test movement while automap is open
        const forwardResult = await client.keyTap(DOOM_KEYS.FORWARD, 100);
        TestRunner.expect.noError(forwardResult.press, 'Movement with automap open should work');
        
        // Test turning while automap is open
        const turnResult = await client.keyTap(DOOM_KEYS.TURN_LEFT, 100);
        TestRunner.expect.noError(turnResult.press, 'Turning with automap open should work');
        
        // Close automap
        await client.automapToggle();
        
        // Test normal movement after closing automap
        const normalMovement = await client.keyTap(DOOM_KEYS.BACKWARD, 100);
        TestRunner.expect.noError(normalMovement.press, 'Movement after closing automap should work');
      })
    },

    {
      name: 'AUTOMAP with Combat Actions',
      fn: TestRunner.createAsyncTest(async () => {
        // Open automap
        await client.automapToggle();
        
        // Test firing while automap is open
        const fireResult = await client.keyTap(DOOM_KEYS.FIRE, 50);
        TestRunner.expect.noError(fireResult.press, 'Firing with automap open should work');
        
        // Test weapon switching while automap is open
        const weaponResult = await client.nextWeapon();
        TestRunner.expect.noError(weaponResult.press, 'Weapon switching with automap open should work');
        
        // Close automap
        await client.automapToggle();
      })
    },

    {
      name: 'AUTOMAP Key Mapping Verification',
      fn: TestRunner.createAsyncTest(async () => {
        // Verify that the AUTOMAP constant maps to the correct key
        TestRunner.expect.equal(DOOM_KEYS.AUTOMAP, 'Tab', 'AUTOMAP should map to Tab key');
        
        // Test direct Tab key usage
        const tabResult = await client.keyTap('Tab', 50);
        TestRunner.expect.noError(tabResult.press, 'Direct Tab key should work');
        TestRunner.expect.noError(tabResult.release, 'Direct Tab key release should work');
      })
    },

    {
      name: 'AUTOMAP Performance Test',
      fn: TestRunner.createAsyncTest(async () => {
        const toggleCount = 6;
        const startTime = Date.now();

        for (let i = 0; i < toggleCount; i++) {
          await client.automapToggle();
        }

        const duration = Date.now() - startTime;
        const avgTime = duration / toggleCount;

        TestRunner.expect.performance(avgTime, 100, 'Average AUTOMAP toggle time');
        logger.info(`AUTOMAP performance: ${toggleCount} toggles in ${duration}ms (avg: ${avgTime.toFixed(2)}ms)`);
      })
    },

    {
      name: 'AUTOMAP State Persistence',
      fn: TestRunner.createAsyncTest(async () => {
        // Test that automap state persists through game ticks
        await client.automapToggle();
        
        // Process several ticks while automap is open
        const tickResults = await client.runTicks(5, 16);
        const failedTicks = tickResults.filter(r => r.Error);
        TestRunner.expect.equal(failedTicks.length, 0, 'No ticks should fail while automap is open');
        
        await client.automapToggle();
        
        // Process more ticks after closing automap
        const moreTicks = await client.runTicks(3, 16);
        const moreFailedTicks = moreTicks.filter(r => r.Error);
        TestRunner.expect.equal(moreFailedTicks.length, 0, 'No ticks should fail after closing automap');
      })
    },

    {
      name: 'AUTOMAP with Other Actions Integration',
      fn: TestRunner.createAsyncTest(async () => {
        // Test automap with strafe
        await client.strafePress();
        const automapWithStrafe = await client.automapToggle();
        TestRunner.expect.noError(automapWithStrafe.press, 'AUTOMAP should work while strafing');
        await client.strafeRelease();
        
        // Test automap with autorun
        await client.autorunToggle();
        const automapWithAutorun = await client.automapToggle();
        TestRunner.expect.noError(automapWithAutorun.press, 'AUTOMAP should work with autorun enabled');
        await client.autorunToggle(); // Turn off autorun
        
        // Close automap
        await client.automapToggle();
      })
    },

    {
      name: 'AUTOMAP Rapid Toggle Test',
      fn: TestRunner.createAsyncTest(async () => {
        // Test rapid toggling (stress test)
        const rapidCount = 8;
        
        for (let i = 0; i < rapidCount; i++) {
          const result = await client.automapToggle();
          TestRunner.expect.noError(result.press, `Rapid automap toggle ${i + 1} should work`);
          
          // Very short delay for rapid testing
          await new Promise(resolve => setTimeout(resolve, 25));
        }
      })
    },

    {
      name: 'AUTOMAP with Menu Integration',
      fn: TestRunner.createAsyncTest(async () => {
        // Test automap interaction with menu system
        await client.automapToggle();
        
        // Try to open menu while automap is open
        const menuResult = await client.openMenu();
        TestRunner.expect.noError(menuResult.press, 'Menu should open while automap is displayed');
        
        // Close menu
        const closeMenuResult = await client.keyTap(DOOM_KEYS.MENU, 50);
        TestRunner.expect.noError(closeMenuResult.press, 'Menu should close');
        
        // Close automap
        await client.automapToggle();
      })
    }
  ];

  const suite = await runner.runSuite('DOOM AUTOMAP Action Tests', tests);
  
  // Cleanup
  await client.cleanup();
  
  if (suite.failedTests > 0) {
    throw new Error(`AUTOMAP action tests failed: ${suite.failedTests}/${suite.totalTests} tests failed`);
  }
  
  logger.info('✅ All AUTOMAP action tests passed successfully');
}

// Allow running this test directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAutomapActionTest()
    .then(() => {
      logger.info('🎉 AUTOMAP action test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('💥 AUTOMAP action test failed', { error: error instanceof Error ? error.message : String(error) });
      process.exit(1);
    });
}
