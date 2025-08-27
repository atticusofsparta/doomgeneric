import { DoomTestClient } from '../utils/doom-client.js';
import { TestRunner } from '../utils/test-runner.js';
import { logger } from '../utils/logger.js';
import { DOOM_KEYS } from '../types/index.js';

const runner = new TestRunner({
  logLevel: 'INFO',
  timeout: 60000, // Integration tests can be longer
});

export async function runIntegrationTests(): Promise<void> {
  const client = new DoomTestClient();

  const tests = [
    {
      name: 'Complete Game Initialization Flow',
      fn: TestRunner.createAsyncTest(async () => {
        // Test the complete initialization sequence
        await client.initialize();
        const initState = client.getState();
        TestRunner.expect.truthy(initState.initialized, 'Client should be initialized');
        
        await client.loadWAD();
        const wadState = client.getState();
        TestRunner.expect.truthy(wadState.wadLoaded, 'WAD should be loaded');
        
        await client.initializeGame();
        const gameState = client.getState();
        TestRunner.expect.truthy(gameState.gameInitialized, 'Game should be initialized');
        
        await client.waitForStableState();
        
        // Verify everything is working
        const tickResult = await client.tick();
        TestRunner.expect.noError(tickResult, 'Game tick should work after full initialization');
        
        logger.info('Complete initialization flow verified');
      }),
      options: { timeout: 90000 }
    },

    {
      name: 'Full Gameplay Session',
      fn: TestRunner.createAsyncTest(async () => {
        // Simulate a complete gameplay session
        
        // Start moving around
        await client.keyPress(DOOM_KEYS.FORWARD);
        await client.runTicks(20, 16);
        
        // Turn and strafe
        await client.keyPress(DOOM_KEYS.TURN_LEFT);
        await client.runTicks(10, 16);
        await client.keyRelease(DOOM_KEYS.TURN_LEFT);
        
        await client.keyPress(DOOM_KEYS.STRAFE_RIGHT);
        await client.runTicks(15, 16);
        await client.keyRelease(DOOM_KEYS.STRAFE_RIGHT);
        
        // Stop moving
        await client.keyRelease(DOOM_KEYS.FORWARD);
        
        // Try some actions
        await client.keyTap(DOOM_KEYS.FIRE, 100);
        await client.runTicks(5, 16);
        
        await client.keyTap(DOOM_KEYS.USE, 50);
        await client.runTicks(3, 16);
        
        // Access menu
        await client.openMenu();
        await client.runTicks(5, 16);
        await client.menuNavigate('down');
        await client.runTicks(2, 16);
        await client.keyTap(DOOM_KEYS.MENU); // Close menu
        await client.runTicks(3, 16);
        
        // More movement
        await client.keyPress(DOOM_KEYS.BACKWARD);
        await client.runTicks(10, 16);
        await client.keyRelease(DOOM_KEYS.BACKWARD);
        
        // Try weapon switching
        await client.keyTap(DOOM_KEYS.WEAPON_2);
        await client.runTicks(3, 16);
        await client.keyTap(DOOM_KEYS.WEAPON_1);
        await client.runTicks(3, 16);
        
        // Final verification
        const finalTicks = await client.runTicks(10, 16);
        const failedTicks = finalTicks.filter(r => r.Error);
        TestRunner.expect.equal(failedTicks.length, 0, 'Full gameplay session should complete without errors');
        
        logger.info('Full gameplay session completed successfully');
      }),
      options: { slow: true, timeout: 120000 }
    },

    {
      name: 'Stress Test - Rapid Input Combinations',
      fn: TestRunner.createAsyncTest(async () => {
        // Test rapid input combinations to stress the system
        const inputCombinations = [
          [DOOM_KEYS.FORWARD, DOOM_KEYS.RUN],
          [DOOM_KEYS.STRAFE_LEFT, DOOM_KEYS.FIRE],
          [DOOM_KEYS.TURN_RIGHT, DOOM_KEYS.USE],
          [DOOM_KEYS.BACKWARD, DOOM_KEYS.STRAFE_RIGHT],
          [DOOM_KEYS.FORWARD, DOOM_KEYS.TURN_LEFT, DOOM_KEYS.RUN]
        ];
        
        for (const combo of inputCombinations) {
          // Press all keys in combination
          for (const key of combo) {
            await client.keyPress(key);
          }
          
          // Run with combination
          await client.runTicks(8, 16);
          
          // Release all keys
          for (const key of combo) {
            await client.keyRelease(key);
          }
          
          // Brief pause
          await client.runTicks(2, 16);
        }
        
        logger.info('Rapid input combinations stress test completed');
      }),
      options: { slow: true }
    },

    {
      name: 'Memory Stability Over Extended Use',
      fn: TestRunner.createAsyncTest(async () => {
        const initialMemory = client.getMemorySize();
        const memoryCheckpoints = [];
        
        // Extended use simulation
        for (let phase = 0; phase < 10; phase++) {
          // Movement phase
          await client.keyPress(DOOM_KEYS.FORWARD);
          await client.runTicks(30, 16);
          await client.keyRelease(DOOM_KEYS.FORWARD);
          
          // Action phase
          for (let i = 0; i < 5; i++) {
            await client.keyTap(DOOM_KEYS.FIRE, 50);
            await client.runTicks(3, 16);
          }
          
          // Menu phase
          await client.openMenu();
          await client.runTicks(5, 16);
          await client.keyTap(DOOM_KEYS.MENU);
          await client.runTicks(5, 16);
          
          // Record memory usage
          const currentMemory = client.getMemorySize();
          memoryCheckpoints.push({
            phase,
            memory: currentMemory,
            growth: currentMemory - initialMemory
          });
        }
        
        const finalMemory = client.getMemorySize();
        const totalGrowth = finalMemory - initialMemory;
        const maxAcceptableGrowth = 10 * 1024 * 1024; // 10MB
        
        TestRunner.expect.truthy(
          totalGrowth <= maxAcceptableGrowth,
          `Memory growth should be limited over extended use (grew by ${totalGrowth} bytes)`
        );
        
        logger.info('Memory stability verified over extended use', {
          initialMemory,
          finalMemory,
          totalGrowth,
          phases: memoryCheckpoints.length
        });
      }),
      options: { slow: true, timeout: 180000 }
    },

    {
      name: 'Error Recovery and Resilience',
      fn: TestRunner.createAsyncTest(async () => {
        // Test system resilience by introducing various error conditions
        
        // Try invalid save/load operations
        await client.saveGame(-1);
        await client.runTicks(3, 16);
        
        await client.loadGame(999);
        await client.runTicks(3, 16);
        
        // Rapid menu operations
        for (let i = 0; i < 10; i++) {
          await client.keyTap(DOOM_KEYS.MENU, 10);
        }
        await client.runTicks(5, 16);
        
        // Conflicting input patterns
        await client.keyPress(DOOM_KEYS.FORWARD);
        await client.keyPress(DOOM_KEYS.BACKWARD);
        await client.runTicks(10, 16);
        await client.keyRelease(DOOM_KEYS.FORWARD);
        await client.keyRelease(DOOM_KEYS.BACKWARD);
        
        // Multiple screen requests
        const screenPromises = [];
        for (let i = 0; i < 5; i++) {
          screenPromises.push(client.getScreen());
        }
        await Promise.all(screenPromises);
        
        // Verify system is still stable
        const stabilityTest = await client.runTicks(20, 16);
        const failedTicks = stabilityTest.filter(r => r.Error);
        TestRunner.expect.equal(failedTicks.length, 0, 'System should remain stable after error conditions');
        
        logger.info('Error recovery and resilience verified');
      }),
      options: { slow: true }
    },

    {
      name: 'Performance Under Load',
      fn: TestRunner.createAsyncTest(async () => {
        // Test performance under various load conditions
        const performanceResults = [];
        
        // Baseline performance
        const baselinePerf = await client.performanceTest(20);
        performanceResults.push({ condition: 'baseline', result: baselinePerf });
        
        // Performance with movement
        await client.keyPress(DOOM_KEYS.FORWARD);
        await client.keyPress(DOOM_KEYS.RUN);
        const movementPerf = await client.performanceTest(20);
        await client.keyRelease(DOOM_KEYS.RUN);
        await client.keyRelease(DOOM_KEYS.FORWARD);
        performanceResults.push({ condition: 'movement', result: movementPerf });
        
        // Performance with rapid input
        const rapidInputStart = Date.now();
        for (let i = 0; i < 20; i++) {
          await client.keyTap(DOOM_KEYS.FIRE, 10);
          await client.tick(16);
        }
        const rapidInputDuration = Date.now() - rapidInputStart;
        performanceResults.push({ 
          condition: 'rapidInput', 
          result: { avgDuration: rapidInputDuration / 20, minDuration: 0, maxDuration: 0 } 
        });
        
        // Verify performance is acceptable
        performanceResults.forEach(({ condition, result }) => {
          TestRunner.expect.performance(
            result.avgDuration, 
            1000, 
            `Performance under ${condition} condition`
          );
        });
        
        logger.info('Performance under load verified', performanceResults);
      }),
      options: { slow: true }
    },

    {
      name: 'Complete Feature Integration',
      fn: TestRunner.createAsyncTest(async () => {
        // Test that all features work together harmoniously
        
        // Initialize everything
        const state = client.getState();
        TestRunner.expect.truthy(state.initialized && state.wadLoaded && state.gameInitialized);
        
        // Test movement + screen
        await client.keyPress(DOOM_KEYS.FORWARD);
        await client.runTicks(10, 16);
        const screenDuringMovement = await client.getScreen();
        await client.keyRelease(DOOM_KEYS.FORWARD);
        
        // Test input + menu
        await client.openMenu();
        await client.menuNavigate('down');
        await client.keyTap(DOOM_KEYS.MENU);
        await client.runTicks(5, 16);
        
        // Test save/load + movement
        await client.saveGame(1, 'Integration Test');
        await client.keyPress(DOOM_KEYS.STRAFE_LEFT);
        await client.runTicks(5, 16);
        await client.keyRelease(DOOM_KEYS.STRAFE_LEFT);
        await client.loadGame(1);
        
        // Test actions + rendering
        await client.keyTap(DOOM_KEYS.FIRE);
        await client.keyTap(DOOM_KEYS.USE);
        const screenAfterActions = await client.getScreen();
        
        // Test weapon switching + movement
        await client.keyTap(DOOM_KEYS.WEAPON_2);
        await client.keyPress(DOOM_KEYS.FORWARD);
        await client.keyPress(DOOM_KEYS.TURN_RIGHT);
        await client.runTicks(15, 16);
        await client.keyRelease(DOOM_KEYS.TURN_RIGHT);
        await client.keyRelease(DOOM_KEYS.FORWARD);
        
        // Final stability check
        const finalTicks = await client.runTicks(20, 16);
        const failedTicks = finalTicks.filter(r => r.Error);
        TestRunner.expect.equal(failedTicks.length, 0, 'All features should integrate without errors');
        
        logger.info('Complete feature integration verified');
      }),
      options: { slow: true, timeout: 120000 }
    },

    {
      name: 'Client Lifecycle Management',
      fn: TestRunner.createAsyncTest(async () => {
        // Test complete lifecycle: init -> use -> cleanup -> reinit
        
        // Initial state verification
        let state = client.getState();
        TestRunner.expect.truthy(state.initialized);
        
        // Use the client
        await client.runTicks(10, 16);
        await client.keyTap(DOOM_KEYS.FORWARD);
        
        const beforeCleanupCount = client.getState().messageCount;
        
        // Cleanup
        await client.cleanup();
        
        // Verify cleanup
        state = client.getState();
        TestRunner.expect.equal(state.initialized, false);
        TestRunner.expect.equal(state.wadLoaded, false);
        TestRunner.expect.equal(state.gameInitialized, false);
        TestRunner.expect.equal(state.messageCount, 0);
        
        // Reinitialize
        await client.initialize();
        await client.loadWAD();
        await client.initializeGame();
        
        // Verify reinitialization
        state = client.getState();
        TestRunner.expect.truthy(state.initialized);
        TestRunner.expect.truthy(state.wadLoaded);
        TestRunner.expect.truthy(state.gameInitialized);
        
        // Use again after reinitialization
        await client.runTicks(5, 16);
        const afterReinitResult = await client.keyTap(DOOM_KEYS.FORWARD);
        TestRunner.expect.noError(afterReinitResult.press);
        TestRunner.expect.noError(afterReinitResult.release);
        
        logger.info('Client lifecycle management verified');
      }),
      options: { timeout: 120000 }
    },

    {
      name: 'Cross-System Interaction Test',
      fn: TestRunner.createAsyncTest(async () => {
        // Test complex interactions between all game systems
        
        // Start with movement and screen capture
        await client.keyPress(DOOM_KEYS.FORWARD);
        await client.runTicks(5, 16);
        const screen1 = await client.getScreen();
        
        // Add firing while moving
        await client.keyPress(DOOM_KEYS.FIRE);
        await client.runTicks(5, 16);
        
        // Add turning while moving and firing
        await client.keyPress(DOOM_KEYS.TURN_LEFT);
        await client.runTicks(5, 16);
        const screen2 = await client.getScreen();
        
        // Access menu while all actions are happening
        await client.keyPress(DOOM_KEYS.MENU);
        await client.runTicks(3, 16);
        await client.keyRelease(DOOM_KEYS.MENU);
        
        // Release all actions
        await client.keyRelease(DOOM_KEYS.FIRE);
        await client.keyRelease(DOOM_KEYS.TURN_LEFT);
        await client.keyRelease(DOOM_KEYS.FORWARD);
        
        // Try save/load in this state
        await client.saveGame(2, 'Cross-system test');
        await client.runTicks(3, 16);
        
        // Switch weapons
        await client.keyTap(DOOM_KEYS.WEAPON_3);
        await client.runTicks(2, 16);
        
        // Try loading
        await client.loadGame(2);
        await client.runTicks(3, 16);
        
        // Final screen capture
        const screen3 = await client.getScreen();
        
        // Verify system stability after complex interactions
        const stabilityTicks = await client.runTicks(10, 16);
        const failedTicks = stabilityTicks.filter(r => r.Error);
        TestRunner.expect.equal(failedTicks.length, 0, 'Complex system interactions should not cause errors');
        
        logger.info('Cross-system interaction test completed', {
          screenCaptures: [screen1, screen2, screen3].filter(s => !s.Error).length
        });
      }),
      options: { slow: true, timeout: 120000 }
    }
  ];

  const suite = await runner.runSuite('DOOM Integration Tests', tests);
  
  // Cleanup
  await client.cleanup();
  
  if (suite.failedTests > 0) {
    throw new Error(`Integration tests failed: ${suite.failedTests}/${suite.totalTests} tests failed`);
  }
  
  logger.info('✅ All integration tests passed successfully');
}

// Allow running this test suite directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runIntegrationTests()
    .then(() => {
      logger.info('🎉 Integration test suite completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('💥 Integration test suite failed', { error: error.message });
      process.exit(1);
    });
}
