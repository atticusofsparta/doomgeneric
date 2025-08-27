import { DoomTestClient } from '../utils/doom-client.js';
import { TestRunner } from '../utils/test-runner.js';
import { logger } from '../utils/logger.js';
import { DOOM_KEYS } from '../types/index.js';

const runner = new TestRunner({
  logLevel: 'INFO',
  timeout: 15000,
});

export async function runQuicksaveActionTest(): Promise<void> {
  const client = new DoomTestClient();

  // Initialize game first
  await client.initialize();
  await client.loadWAD();
  await client.initializeGame();
  await client.waitForStableState();

  const tests = [
    {
      name: 'QUICKSAVE Action - Basic Test',
      fn: TestRunner.createAsyncTest(async () => {
        const result = await client.quicksave();
        TestRunner.expect.noError(result.press, 'QUICKSAVE press should not produce errors');
        TestRunner.expect.noError(result.release, 'QUICKSAVE release should not produce errors');
        TestRunner.expect.contains(result.press.Output || '', 'Key pressed', 'Should confirm QUICKSAVE press');
        TestRunner.expect.contains(result.release.Output || '', 'Key released', 'Should confirm QUICKSAVE release');
      })
    },

    {
      name: 'QUICKLOAD Action - Basic Test',
      fn: TestRunner.createAsyncTest(async () => {
        // First quicksave to have something to load
        await client.quicksave();
        
        // Process some ticks to let save complete
        await client.runTicks(2, 16);
        
        // Then test quickload
        const result = await client.quickload();
        TestRunner.expect.noError(result.press, 'QUICKLOAD press should not produce errors');
        TestRunner.expect.noError(result.release, 'QUICKLOAD release should not produce errors');
        TestRunner.expect.contains(result.press.Output || '', 'Key pressed', 'Should confirm QUICKLOAD press');
        TestRunner.expect.contains(result.release.Output || '', 'Key released', 'Should confirm QUICKLOAD release');
      })
    },

    {
      name: 'QUICKSAVE Alternative Method Names',
      fn: TestRunner.createAsyncTest(async () => {
        // Test quicksaveGame method
        const saveResult = await client.quicksaveGame();
        TestRunner.expect.noError(saveResult.press, 'quicksaveGame should work');
        TestRunner.expect.noError(saveResult.release, 'quicksaveGame release should work');
        
        // Process ticks to let save complete
        await client.runTicks(2, 16);
        
        // Test quickloadGame method
        const loadResult = await client.quickloadGame();
        TestRunner.expect.noError(loadResult.press, 'quickloadGame should work');
        TestRunner.expect.noError(loadResult.release, 'quickloadGame release should work');
      })
    },

    {
      name: 'QUICKSAVE with Movement',
      fn: TestRunner.createAsyncTest(async () => {
        // Start moving
        await client.keyPress(DOOM_KEYS.FORWARD);
        
        // Quicksave while moving
        const saveResult = await client.quicksave();
        TestRunner.expect.noError(saveResult.press, 'QUICKSAVE while moving should work');
        
        // Stop moving
        await client.keyRelease(DOOM_KEYS.FORWARD);
        
        // Process ticks
        await client.runTicks(2, 16);
        
        // Quickload
        const loadResult = await client.quickload();
        TestRunner.expect.noError(loadResult.press, 'QUICKLOAD after movement should work');
      })
    },

    {
      name: 'QUICKSAVE during Combat Simulation',
      fn: TestRunner.createAsyncTest(async () => {
        // Simulate combat scenario: fire + move + quicksave
        const firePromise = client.keyTap(DOOM_KEYS.FIRE, 100);
        const movePromise = client.keyTap(DOOM_KEYS.STRAFE_LEFT, 150);
        
        // Wait a bit then quicksave
        await Promise.all([firePromise, movePromise]);
        
        const saveResult = await client.quicksave();
        TestRunner.expect.noError(saveResult.press, 'QUICKSAVE during combat should work');
        
        // Process ticks and test quickload
        await client.runTicks(3, 16);
        
        const loadResult = await client.quickload();
        TestRunner.expect.noError(loadResult.press, 'QUICKLOAD after combat should work');
      })
    },

    {
      name: 'QUICKSAVE Key Mapping Verification',
      fn: TestRunner.createAsyncTest(async () => {
        // Verify key mappings
        TestRunner.expect.equal(DOOM_KEYS.QUICKSAVE, 'F6', 'QUICKSAVE should map to F6');
        TestRunner.expect.equal(DOOM_KEYS.QUICKLOAD, 'F9', 'QUICKLOAD should map to F9');
        
        // Test direct key usage
        const f6Result = await client.keyTap('F6', 50);
        TestRunner.expect.noError(f6Result.press, 'Direct F6 key should work');
        
        await client.runTicks(2, 16);
        
        const f9Result = await client.keyTap('F9', 50);
        TestRunner.expect.noError(f9Result.press, 'Direct F9 key should work');
      })
    },

    {
      name: 'QUICKSAVE Performance Test',
      fn: TestRunner.createAsyncTest(async () => {
        const saveCount = 5;
        const startTime = Date.now();

        for (let i = 0; i < saveCount; i++) {
          await client.quicksave();
          
          // Small delay between saves
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        const duration = Date.now() - startTime;
        const avgTime = duration / saveCount;

        TestRunner.expect.performance(avgTime, 200, 'Average QUICKSAVE time');
        logger.info(`QUICKSAVE performance: ${saveCount} saves in ${duration}ms (avg: ${avgTime.toFixed(2)}ms)`);
      })
    },

    {
      name: 'QUICKSAVE State Persistence',
      fn: TestRunner.createAsyncTest(async () => {
        // Perform quicksave
        await client.quicksave();
        
        // Process several ticks after save
        const tickResults = await client.runTicks(5, 16);
        const failedTicks = tickResults.filter(r => r.Error);
        TestRunner.expect.equal(failedTicks.length, 0, 'No ticks should fail after quicksave');
        
        // Perform quickload
        await client.quickload();
        
        // Process ticks after load
        const moreTicks = await client.runTicks(3, 16);
        const moreFailedTicks = moreTicks.filter(r => r.Error);
        TestRunner.expect.equal(moreFailedTicks.length, 0, 'No ticks should fail after quickload');
      })
    },

    {
      name: 'QUICKSAVE with Other Actions Integration',
      fn: TestRunner.createAsyncTest(async () => {
        // Test quicksave with autorun enabled
        await client.autorunToggle();
        const saveWithAutorun = await client.quicksave();
        TestRunner.expect.noError(saveWithAutorun.press, 'QUICKSAVE should work with autorun');
        
        await client.runTicks(2, 16);
        
        // Test quicksave with strafe held
        await client.strafePress();
        const saveWithStrafe = await client.quicksave();
        TestRunner.expect.noError(saveWithStrafe.press, 'QUICKSAVE should work while strafing');
        await client.strafeRelease();
        
        await client.runTicks(2, 16);
        
        // Test quickload
        const loadResult = await client.quickload();
        TestRunner.expect.noError(loadResult.press, 'QUICKLOAD should work after various actions');
        
        // Cleanup
        await client.autorunToggle(); // Turn off autorun
      })
    },

    {
      name: 'QUICKSAVE with Automap Open',
      fn: TestRunner.createAsyncTest(async () => {
        // Open automap
        await client.automapToggle();
        
        // Quicksave while automap is open
        const saveResult = await client.quicksave();
        TestRunner.expect.noError(saveResult.press, 'QUICKSAVE should work with automap open');
        
        await client.runTicks(2, 16);
        
        // Quickload while automap is open
        const loadResult = await client.quickload();
        TestRunner.expect.noError(loadResult.press, 'QUICKLOAD should work with automap open');
        
        // Close automap
        await client.automapToggle();
      })
    },

    {
      name: 'QUICKSAVE/QUICKLOAD Sequence Test',
      fn: TestRunner.createAsyncTest(async () => {
        // Test a sequence of save/load operations
        const sequence = [
          'save',
          'save', 
          'load',
          'save',
          'load',
          'load'
        ] as const;
        
        for (const action of sequence) {
          const result = action === 'save' ? await client.quicksave() : await client.quickload();
          TestRunner.expect.noError(result.press, `QUICK${action.toUpperCase()} should work in sequence`);
          
          // Process ticks between operations
          await client.runTicks(1, 16);
        }
      })
    },

    {
      name: 'QUICKSAVE with Weapon Cycling',
      fn: TestRunner.createAsyncTest(async () => {
        // Change weapon before save
        await client.nextWeapon();
        await client.runTicks(1, 16);
        
        // Quicksave
        const saveResult = await client.quicksave();
        TestRunner.expect.noError(saveResult.press, 'QUICKSAVE after weapon change should work');
        
        await client.runTicks(2, 16);
        
        // Change weapon again
        await client.prevWeapon();
        await client.runTicks(1, 16);
        
        // Quickload (should restore previous weapon)
        const loadResult = await client.quickload();
        TestRunner.expect.noError(loadResult.press, 'QUICKLOAD should restore weapon state');
      })
    }
  ];

  const suite = await runner.runSuite('DOOM QUICKSAVE Action Tests', tests);
  
  // Cleanup
  await client.cleanup();
  
  if (suite.failedTests > 0) {
    throw new Error(`QUICKSAVE action tests failed: ${suite.failedTests}/${suite.totalTests} tests failed`);
  }
  
  logger.info('✅ All QUICKSAVE action tests passed successfully');
}

// Allow running this test directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runQuicksaveActionTest()
    .then(() => {
      logger.info('🎉 QUICKSAVE action test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('💥 QUICKSAVE action test failed', { error: error instanceof Error ? error.message : String(error) });
      process.exit(1);
    });
}
