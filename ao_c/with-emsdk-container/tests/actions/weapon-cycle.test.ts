import { DoomTestClient } from '../utils/doom-client.js';
import { TestRunner } from '../utils/test-runner.js';
import { logger } from '../utils/logger.js';
import { DOOM_KEYS } from '../types/index.js';

const runner = new TestRunner({
  logLevel: 'INFO',
  timeout: 15000,
});

export async function runWeaponCycleActionTest(): Promise<void> {
  const client = new DoomTestClient();

  // Initialize game first
  await client.initialize();
  await client.loadWAD();
  await client.initializeGame();
  await client.waitForStableState();

  const tests = [
    {
      name: 'NEXT WEAPON Action - Basic Test',
      fn: TestRunner.createAsyncTest(async () => {
        const result = await client.nextWeapon();
        TestRunner.expect.noError(result.press, 'NEXT WEAPON press should not produce errors');
        TestRunner.expect.noError(result.release, 'NEXT WEAPON release should not produce errors');
        TestRunner.expect.contains(result.press.Output || '', 'Key pressed', 'Should confirm NEXT WEAPON press');
        TestRunner.expect.contains(result.release.Output || '', 'Key released', 'Should confirm NEXT WEAPON release');
      })
    },

    {
      name: 'PREVIOUS WEAPON Action - Basic Test',
      fn: TestRunner.createAsyncTest(async () => {
        const result = await client.prevWeapon();
        TestRunner.expect.noError(result.press, 'PREV WEAPON press should not produce errors');
        TestRunner.expect.noError(result.release, 'PREV WEAPON release should not produce errors');
        TestRunner.expect.contains(result.press.Output || '', 'Key pressed', 'Should confirm PREV WEAPON press');
        TestRunner.expect.contains(result.release.Output || '', 'Key released', 'Should confirm PREV WEAPON release');
      })
    },

    {
      name: 'Weapon Cycle Forward/Backward',
      fn: TestRunner.createAsyncTest(async () => {
        // Cycle forward
        const nextResult = await client.cycleWeapon('next');
        TestRunner.expect.noError(nextResult.press, 'Cycle weapon next should work');
        
        // Process some ticks to let weapon change settle
        await client.runTicks(2, 16);
        
        // Cycle backward
        const prevResult = await client.cycleWeapon('prev');
        TestRunner.expect.noError(prevResult.press, 'Cycle weapon prev should work');
      })
    },

    {
      name: 'Rapid Weapon Cycling',
      fn: TestRunner.createAsyncTest(async () => {
        const cycleCount = 5;
        
        // Rapid next weapon cycling
        for (let i = 0; i < cycleCount; i++) {
          const result = await client.nextWeapon();
          TestRunner.expect.noError(result.press, `Rapid next weapon ${i + 1} should work`);
          
          // Small delay between cycles
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        // Rapid previous weapon cycling
        for (let i = 0; i < cycleCount; i++) {
          const result = await client.prevWeapon();
          TestRunner.expect.noError(result.press, `Rapid prev weapon ${i + 1} should work`);
          
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      })
    },

    {
      name: 'Weapon Cycling with Direct Selection',
      fn: TestRunner.createAsyncTest(async () => {
        // Start with direct weapon selection
        const weapon1Result = await client.keyTap(DOOM_KEYS.WEAPON_1, 50);
        TestRunner.expect.noError(weapon1Result.press, 'Direct weapon 1 selection should work');
        
        // Process tick to let weapon switch
        await client.runTicks(1, 16);
        
        // Then use cycling
        const nextResult = await client.nextWeapon();
        TestRunner.expect.noError(nextResult.press, 'Next weapon after direct selection should work');
        
        // Another cycle
        const prevResult = await client.prevWeapon();
        TestRunner.expect.noError(prevResult.press, 'Prev weapon after cycling should work');
      })
    },

    {
      name: 'Weapon Cycling Key Mapping Verification',
      fn: TestRunner.createAsyncTest(async () => {
        // Verify key mappings
        TestRunner.expect.equal(DOOM_KEYS.NEXT_WEAPON, 'PageUp', 'NEXT_WEAPON should map to PageUp');
        TestRunner.expect.equal(DOOM_KEYS.PREV_WEAPON, 'PageDown', 'PREV_WEAPON should map to PageDown');
        
        // Test direct key usage
        const pageUpResult = await client.keyTap('PageUp', 50);
        TestRunner.expect.noError(pageUpResult.press, 'Direct PageUp key should work');
        
        const pageDownResult = await client.keyTap('PageDown', 50);
        TestRunner.expect.noError(pageDownResult.press, 'Direct PageDown key should work');
      })
    },

    {
      name: 'Weapon Cycling Performance Test',
      fn: TestRunner.createAsyncTest(async () => {
        const cycleCount = 8;
        const startTime = Date.now();

        for (let i = 0; i < cycleCount; i++) {
          if (i % 2 === 0) {
            await client.nextWeapon();
          } else {
            await client.prevWeapon();
          }
        }

        const duration = Date.now() - startTime;
        const avgTime = duration / cycleCount;

        TestRunner.expect.performance(avgTime, 100, 'Average weapon cycle time');
        logger.info(`Weapon cycle performance: ${cycleCount} cycles in ${duration}ms (avg: ${avgTime.toFixed(2)}ms)`);
      })
    },

    {
      name: 'Weapon Cycling During Combat',
      fn: TestRunner.createAsyncTest(async () => {
        // Simulate combat scenario: fire, cycle, fire
        
        // Fire current weapon
        const fireResult = await client.keyTap(DOOM_KEYS.FIRE, 100);
        TestRunner.expect.noError(fireResult.press, 'Fire weapon should work');
        
        // Cycle to next weapon
        const nextResult = await client.nextWeapon();
        TestRunner.expect.noError(nextResult.press, 'Weapon cycle during combat should work');
        
        // Fire new weapon
        const fireAgainResult = await client.keyTap(DOOM_KEYS.FIRE, 100);
        TestRunner.expect.noError(fireAgainResult.press, 'Fire after weapon cycle should work');
      })
    },

    {
      name: 'Weapon Cycling with Movement',
      fn: TestRunner.createAsyncTest(async () => {
        // Test cycling while moving
        await client.keyPress(DOOM_KEYS.FORWARD);
        
        const cycleResult = await client.nextWeapon();
        TestRunner.expect.noError(cycleResult.press, 'Weapon cycling while moving should work');
        
        await client.keyRelease(DOOM_KEYS.FORWARD);
      })
    },

    {
      name: 'Weapon Cycling State Consistency',
      fn: TestRunner.createAsyncTest(async () => {
        // Perform a sequence of weapon changes and verify no errors
        const sequence = ['next', 'next', 'prev', 'next', 'prev', 'prev'] as const;
        
        for (const direction of sequence) {
          const result = await client.cycleWeapon(direction);
          TestRunner.expect.noError(result.press, `Weapon cycle ${direction} should work in sequence`);
          
          // Process tick to let weapon change settle
          await client.runTicks(1, 16);
        }
      })
    }
  ];

  const suite = await runner.runSuite('DOOM Weapon Cycling Action Tests', tests);
  
  // Cleanup
  await client.cleanup();
  
  if (suite.failedTests > 0) {
    throw new Error(`Weapon cycling action tests failed: ${suite.failedTests}/${suite.totalTests} tests failed`);
  }
  
  logger.info('✅ All weapon cycling action tests passed successfully');
}

// Allow running this test directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runWeaponCycleActionTest()
    .then(() => {
      logger.info('🎉 Weapon cycling action test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('💥 Weapon cycling action test failed', { error: error instanceof Error ? error.message : String(error) });
      process.exit(1);
    });
}
