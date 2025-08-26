#!/usr/bin/env node

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import AoLoader from '@permaweb/ao-loader';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🎮 WAD Loading Focus Test');
console.log('=========================\n');

async function testWADLoading() {
    try {
        // Load DOOM WASM
        const wasmPath = path.join(__dirname, 'src/doom_process.wasm');
        const wasmBinary = readFileSync(wasmPath);
        
        console.log(`📁 Loaded WASM: ${Math.round(wasmBinary.length / 1024)} KB`);
        
        // Load the real DOOM1.WAD file
        const wadPath = path.join(__dirname, '../../../doomgeneric/Doom1.WAD');
        let wadBase64;
        try {
            const wadBuffer = readFileSync(wadPath);
            wadBase64 = wadBuffer.toString('base64');
            console.log(`📦 Real DOOM1.WAD loaded: ${Math.round(wadBuffer.length / 1024)} KB`);
            console.log(`📦 Base64 encoded size: ${Math.round(wadBase64.length / 1024)} KB`);
        } catch (e) {
            console.log('❌ Failed to load Doom1.WAD:', e.message);
            return;
        }
        
        // Create AO Loader
        console.log('\n🔧 Creating AO Loader handle...');
        const handle = await AoLoader(wasmBinary, {
            format: "wasm32-unknown-emscripten4",
            inputEncoding: "JSON-1",
            outputEncoding: "JSON-1", 
            memoryLimit: "1073741824", // 1GB
            computeLimit: "9000000000", 
            extensions: []
        });
        console.log('✅ AO Loader handle created successfully!');

        let memory = null;

        // Helper function to send message and log results
        async function sendMessage(testName, action, data = {}) {
            console.log(`\n📨 ${testName}`);
            
            const message = {
                Id: "1111111111111111111111111111111111111111111",
                "Block-Height": "1",
                Owner: "arweave-address-111111111111111111111111111",
                Module: "ANT",
                Target: "arweave-address-111111111111111111111111111",
                From: "arweave-address-111111111111111111111111111",
                Timestamp: Date.now(),
                Reference: "1",
                Tags: [{ name: "Action", value: action }],
                Data: JSON.stringify(data)
            };
            
            console.log(`   📤 Action: ${action}`);
            console.log(`   📤 Data: ${JSON.stringify(data)}`);
            
            const result = await handle(memory, message, {
                Process: {
                    Id: "doom-process",
                    Owner: "test-owner",
                    Tags: [
                        { name: "Data-Protocol", value: "ao" },
                        { name: "Type", value: "Process" },
                        { name: "Variant", value: "ao.TN.1" }
                    ]
                }
            });
            
            memory = result.Memory;
            
            console.log(`   📥 Output: ${result.Output || 'none'}`);
            console.log(`   📥 Error: ${result.Error || 'none'}`);
            console.log(`   📥 GasUsed: ${result.GasUsed}`);
            
            return result;
        }

        // Test 1: Try original format (should fail)
        console.log('\n=== Testing Original Format (Expected to Fail) ===');
        await sendMessage("Load WAD with 'wadData' field", "LoadWAD", { 
            wadData: wadBase64 
        });

        // Test 2: Try correct format
        console.log('\n=== Testing Correct Format (wadBase64) ===');
        await sendMessage("Load WAD with 'wadBase64' field", "LoadWAD", { 
            wadBase64: wadBase64 
        });

        // Test 3: Try the C code's expected format (wadData)
        console.log('\n=== Testing C Code Expected Format (wadData) ===');
        await sendMessage("Load WAD with 'wadData' field (C expects this)", "LoadWAD", { 
            wadData: wadBase64 
        });

        // Test 4: Try direct Data field (no stringification)
        console.log('\n=== Testing Direct Data Field ===');
        const directMessage = {
            Id: "1111111111111111111111111111111111111111111",
            "Block-Height": "1",
            Owner: "arweave-address-111111111111111111111111111",
            Module: "ANT",
            Target: "arweave-address-111111111111111111111111111",
            From: "arweave-address-111111111111111111111111111",
            Timestamp: Date.now(),
            Reference: "1",
            Tags: [{ name: "Action", value: "LoadWAD" }],
            Data: { wadData: wadBase64 }  // Direct object, not stringified
        };
        
        console.log(`   📤 Direct Data object: { wadData: "${wadBase64}" }`);
        const directResult = await handle(memory, directMessage, {
            Process: {
                Id: "doom-process",
                Owner: "test-owner",
                Tags: [
                    { name: "Data-Protocol", value: "ao" },
                    { name: "Type", value: "Process" },
                    { name: "Variant", value: "ao.TN.1" }
                ]
            }
        });
        
        memory = directResult.Memory;
        console.log(`   📥 Output: ${directResult.Output || 'none'}`);
        console.log(`   📥 Error: ${directResult.Error || 'none'}`);

        // Test 5: Try to initialize DOOM after WAD load
        console.log('\n=== Testing DOOM Initialization ===');
        await sendMessage("Initialize DOOM", "Init", {});

        // Test 4: Try a game tick
        console.log('\n=== Testing Game Tick ===');
        await sendMessage("Game Tick", "Tick", { deltaMs: 16 });

        console.log('\n🎉 WAD loading test complete!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

testWADLoading().catch(console.error);
