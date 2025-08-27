#!/usr/bin/env tsx

import { DoomTestClient } from './tests/utils/doom-client.js';
import { logger } from './tests/utils/logger.js';

async function testWADPath() {
  const client = new DoomTestClient();
  
  try {
    await client.initialize();
    logger.info('✅ AO Loader initialized');
    
    await client.loadWAD();
    logger.info('✅ WAD loaded successfully');
    
    await client.initializeGame();
    logger.info('✅ Game initialized successfully');
    
    const tick = await client.tick();
    logger.info('✅ Game tick successful');
    
    console.log('🎉 All basic functionality working!');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.cleanup();
  }
}

testWADPath();
