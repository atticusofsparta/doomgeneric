#!/usr/bin/env node

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import AoLoader from '@permaweb/ao-loader';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🧪 Testing Example Process with AO Loader');
console.log('==========================================\n');

async function main() {
    try {
        // Load the working example WASM
        const wasmPath = path.join(__dirname, 'example_process.wasm');
        const wasmBinary = readFileSync(wasmPath);
        
        console.log(`📁 Loaded WASM: ${wasmPath}`);
        console.log(`📊 WASM Size: ${wasmBinary.length} bytes`);
        
        // Create AO Loader environment
        const env = {
            Process: {
                Id: "test-example-process",
                Owner: "test-owner",
                Tags: [
                    { name: "Data-Protocol", value: "ao" },
                    { name: "Type", value: "Process" },
                    { name: "Variant", value: "ao.TN.1" }
                ]
            }
        };

        console.log('\n🔧 Creating AO Loader handle...');
        
        const handle = await AoLoader(wasmBinary, {
            format: "wasm32-unknown-emscripten2",
            inputEncoding: "JSON-1",
            outputEncoding: "JSON-1", 
            memoryLimit: "104857600", // 100MB to match our config
            computeLimit: "9000000000", 
            extensions: []
        });

        console.log('✅ AO Loader handle created successfully!');

        // Test basic message
        console.log('\n📨 Testing basic message...');
        const message = {
            Owner: "test-owner",
            Target: "test-example-process", 
            From: "test-sender",
            Data: "Hello Example!",
            Timestamp: Date.now(),
            Tags: []
        };

        const result = await handle(null, message, env);
        console.log('📤 Result:', JSON.stringify(result, null, 2));

        console.log('\n🎉 Example process works with AO Loader!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

main().catch(console.error);
