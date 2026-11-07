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
vec3 ditherTPDF(vec2 fragCoord, int frame) {
vec2 r = hash22(vec2(floor(fragCoord) + 7919.0 * float(frame % 1024)));
return vec3((r.x + r.y - 1.0) / 255.0);
}
const float FLOW_REACH = 0.059;
const float FLOW_CYCLE = 5.8;
const float WOBBLE = 0.0025;
const float WOBBLE_SPEED = 0.12;
const float CAMERA_ZOOM = 0.025;
const float CAMERA_CYCLE = 40.0;
const float RAY_SHIMMER = 0.55;
const float RAY_GLOW = 0.3;
const float RAY_SPREAD = 0.8;
const float RAY_COUNT = 30.0;
const float RAY_SPEED = 0.222;
const float RAY_REACH = 1.25;
const float SOURCE_Y = 1.6;
const float STARS = 0.5;
uniform float TINT_AMOUNT;
uniform float TINT_R;
uniform float TINT_G;
uniform float TINT_B;
uniform float VIEW_X;
uniform float VIEW_Y;
uniform float TAP_TIME;
const float IMAGE_ASPECT = 1.7778;
const float PARALLAX = 0.025;
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
vec2 screen = fragCoord / iResolution.xy;
vec2 uv = (2.0 * fragCoord - iResolution.xy) / iResolution.y;
float aspect = iResolution.x / iResolution.y;
vec2 cover = aspect > IMAGE_ASPECT ? vec2(1.0, IMAGE_ASPECT / aspect) : vec2(aspect / IMAGE_ASPECT, 1.0);
float push = 0.5 - 0.5 * cos(iTime / CAMERA_CYCLE * 6.2832);
float margin = 1.0 - PARALLAX * 2.5 - CAMERA_ZOOM * push;
vec2 uv01 = 0.5 + (screen - 0.5) * cover * margin + vec2(VIEW_X, VIEW_Y) * PARALLAX;
vec3 motion = texture(iChannel1, uv01).rgb;
vec2 drift = (motion.rg - 0.5) * 2.0;
float energy = motion.b;
vec2 shimmer = vec2(valueNoise(uv01 * 6.0 + vec2(0.0, iTime * WOBBLE_SPEED)),
valueNoise(uv01 * 6.0 + vec2(11.3, -iTime * WOBBLE_SPEED * 0.9))) - 0.5;
vec2 offset = shimmer * 2.0 * WOBBLE * (0.35 + energy);
float phaseA = fract(iTime / FLOW_CYCLE);
float phaseB = fract(phaseA + 0.5);
vec2 reach = drift * FLOW_REACH;
vec3 layerA = srgbToLinear(texture(iChannel0, uv01 - reach * (phaseA - 0.5) + offset).rgb);
vec3 layerB = srgbToLinear(texture(iChannel0, uv01 - reach * (phaseB - 0.5) + offset).rgb);
vec3 base = mix(layerA, layerB, abs(2.0 * phaseA - 1.0));
float surge = iTime >= TAP_TIME && TAP_TIME > -50.0 ? exp(-(iTime - TAP_TIME) * 1.6) : 0.0;
vec2 d = uv - vec2(VIEW_X * -0.05, SOURCE_Y);
float dist = length(d);
float angle = atan(d.x, -d.y);
float fan = (1.0 - smoothstep(RAY_SPREAD * 0.35, RAY_SPREAD, abs(angle))) * exp(-dist * 1.1 / RAY_REACH);
float rt = iTime * RAY_SPEED;
float streakA = valueNoise(vec2(angle * RAY_COUNT, rt));
float streakB = valueNoise(vec2(angle * RAY_COUNT * 2.7 + 9.0, rt * 1.4));
float streaks = streakA * 0.65 + streakB * 0.45;
vec3 lit = base * (1.0 + fan * (streaks - 0.55) * 2.0 * RAY_SHIMMER);
vec3 added = base * fan * streaks * RAY_GLOW * (1.0 + surge * 3.0);
float peak = max(max(base.r, base.g), base.b);
vec3 tint = srgbToLinear(vec3(TINT_R, TINT_G, TINT_B));
float tintWeight = TINT_AMOUNT * smoothstep(0.015, 0.35, peak);
lit = mix(lit, dot(lit, vec3(0.2126, 0.7152, 0.0722)) * tint * 2.4, tintWeight * 0.8);
added *= mix(vec3(1.0), tint * 1.6, TINT_AMOUNT);
added += lit * smoothstep(0.03, 0.4, peak) * surge * 0.8;
vec2 starGrid = uv * 40.0;
vec2 starCell = floor(starGrid);
vec2 starId = mod(starCell, 4096.0) + 9.0;
float starSeed = hash12(starId);
if (starSeed > 0.92) {
vec2 starOffset = fract(starGrid) - 0.5 - (hash22(starId + 3.0) - 0.5) * 0.7;
float twinkle = 0.5 + 0.5 * sin(iTime * (0.6 + starSeed * 2.0) + starSeed * 40.0);
added += vec3(0.8, 0.86, 1.0) * exp(-dot(starOffset, starOffset) * 140.0) * twinkle * twinkle * STARS * (1.0 - smoothstep(0.02, 0.12, peak));
}
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
