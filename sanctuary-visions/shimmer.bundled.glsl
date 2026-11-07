// Sanctuary's optional 2D light pass. iTime is the sampled NARRATION time.
// iChannel0: signed-distance texture of the existing shield; iChannel1: media state.
// DEBUG_MODE: 0 final | 1 shield distance | 5 support masks.
#define DEBUG_MODE 0

// Library code below is bundled from shader-skills (MIT): https://github.com/gokayfem/shader-skills
// ---- shader-skills library: common ----
const float TAU = 6.28318530717959;

// ---- shader-skills library: hash ----
// PCG-style 1D integer hash.
uint pcgHash(uint v) {
    uint state = v * 747796405u + 2891336453u;
    uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
    return (word >> 22u) ^ word;
}
// 3D integer hash, three decorrelated outputs.
uvec3 pcg3d(uvec3 v) {
    v = v * 1664525u + 1013904223u;
    v.x += v.y * v.z;
    v.y += v.z * v.x;
    v.z += v.x * v.y;
    v ^= v >> 16u;
    v.x += v.y * v.z;
    v.y += v.z * v.x;
    v.z += v.x * v.y;
    return v;
}
// Map a uint to [0,1) using the top 24 bits, so the result can never round up to 1.0.
float uintToUnit(uint h) { return float(h >> 8u) * (1.0 / 16777216.0); }
vec2 uintToUnit(uvec2 h) { return vec2(h >> 8u) * (1.0 / 16777216.0); }
vec3 uintToUnit(uvec3 h) { return vec3(h >> 8u) * (1.0 / 16777216.0); }
vec4 uintToUnit(uvec4 h) { return vec4(h >> 8u) * (1.0 / 16777216.0); }
// Random float in [0,1) for an integer-valued 2D input.
float hash12(vec2 p) {
    uvec2 q = uvec2(ivec2(floor(p)));
    return uintToUnit(pcgHash(q.x + pcgHash(q.y)));
}
// Random vec3 in [0,1)^3 for an integer-valued 3D input.
vec3 hash33(vec3 p) { return uintToUnit(pcg3d(uvec3(ivec3(floor(p))))); }

// ---- shader-skills library: noise ----
// Quintic fade 6t^5 - 15t^4 + 10t^3: C2-continuous interpolation weights for lattice noise.
vec2 quinticFade(vec2 f) { return f * f * f * (f * (f * 6.0 - 15.0) + 10.0); }
vec3 quinticFade(vec3 f) { return f * f * f * (f * (f * 6.0 - 15.0) + 10.0); }
// Derivative of quinticFade: 30 t^2 (t - 1)^2.
vec2 quinticFadeDeriv(vec2 f) { return 30.0 * f * f * (f * (f - 2.0) + 1.0); }
vec3 quinticFadeDeriv(vec3 f) { return 30.0 * f * f * (f * (f - 2.0) + 1.0); }
// Unit gradient for a 2D lattice point.
vec2 latticeGradient(vec2 cell) {
    float a = TAU * hash12(cell);
    return vec2(cos(a), sin(a));
}
// 2D gradient (Perlin-style) noise with analytic derivatives. Returns vec3(value, d/dx, d/dy). Gradient noise has less grid-aligned blockiness than value noise. Prefer it for fBm.
vec3 gradientNoiseD(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = quinticFade(f), du = quinticFadeDeriv(f);
    vec2 ga = latticeGradient(i);
    vec2 gb = latticeGradient(i + vec2(1.0, 0.0));
    vec2 gc = latticeGradient(i + vec2(0.0, 1.0));
    vec2 gd = latticeGradient(i + vec2(1.0, 1.0));
    float va = dot(ga, f);
    float vb = dot(gb, f - vec2(1.0, 0.0));
    float vc = dot(gc, f - vec2(0.0, 1.0));
    float vd = dot(gd, f - vec2(1.0, 1.0));
    float k = va - vb - vc + vd;
    float value = va + u.x * (vb - va) + u.y * (vc - va) + u.x * u.y * k;
    vec2 deriv = ga + u.x * (gb - ga) + u.y * (gc - ga) + u.x * u.y * (ga - gb - gc + gd)
               + du * (vec2(vb - va, vc - va) + u.yx * k);
    return vec3(value, deriv);
}
// 2D gradient noise.
float gradientNoise(vec2 p) { return gradientNoiseD(p).x; }
// Dot product of a hashed 3D gradient with the offset to its lattice corner.
float latticeGradDot(vec3 cell, vec3 corner, vec3 f) {
    vec3 g = hash33(cell + corner) * 2.0 - 1.0;
    return dot(g, f - corner);
}
// 3D gradient noise.
float gradientNoise(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    vec3 u = quinticFade(f);
    return mix(mix(mix(latticeGradDot(i, vec3(0, 0, 0), f), latticeGradDot(i, vec3(1, 0, 0), f), u.x),
                   mix(latticeGradDot(i, vec3(0, 1, 0), f), latticeGradDot(i, vec3(1, 1, 0), f), u.x), u.y),
               mix(mix(latticeGradDot(i, vec3(0, 0, 1), f), latticeGradDot(i, vec3(1, 0, 1), f), u.x),
                   mix(latticeGradDot(i, vec3(0, 1, 1), f), latticeGradDot(i, vec3(1, 1, 1), f), u.x), u.y), u.z);
}
// 3D gradient noise with analytic derivatives. Returns vec4(value, d/dx, d/dy, d/dz); value equals gradientNoise(p). The trilinear blend is expanded as a polynomial in the fade weights, so the gradient is the same blend of the corner gradients plus the chain-rule term of the fade.
vec4 gradientNoiseD(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    vec3 u = quinticFade(f), du = quinticFadeDeriv(f);
    vec3 g000 = hash33(i) * 2.0 - 1.0;
    vec3 g100 = hash33(i + vec3(1, 0, 0)) * 2.0 - 1.0;
    vec3 g010 = hash33(i + vec3(0, 1, 0)) * 2.0 - 1.0;
    vec3 g110 = hash33(i + vec3(1, 1, 0)) * 2.0 - 1.0;
    vec3 g001 = hash33(i + vec3(0, 0, 1)) * 2.0 - 1.0;
    vec3 g101 = hash33(i + vec3(1, 0, 1)) * 2.0 - 1.0;
    vec3 g011 = hash33(i + vec3(0, 1, 1)) * 2.0 - 1.0;
    vec3 g111 = hash33(i + vec3(1, 1, 1)) * 2.0 - 1.0;
    float v000 = dot(g000, f);
    float v100 = dot(g100, f - vec3(1, 0, 0));
    float v010 = dot(g010, f - vec3(0, 1, 0));
    float v110 = dot(g110, f - vec3(1, 1, 0));
    float v001 = dot(g001, f - vec3(0, 0, 1));
    float v101 = dot(g101, f - vec3(1, 0, 1));
    float v011 = dot(g011, f - vec3(0, 1, 1));
    float v111 = dot(g111, f - vec3(1, 1, 1));
    // value = v000 + kx u.x + ky u.y + kz u.z + kxy u.x u.y + kyz u.y u.z + kzx u.z u.x + kxyz u.x u.y u.z
    float kx = v100 - v000, ky = v010 - v000, kz = v001 - v000;
    float kxy = v000 - v100 - v010 + v110;
    float kyz = v000 - v010 - v001 + v011;
    float kzx = v000 - v100 - v001 + v101;
    float kxyz = -v000 + v100 + v010 - v110 + v001 - v101 - v011 + v111;
    float value = v000 + kx * u.x + ky * u.y + kz * u.z
                + kxy * u.x * u.y + kyz * u.y * u.z + kzx * u.z * u.x + kxyz * u.x * u.y * u.z;
    vec3 grad = g000 + (g100 - g000) * u.x + (g010 - g000) * u.y + (g001 - g000) * u.z
              + (g000 - g100 - g010 + g110) * u.x * u.y
              + (g000 - g010 - g001 + g011) * u.y * u.z
              + (g000 - g100 - g001 + g101) * u.z * u.x
              + (-g000 + g100 + g010 - g110 + g001 - g101 - g011 + g111) * u.x * u.y * u.z
              + du * vec3(kx + kxy * u.y + kzx * u.z + kxyz * u.y * u.z,
                          ky + kxy * u.x + kyz * u.z + kxyz * u.x * u.z,
                          kz + kyz * u.y + kzx * u.x + kxyz * u.x * u.y);
    return vec4(value, grad);
}

// ---- shader-skills library: sdf2d ----
// Unsigned distance to segment a-b. Subtract a width to get a stroke.
float sdSegment(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
}

// ---- shader-skills library: color ----
// Exact sRGB decode (EOTF): encoded [0,1] -> linear.
vec3 srgbToLinear(vec3 c) {
    c = max(c, 0.0);
    return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
// Exact sRGB encode (OETF): linear -> display [0,1]. Apply exactly once, after tonemapping. pow(c, 1/2.2) is visibly wrong near black (0.001 encodes to 0.013 here vs 0.043 with 2.2).
vec3 linearToSrgb(vec3 c) {
    c = max(c, 0.0);
    return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
// Cosine palette a + b * cos(2 pi (c t + d)). Output is display-like (sRGB-ish), so decode it for albedo. Integer c values loop seamlessly over t in [0,1].
vec3 cosinePalette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
    return a + b * cos(TAU * (c * t + d));
}

// ---- shader-skills library: tonemap ----
// AgX: log encoding plus a sigmoid inside an inset/outset gamut. Mid-grey 0.18 maps to about 0.5 display. Minimal implementation after Troy Sobotka's AgX and Benjamin Wrensch's polynomial fit (both MIT).
vec3 tonemapAgX(vec3 c) {
    const mat3 inset = mat3(0.842479062253094, 0.0423282422610123, 0.0423756549057051,
                            0.0784335999999992, 0.878468636469772, 0.0784336,
                            0.0792237451477643, 0.0791661274605434, 0.879142973793104);
    const mat3 outset = mat3(1.19687900512017, -0.0528968517574562, -0.0529716355144438,
                             -0.0980208811401368, 1.15190312990417, -0.0980434501171241,
                             -0.0990297440797205, -0.0989611768448433, 1.15107367264116);
    const float minEv = -12.47393, maxEv = 4.026069;
    c = inset * max(c, 0.0);
    c = clamp((log2(max(c, 1e-10)) - minEv) / (maxEv - minEv), 0.0, 1.0);
    vec3 x2 = c * c, x4 = x2 * x2;
    c = 15.5 * x4 * x2 - 40.14 * x4 * c + 31.96 * x4 - 6.868 * x2 * c + 0.4298 * x2 + 0.1191 * c - 0.00232;
    c = outset * c;
    return pow(max(c, 0.0), vec3(2.2));
}

// ---- shader ----
const float AURA_LIGHT = 0.55;
const float SHIELD_LIGHT = 0.72;
const float WATER_LIGHT = 0.65;
const float FLOW_SPEED = 0.18;

vec4 stateAt(int cell) { return texelFetch(iChannel1, ivec2(cell, 0), 0); }

float mistField(vec2 p, vec2 from, vec2 to, float side, float noise) {
    vec2 bend = mix(from, to, 0.5) + vec2(side * 0.12, -0.22);
    float d = min(sdSegment(p, from, bend), sdSegment(p, bend, to));
    float body = exp(-d * d / 0.018) + 0.35 * exp(-d * d / 0.080);
    return body * (0.36 + 0.64 * smoothstep(-0.40, 0.45, noise));
}

float shieldDistance(vec2 q) {
    vec2 st = vec2(q.x + 0.5, (q.y + 0.6) / 1.2);
    float d = (texture(iChannel0, clamp(st, vec2(0.0), vec2(1.0))).r - 0.5) * 0.28;
    float outside = length(max(abs(st - 0.5) - 0.5, vec2(0.0)));
    return outside > 0.0 ? max(d, outside) : d;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec4 g = stateAt(0);
    vec4 view = stateAt(1);
    vec4 cues = stateAt(2); // threads, comfort, water, protection
    vec4 mood = stateAt(3); // word, can, pendant, silver
    vec4 people = stateAt(4);
    vec4 ending = stateAt(5);
    vec4 phase = stateAt(6); // petals, shield formed, unused, active
    vec2 pixel = vec2(fragCoord.x, iResolution.y - fragCoord.y) / view.z + view.xy;
    vec2 q = (pixel - g.xy) / max(g.z, 1.0);
    float px = 1.0 / max(g.z * view.z, 1.0);
    vec2 flow = vec2(iTime * FLOW_SPEED, -iTime * FLOW_SPEED * 0.46);
    // Two restrained noise scales, shared by the light fields. No volume or ray marching.
    float n = gradientNoise(q * 3.1 + flow);
    float fine = gradientNoise(q * 7.4 - flow * 0.63);
    vec2 warped = q + vec2(n, fine) * 0.075;
    vec3 lavender = srgbToLinear(vec3(0.69, 0.67, 1.0));
    vec3 rose = srgbToLinear(vec3(1.0, 0.69, 0.80));
    vec3 silver = srgbToLinear(vec3(0.80, 0.88, 1.0));
    vec3 light = vec3(0.0);
    vec2 a = (people.xy - g.xy) / g.z;
    vec2 b = (people.zw - g.xy) / g.z;
    vec2 join = vec2(0.0, -0.80);
    float left = mistField(warped, a, join, -1.0, n + fine * 0.38);
    float right = mistField(warped, b, join, 1.0, fine - n * 0.25);
    light += (lavender * left + mix(rose, silver, mood.w) * right) * cues.x * AURA_LIGHT * 0.26;
    // A breathing halo is softly turbulent, rather than a geometric orbit.
    vec2 halo = q - vec2(0.0, -0.60);
    float haze = exp(-dot(halo, halo * vec2(2.0, 1.0)) * 4.8);
    light += mix(lavender, rose, cues.y * 0.7) * haze * (0.045 + n * 0.025) * g.w;

    float formed = phase.y;
    float angle = 0.04;
    mat2 turn = mat2(cos(angle), sin(angle), -sin(angle), cos(angle));
    vec2 sq = turn * (q - vec2(0.0, -0.48));
    sq /= vec2(0.91 + formed * 0.09, 0.93 + formed * 0.07);
    float d = shieldDistance(sq);
    float interior = 1.0 - smoothstep(-px * 1.4, px * 1.4, d);
    float edge = exp(-abs(d) * 105.0);
    float bloom = exp(-abs(d) * 34.0);
    // Pearlescent film: broad colour changes and a single formation reflection.
    float thinFilm = 0.45 + sq.x * 0.26 + sq.y * 0.17 + n * 0.18 + iTime * 0.018;
    vec3 pearl = srgbToLinear(cosinePalette(thinFilm,
        vec3(0.80, 0.78, 0.88), vec3(0.18, 0.20, 0.12),
        vec3(1.0), vec3(0.04, 0.30, 0.60)));
    float reflection = exp(-pow((sq.y + 0.52 - formed * 1.12) / 0.075, 2.0)) * (1.0 - formed);
    float surface = interior * (0.020 + 0.010 * sin(sq.x * 10.0 + sq.y * 7.0 + iTime * 0.42 + n));
    light += pearl * (edge * 0.58 + bloom * 0.15 + surface + reflection * interior * 0.38) * cues.w * SHIELD_LIGHT;

    // The water touches the word: a soft pulse of living light, below the unchanged flower/text.
    vec2 impact = warped - vec2(-0.10, -0.81);
    float heart = exp(-dot(impact, impact) * 63.0);
    float rising = exp(-dot(impact - vec2(0.02, -0.08), (impact - vec2(0.02, -0.08)) * vec2(1.8, 0.65)) * 28.0);
    float breath = 0.72 + 0.28 * sin((iTime - 136.52) * 4.0);
    light += mix(rose, silver, 0.55) * (heart * 0.55 + rising * 0.22) * breath * cues.z * WATER_LIGHT;
    light = mix(light, silver * dot(light, vec3(0.2126, 0.7152, 0.0722)), mood.w);
    light *= phase.w;
    float energy = max(light.r, max(light.g, light.b));
    // True premultiplied transparency. Outside the light field there are no opaque pixels or dither.
    float alpha = min(0.68, energy * 1.35);
    vec3 color = linearToSrgb(tonemapAgX(max(light * 2.1, vec3(0.0))));
    fragColor = vec4(color * alpha, alpha);
#if DEBUG_MODE == 1
    fragColor = vec4(vec3(clamp(0.5 + d * 4.0, 0.0, 1.0)), 1.0);
#elif DEBUG_MODE == 5
    fragColor = vec4(vec3(left, right, interior * cues.w), 1.0);
#endif
}
