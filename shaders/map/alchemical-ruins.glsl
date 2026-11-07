#define DEBUG_MODE 0
uint pcgHash(uint v) {
uint state = v * 747796405u + 2891336453u;
uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
return (word >> 22u) ^ word;
}
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
float uintToUnit(uint h) { return float(h >> 8u) * (1.0 / 16777216.0); }
vec2 uintToUnit(uvec2 h) { return vec2(h >> 8u) * (1.0 / 16777216.0); }
vec3 uintToUnit(uvec3 h) { return vec3(h >> 8u) * (1.0 / 16777216.0); }
vec4 uintToUnit(uvec4 h) { return vec4(h >> 8u) * (1.0 / 16777216.0); }
float hash12(vec2 p) {
uvec2 q = uvec2(ivec2(floor(p)));
return uintToUnit(pcgHash(q.x + pcgHash(q.y)));
}
float hash13(vec3 p) {
uvec3 q = uvec3(ivec3(floor(p)));
return uintToUnit(pcgHash(q.x + pcgHash(q.y + pcgHash(q.z))));
}
vec2 hash22(vec2 p) {
ivec2 q = ivec2(floor(p));
return uintToUnit(pcg3d(uvec3(q.x, q.y, 0x2545u))).xy;
}
vec2 quinticFade(vec2 f) { return f * f * f * (f * (f * 6.0 - 15.0) + 10.0); }
vec3 quinticFade(vec3 f) { return f * f * f * (f * (f * 6.0 - 15.0) + 10.0); }
vec2 quinticFadeDeriv(vec2 f) { return 30.0 * f * f * (f * (f - 2.0) + 1.0); }
vec3 quinticFadeDeriv(vec3 f) { return 30.0 * f * f * (f * (f - 2.0) + 1.0); }
vec3 valueNoiseD(vec2 p) {
vec2 i = floor(p), f = fract(p);
vec2 u = quinticFade(f), du = quinticFadeDeriv(f);
float a = hash12(i);
float b = hash12(i + vec2(1.0, 0.0));
float c = hash12(i + vec2(0.0, 1.0));
float d = hash12(i + vec2(1.0, 1.0));
float k1 = b - a, k2 = c - a, k3 = a - b - c + d;
return vec3(a + k1 * u.x + k2 * u.y + k3 * u.x * u.y,
du * vec2(k1 + k3 * u.y, k2 + k3 * u.x));
}
float valueNoise(vec2 p) { return valueNoiseD(p).x; }
float valueNoise(vec3 p) {
vec3 i = floor(p), f = fract(p);
vec3 u = quinticFade(f);
return mix(mix(mix(hash13(i + vec3(0, 0, 0)), hash13(i + vec3(1, 0, 0)), u.x),
mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), u.x), u.y),
mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), u.x),
mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), u.x), u.y), u.z);
}
vec3 srgbToLinear(vec3 c) {
c = max(c, 0.0);
return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
vec3 linearToSrgb(vec3 c) {
c = max(c, 0.0);
return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
float luminance(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 saturation(vec3 c, float s) { return mix(vec3(luminance(c)), c, s); }
vec3 ditherTPDF(vec2 fragCoord, int frame) {
vec2 r = hash22(vec2(floor(fragCoord) + 7919.0 * float(frame % 1024)));
return vec3((r.x + r.y - 1.0) / 255.0);
}
const float FLOW_REACH = 0.03;
const float FLOW_CYCLE = 8.0;
const float CAMERA_ZOOM = 0.03;
const float CAMERA_CYCLE = 24.0;
const float WOBBLE = 0.002;
const float WOBBLE_SPEED = 0.5;
const float WOBBLE_SCALE = 7.0;
const float FLICKER = 0.3;
const float FLICKER_SPEED = 3.0;
const float FLICKER_SCALE = 5.0;
const float GLOW_PULSE = 0.45;
const float PULSE_SPEED = 0.35;
const float GLOW_FROM = 0.15;
const float SPARK_AMOUNT = 0.22;
const float SPARK_SIZE = 0.004;
const float SPARK_RISE = 0.012;
const float SPARK_SIDE = 0.005;
const float SPARK_LIFE = 5.0;
const float SPARK_BRIGHT = 0.7;
const float SPARK_R = 0.98;
const float SPARK_G = 0.84;
const float SPARK_B = 0.58;
const float TAP_SURGE = 1.0;
uniform float TAP_TIME;
vec3 sparks(vec2 uv01, float surge) {
vec3 total = vec3(0.0);
for (int layer = 0; layer < 2; layer++) {
float density = layer == 0 ? 12.0 : 19.0;
float slow = layer == 0 ? 1.0 : 0.7;
vec2 travel = vec2(SPARK_SIDE, SPARK_RISE) * slow * iTime;
vec2 q = (uv01 - travel) * density;
vec2 cell = floor(q);
vec2 id = mod(cell, 4096.0) + float(layer) * 37.0 + 200.0;
float seed = hash12(id);
if (seed > SPARK_AMOUNT) continue;
vec2 jitter = (hash22(id + 11.0) - 0.5) * 0.6;
vec2 local = (fract(q) - 0.5 - jitter) / density;
float size = SPARK_SIZE * (0.6 + 0.8 * hash12(id + 23.0));
float dist = length(local);
if (dist > size * 3.0) continue;
vec2 home = (cell + 0.5 + jitter) / density + travel;
float moving = textureLod(iChannel1, home, 0.0).b;
vec3 paint = textureLod(iChannel0, home, 3.0).rgb;
float glow = smoothstep(0.08, 0.35, max(max(paint.r, paint.g), paint.b) - min(min(paint.r, paint.g), paint.b));
float allowed = max(moving, glow * 0.7);
float age = fract(iTime / SPARK_LIFE + seed * 7.13);
float fade = sin(age * 3.14159);
float core = exp(-dist * dist / (size * size));
total += vec3(SPARK_R, SPARK_G, SPARK_B) * core * fade * fade * allowed;
}
return srgbToLinear(total) * SPARK_BRIGHT * (1.0 + surge * 3.0);
}
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
vec2 screen = fragCoord / iResolution.xy;
float push = 0.5 - 0.5 * cos(iTime / CAMERA_CYCLE * 6.2832);
vec2 uv01 = 0.5 + (screen - 0.5) * (1.0 - CAMERA_ZOOM * push);
vec3 motion = texture(iChannel1, uv01).rgb;
vec2 drift = (motion.rg - 0.5) * 2.0;
float energy = motion.b;
float surge = iTime >= TAP_TIME && TAP_TIME > -50.0 ? exp(-(iTime - TAP_TIME) * 2.5) : 0.0;
vec2 shimmer = vec2(valueNoise(uv01 * WOBBLE_SCALE + vec2(0.0, iTime * WOBBLE_SPEED)),
valueNoise(uv01 * WOBBLE_SCALE + vec2(11.3, -iTime * WOBBLE_SPEED * 0.9))) - 0.5;
vec2 offset = shimmer * 2.0 * WOBBLE * energy * (1.0 + surge * 2.0);
float phaseA = fract(iTime / FLOW_CYCLE);
float phaseB = fract(phaseA + 0.5);
vec2 reach = drift * FLOW_REACH;
vec3 layerA = srgbToLinear(texture(iChannel0, uv01 - reach * (phaseA - 0.5) + offset).rgb);
vec3 layerB = srgbToLinear(texture(iChannel0, uv01 - reach * (phaseB - 0.5) + offset).rgb);
vec3 base = mix(layerA, layerB, abs(2.0 * phaseA - 1.0));
float peak = max(max(base.r, base.g), base.b);
float saturation = peak - min(min(base.r, base.g), base.b);
float glowing = smoothstep(GLOW_FROM, GLOW_FROM + 0.35, peak) * smoothstep(0.04, 0.25, saturation);
float flicker = valueNoise(vec3(uv01 * FLICKER_SCALE, iTime * FLICKER_SPEED)) * 2.0 - 1.0;
float breath = 0.5 + 0.5 * sin(iTime * PULSE_SPEED * 6.2832);
vec3 lit = base * max(1.0 + FLICKER * energy * flicker, 0.0);
vec3 added = lit * glowing * GLOW_PULSE * breath;
added += lit * (glowing + energy * 0.5) * surge * TAP_SURGE;
added += sparks(uv01, surge);
#if DEBUG_MODE == 1
vec3 col = added;
#elif DEBUG_MODE == 5
vec3 col = srgbToLinear(motion);
#else
vec3 col = lit + added * (1.0 - min(lit, vec3(1.0)));
#endif
col = linearToSrgb(col);
col += ditherTPDF(fragCoord, iFrame);
fragColor = vec4(col, 1.0);
}
