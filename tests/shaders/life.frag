#version 320 es
precision highp float;
precision highp int;
// @state size=64x64 hz=frame format=rgba16f

// Conway's Life on a 64×64 torus. Test fixture for the state pass (not a
// built-in): cells live in .r, seeded from u_seed at step 0.

float cellAt(ivec2 p) {
    ivec2 sz = ivec2(u_state_resolution);
    return texelFetch(u_state, (p + sz) % sz, 0).r;
}

float hash(uvec2 p, uint s) {
    uint h = p.x * 1597334677u ^ p.y * 3812015801u ^ s * 2654435769u;
    h ^= h >> 16;
    h *= 2246822519u;
    h ^= h >> 13;
    h *= 3266489917u;
    h ^= h >> 16;
    return float(h) / 4294967295.0;
}

void mainState(out vec4 o, in vec2 fc) {
    ivec2 p = ivec2(fc);
    if (u_step == 0) {
        o = vec4(hash(uvec2(p), u_seed) < 0.35 ? 1.0 : 0.0, 0.0, 0.0, 1.0);
        return;
    }
    int n = 0;
    for (int dy = -1; dy <= 1; dy++) {
        for (int dx = -1; dx <= 1; dx++) {
            if (dx != 0 || dy != 0) {
                n += int(cellAt(p + ivec2(dx, dy)));
            }
        }
    }
    bool alive = cellAt(p) > 0.5;
    o = vec4((n == 3 || (alive && n == 2)) ? 1.0 : 0.0, 0.0, 0.0, 1.0);
}

void mainImage(out vec4 o, in vec2 fc) {
    ivec2 p = ivec2(fc / iResolution.xy * u_state_resolution);
    o = vec4(vec3(cellAt(p)), 1.0);
}
