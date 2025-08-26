//DOOM AO Process - Integrates DOOM with AO message system

#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>

#include "jansson.h"

// Include doomgeneric headers
#include "doomgeneric.h"

// Emscripten compatibility functions using AO message timestamps
double emscripten_date_now(void);
void emscripten_sleep(unsigned int ms);
double emscripten_get_now(void);
void emscripten_exit_with_live_runtime(void);
int _emscripten_system(const char* command);
void emscripten_force_exit(int status);
void _abort(void);
void abort(void);

// Declare AO-specific functions from doomgeneric_ao.c
void AO_AddKeyEvent(const char* keyName, int pressed);
void AO_UpdateTime(uint32_t timeMs);
const char* AO_GetScreenBase64(void);

#define true 1
#define false 0

static char initialized = false;
static char game_initialized = false;

// JSON string constants
static json_t* ACTION;
static json_t* KEYPRESS;
static json_t* KEYRELEASE;
static json_t* TICK;
static json_t* INIT;
static json_t* GET_SCREEN;
static json_t* LOAD_WAD;

static uint64_t next_anchor = 0;
static uint32_t current_time_ms = 0;

// Game state
static int doom_argc = 0;
static char** doom_argv = NULL;

// WAD data storage (exported for DOOM's memory WAD file system)
unsigned char* ao_wad_data = NULL;
size_t ao_wad_size = 0;

// Timing state using AO message timestamps
static uint64_t base_timestamp = 0;
static uint32_t last_tick_time = 0;

// Local references for convenience
static unsigned char** wad_data = &ao_wad_data;
static size_t* wad_size = &ao_wad_size;

// Base64 decoding table
static const unsigned char base64_decode_table[256] = {
    ['A'] = 0, ['B'] = 1, ['C'] = 2, ['D'] = 3, ['E'] = 4, ['F'] = 5, ['G'] = 6, ['H'] = 7,
    ['I'] = 8, ['J'] = 9, ['K'] = 10, ['L'] = 11, ['M'] = 12, ['N'] = 13, ['O'] = 14, ['P'] = 15,
    ['Q'] = 16, ['R'] = 17, ['S'] = 18, ['T'] = 19, ['U'] = 20, ['V'] = 21, ['W'] = 22, ['X'] = 23,
    ['Y'] = 24, ['Z'] = 25, ['a'] = 26, ['b'] = 27, ['c'] = 28, ['d'] = 29, ['e'] = 30, ['f'] = 31,
    ['g'] = 32, ['h'] = 33, ['i'] = 34, ['j'] = 35, ['k'] = 36, ['l'] = 37, ['m'] = 38, ['n'] = 39,
    ['o'] = 40, ['p'] = 41, ['q'] = 42, ['r'] = 43, ['s'] = 44, ['t'] = 45, ['u'] = 46, ['v'] = 47,
    ['w'] = 48, ['x'] = 49, ['y'] = 50, ['z'] = 51, ['0'] = 52, ['1'] = 53, ['2'] = 54, ['3'] = 55,
    ['4'] = 56, ['5'] = 57, ['6'] = 58, ['7'] = 59, ['8'] = 60, ['9'] = 61, ['+'] = 62, ['/'] = 63
};

// Simple base64 decoder
static size_t base64_decode(const char* input, unsigned char** output) {
    size_t input_len = strlen(input);
    if (input_len % 4 != 0) return 0;
    
    size_t output_len = input_len / 4 * 3;
    if (input[input_len - 1] == '=') output_len--;
    if (input[input_len - 2] == '=') output_len--;
    
    *output = malloc(output_len);
    if (!*output) return 0;
    
    for (size_t i = 0, j = 0; i < input_len; i += 4, j += 3) {
        uint32_t a = base64_decode_table[(unsigned char)input[i]];
        uint32_t b = base64_decode_table[(unsigned char)input[i + 1]];
        uint32_t c = base64_decode_table[(unsigned char)input[i + 2]];
        uint32_t d = base64_decode_table[(unsigned char)input[i + 3]];
        
        uint32_t triple = (a << 18) + (b << 12) + (c << 6) + d;
        
        if (j < output_len) (*output)[j] = (triple >> 16) & 0xFF;
        if (j + 1 < output_len) (*output)[j + 1] = (triple >> 8) & 0xFF;
        if (j + 2 < output_len) (*output)[j + 2] = triple & 0xFF;
    }
    
    return output_len;
}

// Initialize DOOM with WAD data
static void init_doom() {
    if (game_initialized) return;
    
    if (!ao_wad_data) {
        // No WAD loaded yet, don't initialize
        return;
    }
    
    // Write WAD data to memory file that DOOM can access
    // For now, we'll use a simple approach - DOOM will need to be modified
    // to read from our memory buffer instead of file system
    
    // Set up arguments for DOOM with our WAD
    doom_argc = 3;
    doom_argv = malloc(sizeof(char*) * doom_argc);
    doom_argv[0] = strdup("doom");
    doom_argv[1] = strdup("-iwad");
    doom_argv[2] = strdup("memory_wad"); // Placeholder - we'll handle this in the WAD loader
    
    doomgeneric_Create(doom_argc, doom_argv);
    game_initialized = true;
}

// Process a single game tick
static void process_tick(uint32_t delta_ms) {
    if (!game_initialized) {
        init_doom();
        return;
    }
    
    // Update time
    current_time_ms += delta_ms;
    AO_UpdateTime(current_time_ms);
    
    // Run DOOM game tick
    doomgeneric_Tick();
}

// Handle keypress/keyrelease actions
static json_t* handle_key_action(const json_t* msg, int is_press) {
    json_t* data_obj = json_object_get(msg, "Data");
    if (!data_obj || !json_is_object(data_obj)) {
        return json_pack("{s:s}", "Error", "Missing or invalid Data object");
    }
    
    json_t* key_obj = json_object_get(data_obj, "key");
    if (!key_obj || !json_is_string(key_obj)) {
        return json_pack("{s:s}", "Error", "Missing or invalid key field");
    }
    
    const char* key_name = json_string_value(key_obj);
    AO_AddKeyEvent(key_name, is_press);
    
    return json_pack("{s:s}", "Output", is_press ? "Key pressed" : "Key released");
}

// Handle tick action
static json_t* handle_tick_action(const json_t* msg) {
    json_t* data_obj = json_object_get(msg, "Data");
    uint32_t delta_ms = 16; // Default to ~60 FPS (16ms per frame)
    
    if (data_obj && json_is_object(data_obj)) {
        json_t* delta_obj = json_object_get(data_obj, "deltaMs");
        if (delta_obj && json_is_integer(delta_obj)) {
            delta_ms = (uint32_t)json_integer_value(delta_obj);
        }
    }
    
    process_tick(delta_ms);
    
    return json_pack("{s:s,s:i}", "Output", "Tick processed", "deltaMs", delta_ms);
}

// Handle get screen action
static json_t* handle_get_screen_action() {
    if (!game_initialized) {
        return json_pack("{s:s}", "Error", "Game not initialized");
    }
    
    const char* screen_data = AO_GetScreenBase64();
    if (!screen_data) {
        return json_pack("{s:s}", "Error", "Failed to get screen data");
    }
    
    return json_pack("{s:{s:s,s:i,s:i}}", 
        "Output",
            "screen", screen_data,
            "width", DOOMGENERIC_RESX,
            "height", DOOMGENERIC_RESY
    );
}

// Handle LoadWAD action
static json_t* handle_load_wad_action(const json_t* msg) {
    json_t* data_obj = json_object_get(msg, "Data");
    if (!data_obj || !json_is_object(data_obj)) {
        return json_pack("{s:s}", "Error", "Missing or invalid Data object");
    }
    
    json_t* wad_obj = json_object_get(data_obj, "wadData");
    if (!wad_obj || !json_is_string(wad_obj)) {
        return json_pack("{s:s}", "Error", "Missing or invalid wadData field (should be base64 string)");
    }
    
    const char* wad_base64 = json_string_value(wad_obj);
    
    // Free previous WAD data if any
    if (ao_wad_data) {
        free(ao_wad_data);
        ao_wad_data = NULL;
        ao_wad_size = 0;
    }
    
    // Decode base64 WAD data
    ao_wad_size = base64_decode(wad_base64, &ao_wad_data);
    if (ao_wad_size == 0 || !ao_wad_data) {
        return json_pack("{s:s}", "Error", "Failed to decode WAD data from base64");
    }
    
    return json_pack("{s:s,s:i}", 
        "Output", "WAD loaded successfully",
        "wadSize", (int)ao_wad_size
    );
}

// Handle init action
static json_t* handle_init_action() {
    if (game_initialized) {
        return json_pack("{s:s}", "Output", "Game already initialized");
    }
    
    if (!ao_wad_data) {
        return json_pack("{s:s}", "Error", "No WAD file loaded. Use LoadWAD action first.");
    }
    
    init_doom();
    return json_pack("{s:s,s:i,s:i}", 
        "Output", "Game initialized",
        "width", DOOMGENERIC_RESX,
        "height", DOOMGENERIC_RESY
    );
}

static json_t* _handle(const json_t* msg, const json_t* env) {
    // Extract timestamp from message for deterministic timing
    json_t* timestamp_obj = json_object_get(msg, "Timestamp");
    if (timestamp_obj && json_is_integer(timestamp_obj)) {
        uint64_t timestamp = (uint64_t)json_integer_value(timestamp_obj);
        if (base_timestamp == 0) {
            base_timestamp = timestamp;
            last_tick_time = 0;
        } else {
            last_tick_time = (uint32_t)(timestamp - base_timestamp);
        }
        current_time_ms = last_tick_time;
        AO_UpdateTime(current_time_ms);
    }
    
    json_t* tags = json_object_get(msg, "Tags");
    json_t* action_tag = NULL;

    if (tags && json_is_array(tags)) {
        size_t i;
        json_t* tag;
        json_array_foreach(tags, i, tag) {
            json_t* name = json_object_get(tag, "name");
            if (json_equal(name, ACTION)) {
                action_tag = tag;
                break;
            }
        }
    }

    if (action_tag) {
        json_t* action = json_object_get(action_tag, "value");

        if (json_equal(action, LOAD_WAD)) {
            return handle_load_wad_action(msg);
        } else if (json_equal(action, INIT)) {
            return handle_init_action();
        } else if (json_equal(action, TICK)) {
            return handle_tick_action(msg);
        } else if (json_equal(action, KEYPRESS)) {
            return handle_key_action(msg, 1);
        } else if (json_equal(action, KEYRELEASE)) {
            return handle_key_action(msg, 0);
        } else if (json_equal(action, GET_SCREEN)) {
            return handle_get_screen_action();
        } else {
            return json_pack("{s:o}",
                "Error", json_sprintf("Unsupported action: %s", json_string_value(action))
            );
        }
    }
    
    return json_pack("{s:s}", "Output", "DOOM AO Process - Send Action: Init to start the game");
}

// Main entry point for AO process - required by AO runtime
int main() {
    // AO modules export main() which gets called by the runtime
    return 0;
}

const char* handle(const char *msg_json, const char* env_json) {
    static char* result = NULL;

    if (!initialized) {
        ACTION = json_string("Action");
        LOAD_WAD = json_string("LoadWAD");
        INIT = json_string("Init");
        TICK = json_string("Tick");
        KEYPRESS = json_string("KeyPress");
        KEYRELEASE = json_string("KeyRelease");
        GET_SCREEN = json_string("GetScreen");
        initialized = true;
    }

    if (result != NULL) {
        free(result);
        result = NULL;
    }

    json_error_t err;
    json_t* msg = json_loads(msg_json, 0, &err);
    json_t* env = json_loads(env_json, 0, &err);

    json_t* ret = json_pack("{s:b,s:o}",
        "ok", true,
        "response", _handle(msg, env)
    );

    result = json_dumps(ret, JSON_COMPACT);
    json_decref(msg);
    json_decref(env);
    json_decref(ret);
    return result;
}

// Emscripten compatibility implementations using AO message timestamps
double emscripten_date_now(void) {
    // Return current time in milliseconds as a double
    // This uses the timestamp from the most recent AO message
    return (double)current_time_ms;
}

void emscripten_sleep(unsigned int ms) {
    // In AO, we don't actually sleep since we're message-driven
    // This is a no-op but maintains compatibility
    (void)ms; // Suppress unused parameter warning
}

double emscripten_get_now(void) {
    // Another timing function - return the same AO timestamp
    return (double)current_time_ms;
}

void emscripten_exit_with_live_runtime(void) {
    // In AO, we don't actually exit - just return
    // This maintains the process alive for future messages
}

int _emscripten_system(const char* command) {
    // System calls are not allowed in AO - return failure
    (void)command; // Suppress unused parameter warning
    return -1; // Indicate failure
}

void emscripten_force_exit(int status) {
    // In AO, we don't actually exit - ignore
    (void)status; // Suppress unused parameter warning
}

void _abort(void) {
    // In AO, we don't abort - just return
    // This prevents the process from crashing
    while(1) {} // Infinite loop to satisfy noreturn requirement
}

void abort(void) {
    // In AO, we don't abort - just return  
    // This prevents the process from crashing
    while(1) {} // Infinite loop to satisfy noreturn requirement
}
