#version 320 es
precision highp float;
// @state size=8x8 hz=30 format=rgba16f

// Test fixture for the state pass (not a built-in): every step writes 0.25
// with alpha 0, so any leaked GL blending accumulates into the old texel.

void mainState(out vec4 o, in vec2 fc) {
    o = vec4(0.25, 0.0, 0.0, 0.0);
}

void mainImage(out vec4 o, in vec2 fc) {
    o = vec4(texelFetch(u_state, ivec2(0), 0).r, 0.0, 0.0, 1.0);
}
