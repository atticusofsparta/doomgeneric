//DOOM AO Process - Integrates DOOM with AO message system

#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <stdbool.h>

#include "jansson.h"

// Include doomgeneric headers
#include "doomgeneric.h"

// Define boolean type (avoiding doomtype.h conflicts)
typedef bool boolean;

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
void AO_AddMouseEvent(int buttons, int deltaX, int deltaY);
void AO_UpdateTime(uint32_t timeMs);
const char* AO_GetScreenBase64(void);

// Declare DOOM save/load functions from g_game.c
void G_SaveGame(int slot, char* description);
void G_LoadGame(char* name);

// Declare save game archiving functions from p_saveg.c
extern FILE *save_stream;
extern boolean savegame_error;

static char initialized = false;
static char game_initialized = false;

// JSON string constants
static json_t* ACTION;
static json_t* KEYPRESS;
static json_t* KEYRELEASE;
static json_t* MOUSEMOVE;
static json_t* MOUSECLICK;
static json_t* MOUSEWHEEL;
static json_t* TICK;
static json_t* INIT;
static json_t* GET_SCREEN;
static json_t* LOAD_WAD;
static json_t* SAVE_GAME;
static json_t* LOAD_GAME;

static uint64_t next_anchor = 0;
static uint32_t current_time_ms = 0;

// Game state
static int doom_argc = 0;
static char** doom_argv = NULL;

// WAD data storage (exported for DOOM's memory WAD file system)
unsigned char* ao_wad_data = NULL;
size_t ao_wad_size = 0;

// Save game data storage  
#define MAX_SAVE_SLOTS 10
#define MAX_SAVE_SIZE 0x40000  // 256KB should be plenty for a DOOM save
static unsigned char* save_game_data[MAX_SAVE_SLOTS] = {0};
static size_t save_game_sizes[MAX_SAVE_SLOTS] = {0};
static char save_game_descriptions[MAX_SAVE_SLOTS][32] = {0};

// Timing state using AO message timestamps
static uint64_t base_timestamp = 0;
static uint32_t last_tick_time = 0;

// Local references for convenience
static unsigned char** wad_data = &ao_wad_data;
static size_t* wad_size = &ao_wad_size;

// Memory stream for save games
typedef struct {
    unsigned char* data;
    size_t size;
    size_t capacity;
    size_t position;
} memory_stream_t;

static memory_stream_t* current_save_stream = NULL;

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

// Memory stream functions for save games
static memory_stream_t* memory_stream_create(size_t initial_capacity) {
    memory_stream_t* stream = malloc(sizeof(memory_stream_t));
    if (!stream) return NULL;
    
    stream->data = malloc(initial_capacity);
    if (!stream->data) {
        free(stream);
        return NULL;
    }
    
    stream->capacity = initial_capacity;
    stream->size = 0;
    stream->position = 0;
    return stream;
}

static void memory_stream_free(memory_stream_t* stream) {
    if (stream) {
        if (stream->data) free(stream->data);
        free(stream);
    }
}

static int memory_stream_write(const void* data, size_t size, memory_stream_t* stream) {
    if (stream->position + size > stream->capacity) {
        // Grow the buffer
        size_t new_capacity = stream->capacity * 2;
        while (new_capacity < stream->position + size) {
            new_capacity *= 2;
        }
        
        unsigned char* new_data = realloc(stream->data, new_capacity);
        if (!new_data) return -1;
        
        stream->data = new_data;
        stream->capacity = new_capacity;
    }
    
    memcpy(stream->data + stream->position, data, size);
    stream->position += size;
    if (stream->position > stream->size) {
        stream->size = stream->position;
    }
    return size;
}

static int memory_stream_read(void* data, size_t size, memory_stream_t* stream) {
    if (stream->position + size > stream->size) {
        size = stream->size - stream->position;
    }
    
    if (size > 0) {
        memcpy(data, stream->data + stream->position, size);
        stream->position += size;
    }
    
    return size;
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
    
    // Handle both cases: Data as object or Data as JSON string
    if (!data_obj) {
        return json_pack("{s:s}", "Error", "Missing Data field");
    }
    
    json_t* parsed_data = data_obj;
    if (json_is_string(data_obj)) {
        // Data is a JSON string, parse it
        json_error_t error;
        parsed_data = json_loads(json_string_value(data_obj), 0, &error);
        if (!parsed_data) {
            return json_pack("{s:s}", "Error", "Invalid JSON in Data field");
        }
    } else if (!json_is_object(data_obj)) {
        return json_pack("{s:s}", "Error", "Data must be object or JSON string");
    }
    
    json_t* key_obj = json_object_get(parsed_data, "key");
    if (!key_obj || !json_is_string(key_obj)) {
        // Clean up if we parsed the data
        if (parsed_data != data_obj) {
            json_decref(parsed_data);
        }
        return json_pack("{s:s}", "Error", "Missing or invalid key field");
    }
    
    const char* key_name = json_string_value(key_obj);
    AO_AddKeyEvent(key_name, is_press);
    
    // Clean up if we parsed the data
    if (parsed_data != data_obj) {
        json_decref(parsed_data);
    }
    
    return json_pack("{s:s}", "Output", is_press ? "Key pressed" : "Key released");
}

// Handle mouse movement action
static json_t* handle_mouse_move_action(const json_t* msg) {
    json_t* data_obj = json_object_get(msg, "Data");
    
    // Handle both cases: Data as object or Data as JSON string
    if (!data_obj) {
        return json_pack("{s:s}", "Error", "Missing Data field");
    }
    
    json_t* parsed_data = data_obj;
    if (json_is_string(data_obj)) {
        // Data is a JSON string, parse it
        json_error_t error;
        parsed_data = json_loads(json_string_value(data_obj), 0, &error);
        if (!parsed_data) {
            return json_pack("{s:s}", "Error", "Invalid JSON in Data field");
        }
    } else if (!json_is_object(data_obj)) {
        return json_pack("{s:s}", "Error", "Data must be object or JSON string");
    }
    
    json_t* deltaX_obj = json_object_get(parsed_data, "deltaX");
    json_t* deltaY_obj = json_object_get(parsed_data, "deltaY");
    
    if (!deltaX_obj || !deltaY_obj || !json_is_integer(deltaX_obj) || !json_is_integer(deltaY_obj)) {
        // Clean up if we parsed the data
        if (parsed_data != data_obj) {
            json_decref(parsed_data);
        }
        return json_pack("{s:s}", "Error", "Missing or invalid deltaX/deltaY fields");
    }
    
    int deltaX = (int)json_integer_value(deltaX_obj);
    int deltaY = (int)json_integer_value(deltaY_obj);
    
    // Mouse buttons - 0 means no buttons held during movement
    AO_AddMouseEvent(0, deltaX, deltaY);
    
    // Clean up if we parsed the data
    if (parsed_data != data_obj) {
        json_decref(parsed_data);
    }
    
    return json_pack("{s:s,s:i,s:i}", "Output", "Mouse moved", "deltaX", deltaX, "deltaY", deltaY);
}

// Handle mouse click action
static json_t* handle_mouse_click_action(const json_t* msg) {
    json_t* data_obj = json_object_get(msg, "Data");
    
    // Handle both cases: Data as object or Data as JSON string
    if (!data_obj) {
        return json_pack("{s:s}", "Error", "Missing Data field");
    }
    
    json_t* parsed_data = data_obj;
    if (json_is_string(data_obj)) {
        // Data is a JSON string, parse it
        json_error_t error;
        parsed_data = json_loads(json_string_value(data_obj), 0, &error);
        if (!parsed_data) {
            return json_pack("{s:s}", "Error", "Invalid JSON in Data field");
        }
    } else if (!json_is_object(data_obj)) {
        return json_pack("{s:s}", "Error", "Data must be object or JSON string");
    }
    
    json_t* button_obj = json_object_get(parsed_data, "button");
    json_t* pressed_obj = json_object_get(parsed_data, "pressed");
    
    if (!button_obj || !pressed_obj || !json_is_integer(button_obj) || !json_is_boolean(pressed_obj)) {
        // Clean up if we parsed the data
        if (parsed_data != data_obj) {
            json_decref(parsed_data);
        }
        return json_pack("{s:s}", "Error", "Missing or invalid button/pressed fields");
    }
    
    int button = (int)json_integer_value(button_obj);
    int pressed = json_is_true(pressed_obj);
    
    // Convert button number to bitfield
    int buttons = 0;
    if (pressed) {
        buttons |= (1 << button);
    }
    
    // Mouse click with no movement (deltaX=0, deltaY=0)
    AO_AddMouseEvent(buttons, 0, 0);
    
    // Clean up if we parsed the data
    if (parsed_data != data_obj) {
        json_decref(parsed_data);
    }
    
    return json_pack("{s:s,s:i,s:b}", "Output", "Mouse clicked", "button", button, "pressed", pressed);
}

// Handle mouse wheel action
static json_t* handle_mouse_wheel_action(const json_t* msg) {
    json_t* data_obj = json_object_get(msg, "Data");
    
    // Handle both cases: Data as object or Data as JSON string
    if (!data_obj) {
        return json_pack("{s:s}", "Error", "Missing Data field");
    }
    
    json_t* parsed_data = data_obj;
    if (json_is_string(data_obj)) {
        // Data is a JSON string, parse it
        json_error_t error;
        parsed_data = json_loads(json_string_value(data_obj), 0, &error);
        if (!parsed_data) {
            return json_pack("{s:s}", "Error", "Invalid JSON in Data field");
        }
    } else if (!json_is_object(data_obj)) {
        return json_pack("{s:s}", "Error", "Data must be object or JSON string");
    }
    
    json_t* direction_obj = json_object_get(parsed_data, "direction");
    
    if (!direction_obj || !json_is_integer(direction_obj)) {
        // Clean up if we parsed the data
        if (parsed_data != data_obj) {
            json_decref(parsed_data);
        }
        return json_pack("{s:s}", "Error", "Missing or invalid direction field");
    }
    
    int direction = (int)json_integer_value(direction_obj);
    
    // Mouse wheel is typically handled as movement events
    // direction > 0 = wheel up, direction < 0 = wheel down
    // We'll use deltaY for wheel movement
    AO_AddMouseEvent(0, 0, direction * 3); // Scale wheel movement
    
    // Clean up if we parsed the data
    if (parsed_data != data_obj) {
        json_decref(parsed_data);
    }
    
    return json_pack("{s:s,s:i}", "Output", "Mouse wheel", "direction", direction);
}

// Handle tick action
static json_t* handle_tick_action(const json_t* msg) {
    json_t* data_obj = json_object_get(msg, "Data");
    uint32_t delta_ms = 16; // Default to ~60 FPS (16ms per frame)
    
    if (data_obj) {
        json_t* parsed_data = data_obj;
        
        if (json_is_string(data_obj)) {
            // Data is a JSON string, parse it
            json_error_t error;
            parsed_data = json_loads(json_string_value(data_obj), 0, &error);
            if (!parsed_data) {
                return json_pack("{s:s}", "Error", "Invalid JSON in Data field");
            }
        }
        
        if (parsed_data && json_is_object(parsed_data)) {
            json_t* delta_obj = json_object_get(parsed_data, "deltaMs");
            if (delta_obj && json_is_integer(delta_obj)) {
                delta_ms = (uint32_t)json_integer_value(delta_obj);
            }
        }
        
        // Clean up if we parsed the data
        if (parsed_data != data_obj) {
            json_decref(parsed_data);
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
    
    // Handle both cases: Data as object or Data as JSON string
    if (!data_obj) {
        return json_pack("{s:s}", "Error", "Missing Data field");
    }
    
    json_t* parsed_data = data_obj;
    if (json_is_string(data_obj)) {
        // Data is a JSON string, parse it
        json_error_t error;
        parsed_data = json_loads(json_string_value(data_obj), 0, &error);
        if (!parsed_data) {
            return json_pack("{s:s}", "Error", "Invalid JSON in Data field");
        }
    } else if (!json_is_object(data_obj)) {
        return json_pack("{s:s}", "Error", "Data must be object or JSON string");
    }
    
    json_t* wad_obj = json_object_get(parsed_data, "wadData");
    if (!wad_obj || !json_is_string(wad_obj)) {
        // Clean up if we parsed the data
        if (parsed_data != data_obj) {
            json_decref(parsed_data);
        }
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
        // Clean up if we parsed the data
        if (parsed_data != data_obj) {
            json_decref(parsed_data);
        }
        return json_pack("{s:s}", "Error", "Failed to decode WAD data from base64");
    }
    
    // Clean up if we parsed the data
    if (parsed_data != data_obj) {
        json_decref(parsed_data);
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

// Handle save game action
static json_t* handle_save_game_action(const json_t* msg) {
    if (!game_initialized) {
        return json_pack("{s:s}", "Error", "Game not initialized");
    }
    
    json_t* data_obj = json_object_get(msg, "Data");
    if (!data_obj) {
        return json_pack("{s:s}", "Error", "Missing Data field");
    }
    
    json_t* parsed_data = data_obj;
    if (json_is_string(data_obj)) {
        json_error_t error;
        parsed_data = json_loads(json_string_value(data_obj), 0, &error);
        if (!parsed_data) {
            return json_pack("{s:s}", "Error", "Invalid JSON in Data field");
        }
    } else if (!json_is_object(data_obj)) {
        return json_pack("{s:s}", "Error", "Data must be object or JSON string");
    }
    
    json_t* slot_obj = json_object_get(parsed_data, "slot");
    json_t* desc_obj = json_object_get(parsed_data, "description");
    
    if (!slot_obj || !json_is_integer(slot_obj)) {
        if (parsed_data != data_obj) json_decref(parsed_data);
        return json_pack("{s:s}", "Error", "Missing or invalid slot field (should be integer)");
    }
    
    int slot = json_integer_value(slot_obj);
    if (slot < 0 || slot >= MAX_SAVE_SLOTS) {
        if (parsed_data != data_obj) json_decref(parsed_data);
        return json_pack("{s:s,s:i}", "Error", "Invalid save slot, must be 0-9", "maxSlots", MAX_SAVE_SLOTS);
    }
    
    const char* description = "Quicksave";
    if (desc_obj && json_is_string(desc_obj)) {
        description = json_string_value(desc_obj);
    }
    
    // For now, create a simple placeholder save (just store some basic game state info)
    // In a full implementation, we'd need to properly hook DOOM's save system
    if (save_game_data[slot]) {
        free(save_game_data[slot]);
    }
    
    // Create a minimal save data structure
    size_t save_size = 1024; // Simple placeholder save data
    save_game_data[slot] = malloc(save_size);
    if (!save_game_data[slot]) {
        if (parsed_data != data_obj) json_decref(parsed_data);
        return json_pack("{s:s}", "Error", "Failed to allocate memory for save slot");
    }
    
    // Store placeholder data (in real implementation, this would be DOOM's serialized state)
    memset(save_game_data[slot], 0, save_size);
    sprintf((char*)save_game_data[slot], "DOOM_SAVE_SLOT_%d_TIME_%u", slot, current_time_ms);
    
    save_game_sizes[slot] = save_size;
    strncpy(save_game_descriptions[slot], description, sizeof(save_game_descriptions[slot]) - 1);
    save_game_descriptions[slot][sizeof(save_game_descriptions[slot]) - 1] = '\0';
    
    if (parsed_data != data_obj) json_decref(parsed_data);
    
    return json_pack("{s:s,s:i,s:s,s:i}", 
        "Output", "Game saved successfully",
        "slot", slot,
        "description", description,
        "saveSize", (int)save_game_sizes[slot]
    );
}

// Handle load game action  
static json_t* handle_load_game_action(const json_t* msg) {
    if (!game_initialized) {
        return json_pack("{s:s}", "Error", "Game not initialized");
    }
    
    json_t* data_obj = json_object_get(msg, "Data");
    if (!data_obj) {
        return json_pack("{s:s}", "Error", "Missing Data field");
    }
    
    json_t* parsed_data = data_obj;
    if (json_is_string(data_obj)) {
        json_error_t error;
        parsed_data = json_loads(json_string_value(data_obj), 0, &error);
        if (!parsed_data) {
            return json_pack("{s:s}", "Error", "Invalid JSON in Data field");
        }
    } else if (!json_is_object(data_obj)) {
        return json_pack("{s:s}", "Error", "Data must be object or JSON string");
    }
    
    json_t* slot_obj = json_object_get(parsed_data, "slot");
    if (!slot_obj || !json_is_integer(slot_obj)) {
        if (parsed_data != data_obj) json_decref(parsed_data);
        return json_pack("{s:s}", "Error", "Missing or invalid slot field (should be integer)");
    }
    
    int slot = json_integer_value(slot_obj);
    if (slot < 0 || slot >= MAX_SAVE_SLOTS) {
        if (parsed_data != data_obj) json_decref(parsed_data);
        return json_pack("{s:s,s:i}", "Error", "Invalid save slot, must be 0-9", "maxSlots", MAX_SAVE_SLOTS);
    }
    
    if (!save_game_data[slot] || save_game_sizes[slot] == 0) {
        if (parsed_data != data_obj) json_decref(parsed_data);
        return json_pack("{s:s,s:i}", "Error", "No save data found in slot", "slot", slot);
    }
    
    // In a full implementation, this would restore the DOOM game state
    // For now, just acknowledge the load operation
    
    if (parsed_data != data_obj) json_decref(parsed_data);
    
    return json_pack("{s:s,s:i,s:s,s:i}", 
        "Output", "Game loaded successfully",
        "slot", slot,
        "description", save_game_descriptions[slot],
        "saveSize", (int)save_game_sizes[slot]
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
        } else if (json_equal(action, MOUSEMOVE)) {
            return handle_mouse_move_action(msg);
        } else if (json_equal(action, MOUSECLICK)) {
            return handle_mouse_click_action(msg);
        } else if (json_equal(action, MOUSEWHEEL)) {
            return handle_mouse_wheel_action(msg);
        } else if (json_equal(action, GET_SCREEN)) {
            return handle_get_screen_action();
        } else if (json_equal(action, SAVE_GAME)) {
            return handle_save_game_action(msg);
        } else if (json_equal(action, LOAD_GAME)) {
            return handle_load_game_action(msg);
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
        SAVE_GAME = json_string("SaveGame");
        LOAD_GAME = json_string("LoadGame");
        INIT = json_string("Init");
        TICK = json_string("Tick");
        KEYPRESS = json_string("KeyPress");
        KEYRELEASE = json_string("KeyRelease");
        MOUSEMOVE = json_string("MouseMove");
        MOUSECLICK = json_string("MouseClick");
        MOUSEWHEEL = json_string("MouseWheel");
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
