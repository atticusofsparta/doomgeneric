import { DoomTestClient } from '../utils/doom-client.js';
import { TestRunner } from '../utils/test-runner.js';
import { logger } from '../utils/logger.js';

const runner = new TestRunner({
  logLevel: 'INFO',
  timeout: 45000, // 45 seconds for initialization tests
});

export async function runInitializationTests(): Promise<void> {
  const client = new DoomTestClient();

  const tests = [
    {
      name: 'AO Loader Initialization',
      fn: TestRunner.createAsyncTest(async () => {
        await client.initialize();
        const state = client.getState();
        TestRunner.expect.truthy(state.initialized, 'AO Loader should be initialized');
      })
    },

    {
      name: 'WAD File Loading',
      fn: TestRunner.createAsyncTest(async () => {
        const result = await client.loadWAD();
        TestRunner.expect.noError(result, 'WAD loading should not produce errors');
        TestRunner.expect.contains(result.Output || '', 'WAD loaded successfully', 'Should confirm WAD loading');
        
        const state = client.getState();
        TestRunner.expect.truthy(state.wadLoaded, 'WAD should be marked as loaded');
      }),
      options: { timeout: 60000 } // WAD loading can be slow
    },

    {
      name: 'DOOM Engine Initialization',
      fn: TestRunner.createAsyncTest(async () => {
        const result = await client.initializeGame();
        TestRunner.expect.noError(result, 'Game initialization should not produce errors');
        TestRunner.expect.contains(result.Output || '', 'Game initialized', 'Should confirm game initialization');
        
        const state = client.getState();
        TestRunner.expect.truthy(state.gameInitialized, 'Game should be marked as initialized');
      }),
      options: { timeout: 60000 } // Game init can be slow
    },

    {
      name: 'Memory Allocation Verification',
      fn: TestRunner.createAsyncTest(async () => {
        const memorySize = client.getMemorySize();
        TestRunner.expect.truthy(memorySize > 0, 'Memory should be allocated');
        
        // Should have substantial memory allocated for DOOM
        const minExpectedMemory = 50 * 1024 * 1024; // 50MB minimum
        TestRunner.expect.truthy(
          memorySize >= minExpectedMemory, 
          `Memory should be at least ${minExpectedMemory} bytes, got ${memorySize}`
        );
        
        logger.info(`Memory allocated: ${Math.round(memorySize / 1024 / 1024)} MB`);
      })
    },

    {
      name: 'Initial Game Tick Processing',
      fn: TestRunner.createAsyncTest(async () => {
        const result = await client.tick(16);
        TestRunner.expect.noError(result, 'Initial tick should not produce errors');
        TestRunner.expect.contains(result.Output || '', 'Tick processed', 'Should confirm tick processing');
      })
    },

    {
      name: 'Multiple Tick Stability',
      fn: TestRunner.createAsyncTest(async () => {
        const results = await client.runTicks(10, 16);
        TestRunner.expect.equal(results.length, 10, 'Should process all 10 ticks');
        
        // All ticks should succeed
        const failedTicks = results.filter(r => r.Error);
        TestRunner.expect.equal(failedTicks.length, 0, `All ticks should succeed, but ${failedTicks.length} failed`);
        
        // All ticks should return consistent output
        const outputs = results.map(r => r.Output);
        const uniqueOutputs = [...new Set(outputs)];
        TestRunner.expect.equal(uniqueOutputs.length, 1, 'All tick outputs should be consistent');
        TestRunner.expect.equal(uniqueOutputs[0], 'Tick processed', 'Tick output should be "Tick processed"');
      })
    },

    {
      name: 'Game State Stability Check',
      fn: TestRunner.createAsyncTest(async () => {
        const stable = await client.waitForStableState(5000);
        TestRunner.expect.truthy(stable, 'Game should reach stable state within 5 seconds');
      })
    },

    {
      name: 'Screen System Availability',
      fn: TestRunner.createAsyncTest(async () => {
        const result = await client.getScreen();
        TestRunner.expect.noError(result, 'Screen data request should not produce errors');
        
        // Should return screen data structure
        if (result.Output && typeof result.Output === 'object') {
          const screenData = result.Output as any;
          TestRunner.expect.truthy(screenData.width, 'Screen data should include width');
          TestRunner.expect.truthy(screenData.height, 'Screen data should include height');
          TestRunner.expect.truthy(screenData.screen, 'Screen data should include screen buffer');
          
          logger.info(`Screen resolution: ${screenData.width}x${screenData.height}`);
        }
      })
    },

    {
      name: 'Message Counter Verification',
      fn: TestRunner.createAsyncTest(async () => {
        const initialState = client.getState();
        const initialCount = initialState.messageCount;
        
        // Send a test message
        await client.tick();
        
        const newState = client.getState();
        TestRunner.expect.equal(
          newState.messageCount, 
          initialCount + 1, 
          'Message counter should increment'
        );
      })
    },

    {
      name: 'Performance Baseline',
      fn: TestRunner.createAsyncTest(async () => {
        const perfResults = await client.performanceTest(20);
        
        // Basic performance expectations
        TestRunner.expect.performance(perfResults.avgDuration, 1000, 'Average tick duration');
        TestRunner.expect.performance(perfResults.maxDuration, 2000, 'Maximum tick duration');
        
        logger.info('Performance baseline established', perfResults);
      }),
      options: { slow: true }
    }
  ];

  const suite = await runner.runSuite('DOOM Initialization Tests', tests);
  
  // Cleanup
  await client.cleanup();
  
  if (suite.failedTests > 0) {
    throw new Error(`Initialization tests failed: ${suite.failedTests}/${suite.totalTests} tests failed`);
  }
  
  logger.info('✅ All initialization tests passed successfully');
}

// Allow running this test suite directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runInitializationTests()
    .then(() => {
      logger.info('🎉 Initialization test suite completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('💥 Initialization test suite failed', { error: error.message });
      process.exit(1);
    });
}
