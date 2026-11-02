#version 320 es
precision highp float;
precision highp int;
// @state scale=0.33 hz=360 format=rgba32f

// ---------------------------------------------------------------------------
// hyprsaver — reaction.frag
//
// Gray-Scott reaction–diffusion: two chemicals U and V on a torus, where
// U + 2V → 3V and V decays. State texture: U in .r, V in .g, stepped at
// 360 Hz by mainState; mainImage colours V through palette().
//
// A fixed (F, k) fills the screen within seconds and then barely changes, so
// three things keep it moving over a 5-minute cycle:
// - drift: (F, k) follow a ~300 s path through mitosis → coral → maze;
// - parameter map: a low-frequency spatial offset along the same path, so
//   neighbouring regions behave differently and fronts keep moving;
// - seed drops: every 2 s of sim time a blob of V lands at a hashed spot,
//   reviving regions that went extinct.
//
// rgba32f: U sits near 1.0, where a half float's step (≈ 0.0005) would
// swallow per-step changes such as F·(1 − U).
//
// Cost: scale=0.33 hz=360 keeps it Lightweight in `hyprsaver bench`
// (scale=0.5 hz=720 is Ultra on an integrated GPU).
// ---------------------------------------------------------------------------

const int HZ = 360;            // keep in sync with the directive
const int DROP_STEPS = 2 * HZ; // a seed drop every 2 s of sim time

vec2 cell(ivec2 p) {
    ivec2 sz = ivec2(u_state_resolution);
    return texelFetch(u_state, (p + sz) % sz, 0).rg; // toroidal wrap
}

vec2 hash2(vec2 p) { // Dave Hoskins
    vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    q += dot(q, q.yzx + 33.33);
    return fract((q.xx + q.yz) * q.zy);
}

// (F, k) along mitosis → coral → maze. t in [0, 1].
vec2 feedKill(float t) {
    const vec2 MITOSIS = vec2(0.0367, 0.0649);
    const vec2 CORAL   = vec2(0.0545, 0.0620);
    const vec2 MAZE    = vec2(0.0290, 0.0570);
    return t < 0.5 ? mix(MITOSIS, CORAL, t * 2.0) : mix(CORAL, MAZE, t * 2.0 - 1.0);
}

void mainState(out vec4 o, in vec2 fc) {
    ivec2 p = ivec2(fc);
    float salt = float(u_seed % 1024u);
    if (u_step == 0) { // seed: sparse 8×8 blobs of V
        float h = hash2(floor(fc / 8.0) + salt).x;
        o = vec4(1.0, h > 0.97 ? 1.0 : 0.0, 0.0, 1.0);
        return;
    }
    vec2 c = cell(p);
    vec2 lap = -c
        + 0.2  * (cell(p + ivec2(1, 0)) + cell(p - ivec2(1, 0))
                + cell(p + ivec2(0, 1)) + cell(p - ivec2(0, 1)))
        + 0.05 * (cell(p + ivec2(1, 1)) + cell(p + ivec2(-1, 1))
                + cell(p + ivec2(1, -1)) + cell(p + ivec2(-1, -1)));

    vec2 uv = fc / u_state_resolution;
    float drift = 0.5 + 0.5 * sin(u_sim_time * 0.021); // ≈ 300 s period
    float local = 0.5 + 0.5 * sin(dot(uv, vec2(3.1, 2.3)) * 6.2832 + u_sim_time * 0.05);
    vec2 fk = feedKill(clamp(mix(drift, local, 0.35), 0.0, 1.0));

    float r = c.x * c.y * c.y;
    vec2 n = c + vec2(1.0 * lap.x - r + fk.x * (1.0 - c.x),
                      0.5 * lap.y + r - (fk.x + fk.y) * c.y);

    if (u_step % DROP_STEPS == 0) { // seed drop
        vec2 ctr = hash2(vec2(float(u_step / DROP_STEPS), salt)) * u_state_resolution;
        if (distance(fc, ctr) < 4.0) n = vec2(0.5, 1.0);
    }
    o = vec4(clamp(n, 0.0, 1.0), 0.0, 1.0);
}

void mainImage(out vec4 o, in vec2 fc) {
    // RGBA32F is not filterable: bilinear upscale by hand, wrapping like the sim.
    vec2 q = fc / iResolution.xy * u_state_resolution - 0.5;
    ivec2 i = ivec2(floor(q));
    vec2 f = fract(q);
    float v = mix(mix(cell(i).g,              cell(i + ivec2(1, 0)).g, f.x),
                  mix(cell(i + ivec2(0, 1)).g, cell(i + ivec2(1, 1)).g, f.x), f.y);
    o = vec4(palette(smoothstep(0.0, 0.4, v)), 1.0);
}
