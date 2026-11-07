#define DEBUG_MODE 0
const float TAU = 6.28318530717959;
float dot2(vec2 v) { return dot(v, v); }
float dot2(vec3 v) { return dot(v, v); }
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
float hash11(float p) { return uintToUnit(pcgHash(uint(int(floor(p))))); }
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
vec3 hash33(vec3 p) { return uintToUnit(pcg3d(uvec3(ivec3(floor(p))))); }
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
vec2 latticeGradient(vec2 cell) {
float a = TAU * hash12(cell);
return vec2(cos(a), sin(a));
}
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
float gradientNoise(vec2 p) { return gradientNoiseD(p).x; }
float latticeGradDot(vec3 cell, vec3 corner, vec3 f) {
vec3 g = hash33(cell + corner) * 2.0 - 1.0;
return dot(g, f - corner);
}
float gradientNoise(vec3 p) {
vec3 i = floor(p), f = fract(p);
vec3 u = quinticFade(f);
return mix(mix(mix(latticeGradDot(i, vec3(0, 0, 0), f), latticeGradDot(i, vec3(1, 0, 0), f), u.x),
mix(latticeGradDot(i, vec3(0, 1, 0), f), latticeGradDot(i, vec3(1, 1, 0), f), u.x), u.y),
mix(mix(latticeGradDot(i, vec3(0, 0, 1), f), latticeGradDot(i, vec3(1, 0, 1), f), u.x),
mix(latticeGradDot(i, vec3(0, 1, 1), f), latticeGradDot(i, vec3(1, 1, 1), f), u.x), u.y), u.z);
}
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
const int FBM_MAX_OCTAVES = 12;
float fbm(vec2 p, int octaves, float lacunarity, float persistence) {
const mat2 octaveRotation = mat2(0.8, 0.6, -0.6, 0.8);
float sum = 0.0, amp = 1.0, norm = 0.0;
for (int i = 0; i < FBM_MAX_OCTAVES; i++) {
if (i >= octaves) break;
sum += amp * gradientNoise(p);
norm += amp;
amp *= persistence;
p = lacunarity * (octaveRotation * p) + vec2(17.13, -3.71);
}
return 1.4 * sum / norm;
}
float fbm(vec2 p, int octaves) { return fbm(p, octaves, 2.01, 0.5); }
float fbm(vec3 p, int octaves, float lacunarity, float persistence) {
const mat3 octaveRotation = mat3(0.00, 0.80, 0.60,
-0.80, 0.36, -0.48,
-0.60, -0.48, 0.64);
float sum = 0.0, amp = 1.0, norm = 0.0;
for (int i = 0; i < FBM_MAX_OCTAVES; i++) {
if (i >= octaves) break;
sum += amp * gradientNoise(p);
norm += amp;
amp *= persistence;
p = lacunarity * (octaveRotation * p) + vec3(17.13, -3.71, 5.29);
}
return sum / norm;
}
float sdQuadraticBezier(vec3 pos, vec3 A, vec3 B, vec3 C) {
vec3 a = B - A;
vec3 b = A - 2.0 * B + C;
vec3 c = a * 2.0;
vec3 d = A - pos;
float bb = dot(b, b);
if (bb < 1e-10) {
vec3 pa = pos - A, ca = C - A;
return length(pa - ca * clamp(dot(pa, ca) / dot(ca, ca), 0.0, 1.0));
}
float kk = 1.0 / bb;
float kx = kk * dot(a, b);
float ky = kk * (2.0 * dot(a, a) + dot(d, b)) / 3.0;
float kz = kk * dot(d, a);
float pp = ky - kx * kx;
float q = kx * (2.0 * kx * kx - 3.0 * ky) + kz;
float h = q * q + 4.0 * pp * pp * pp;
float res;
if (h >= 0.0) {
h = sqrt(h);
vec2 x = (vec2(h, -h) - q) / 2.0;
vec2 uv = sign(x) * pow(abs(x), vec2(1.0 / 3.0));
float t = clamp(uv.x + uv.y - kx, 0.0, 1.0);
res = dot2(d + (c + b * t) * t);
} else {
float z = sqrt(-pp);
float v = acos(clamp(q / (pp * z * 2.0), -1.0, 1.0)) / 3.0;
float m = cos(v);
float n = sin(v) * 1.7320508;
vec2 t = clamp(vec2(m + m, -n - m) * z - kx, 0.0, 1.0);
res = min(dot2(d + (c + b * t.x) * t.x), dot2(d + (c + b * t.y) * t.y));
}
return sqrt(res);
}
float sdSegment(vec2 p, vec2 a, vec2 b) {
vec2 pa = p - a, ba = b - a;
float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
return length(pa - ba * h);
}
float sdEllipse(vec2 p, vec2 r) {
float k0 = length(p / r);
float k1 = length(p / (r * r));
if (k1 < 1e-8) return -min(r.x, r.y);
return k0 * (k0 - 1.0) / k1;
}
float sdQuadraticBezier(vec2 pos, vec2 A, vec2 B, vec2 C) {
vec2 a = B - A;
vec2 b = A - 2.0 * B + C;
vec2 c = a * 2.0;
vec2 d = A - pos;
float bb = dot(b, b);
if (bb < 1e-10) return sdSegment(pos, A, C);
float kk = 1.0 / bb;
float kx = kk * dot(a, b);
float ky = kk * (2.0 * dot(a, a) + dot(d, b)) / 3.0;
float kz = kk * dot(d, a);
float pp = ky - kx * kx;
float q = kx * (2.0 * kx * kx - 3.0 * ky) + kz;
float h = q * q + 4.0 * pp * pp * pp;
float res;
if (h >= 0.0) {
h = sqrt(h);
vec2 x = (vec2(h, -h) - q) / 2.0;
vec2 uv = sign(x) * pow(abs(x), vec2(1.0 / 3.0));
float t = clamp(uv.x + uv.y - kx, 0.0, 1.0);
res = dot2(d + (c + b * t) * t);
} else {
float z = sqrt(-pp);
float v = acos(clamp(q / (pp * z * 2.0), -1.0, 1.0)) / 3.0;
float m = cos(v);
float n = sin(v) * 1.7320508;
vec2 t = clamp(vec2(m + m, -n - m) * z - kx, 0.0, 1.0);
res = min(dot2(d + (c + b * t.x) * t.x), dot2(d + (c + b * t.y) * t.y));
}
return sqrt(res);
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
const float STRIKE_EVERY = 8.0;
const float CHIMES = 3.0;
const float CHIME_GAP = 0.55;
const float STRIKE_FLASH = 0.9;
const float RING_BRIGHT = 1.1;
const float RING_WIDTH = 0.010;
const float RING_LIFE = 5.0;
const float RING_REACH = 1.25;
const float RING_SQUASH = 0.42;
const float RING_WOBBLE = 0.05;
const float RING_BREAKS = 2.2;
const float GLINT = 1.4;
const float REFRACT = 0.012;
const float RUNE_GLOW = 0.8;
const float RUNE_PULSE = 0.5;
const float CLOUD_DRIFT = 0.018;
const float CLOUD_SPEED = 0.07;
const float NOTE_COUNT = 7.0;
const float NOTE_SIZE = 0.040;
const float NOTE_LIFE = 9.0;
const float NOTE_BRIGHT = 0.9;
const float BELL_X = 0.0;
const float BELL_Y = 0.46;
const float TOWER_HALF_W = 0.385;
const float SPIRE_TOP = 0.94;
uniform float TAP_TIME;
const vec3 GOLD = vec3(1.00, 0.83, 0.52);
const vec3 SILVER = vec3(0.86, 0.90, 1.00);
const vec3 LILAC = vec3(0.82, 0.62, 1.00);
const vec3 ROSE = vec3(1.00, 0.62, 0.78);
float towerMask(vec2 uv) {
float body = mix(TOWER_HALF_W, TOWER_HALF_W * 0.46, smoothstep(0.09, 0.39, uv.y));
float spire = TOWER_HALF_W * 0.46 * (1.0 - smoothstep(0.39, SPIRE_TOP, uv.y));
float halfWidth = uv.y < 0.39 ? body : spire;
return 1.0 - smoothstep(-0.02, 0.02, abs(uv.x) - halfWidth);
}
float ring(vec2 p, float age, float seed, out float band, out float farSide) {
band = 0.0;
farSide = 0.0;
float life = age / RING_LIFE;
if (life <= 0.0 || life >= 1.0) return 0.0;
vec2 q = vec2(p.x, p.y / RING_SQUASH);
float r = length(q);
vec2 dir = q / max(r, 1e-4);
float radius = RING_REACH * (1.0 - pow(1.0 - life, 2.2));
float width = RING_WIDTH * mix(1.0, 2.6, life);
float rough = r - radius;
float reach = RING_WOBBLE + width * 7.0;
float fade = smoothstep(0.0, 0.05, life) * pow(1.0 - life, 1.5);
if (abs(rough) > reach) return 0.0;
float wobble = RING_WOBBLE * (valueNoise(dir * 1.7 + seed * 17.0 + iTime * 0.12) - 0.5) * 2.0;
float d = rough - wobble;
float line = exp(-d * d / (width * width));
float arcs = smoothstep(0.34, 0.62, valueNoise(dir * RING_BREAKS + seed * 31.0 + vec2(0.0, iTime * 0.08)));
band = exp(-d * d / (width * width * 40.0)) * fade;
farSide = smoothstep(-0.03, 0.03, q.y);
return line * arcs * fade;
}
float sdNote(vec2 p, float size, float hasFlag) {
vec2 h = p / size;
float c = cos(0.35);
float s = sin(0.35);
vec2 tilted = vec2(c * h.x + s * h.y, c * h.y - s * h.x);
float head = sdEllipse(tilted, vec2(0.62, 0.42));
float stem = sdSegment(h, vec2(0.56, 0.1), vec2(0.56, 2.3)) - 0.075;
float d = min(head, stem);
if (hasFlag > 0.5) {
float flag = sdQuadraticBezier(h, vec2(0.56, 2.3), vec2(1.35, 1.7), vec2(1.15, 0.95)) - 0.08;
d = min(d, flag);
}
return d * size;
}
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
vec2 uv = (2.0 * fragCoord - iResolution.xy) / iResolution.y;
float px = 2.0 / iResolution.y;
vec2 bell = vec2(BELL_X, BELL_Y);
vec2 p = uv - bell;
float tower = towerMask(uv);
float line = 0.0;
float band = 0.0;
vec3 ringLight = vec3(0.0);
float slot = floor(iTime / STRIKE_EVERY);
float flash = 0.0;
for (int s = 0; s < 4; s++) {
float born = s < 3 ? (slot - float(s)) * STRIKE_EVERY : TAP_TIME;
if (born < -50.0) continue;
if (iTime >= born) flash = max(flash, exp(-(iTime - born) * 4.5));
float strikeSeed = s < 3 ? hash11(slot - float(s) + 40.0) : hash11(floor(TAP_TIME * 3.0) + 7.0);
for (int c = 0; c < 6; c++) {
if (float(c) >= CHIMES) break;
float seed = strikeSeed + float(c) * 0.37;
float b;
float farSide;
float value = ring(p, iTime - born - float(c) * CHIME_GAP, seed, b, farSide);
float hidden = farSide * tower;
value *= 1.0 - hidden;
line += value;
band = max(band, b * (1.0 - hidden * 0.6));
vec3 tint = mix(srgbToLinear(GOLD), srgbToLinear(SILVER), hash11(float(c) + 3.0));
ringLight += tint * value;
}
}
float cloud = (1.0 - tower) * (1.0 - smoothstep(0.35, 1.15, length(p * vec2(0.8, 1.2))));
vec2 drift = vec2(fbm(uv * 2.2 + iTime * CLOUD_SPEED, 3),
fbm(uv * 2.2 + vec2(7.3, 2.1) - iTime * CLOUD_SPEED * 0.8, 3));
vec2 radial = normalize(p + vec2(1e-4, 1e-4));
vec2 offset = drift * CLOUD_DRIFT * cloud + radial * band * REFRACT * (1.0 - tower);
vec3 base = srgbToLinear(texture(iChannel0, clamp(uv + offset, -1.0, 1.0) * 0.5 + 0.5).rgb);
float luma = dot(base, vec3(0.2126, 0.7152, 0.0722));
float runes = tower * smoothstep(0.03, 0.18, base.b - base.r) * smoothstep(0.08, 0.45, luma);
float pulse = 0.5 + 0.5 * sin(iTime * RUNE_PULSE * 6.2832);
vec3 added = base * runes * RUNE_GLOW * (0.25 + 0.75 * pulse + band * 2.0);
float twinkle = valueNoise(uv * 70.0 + iTime * 1.5);
twinkle *= twinkle;
float highlights = smoothstep(0.2, 0.75, luma);
added += srgbToLinear(SILVER) * highlights * band * GLINT * (0.35 + twinkle * 2.0);
added += ringLight * RING_BRIGHT;
added += srgbToLinear(GOLD) * flash * STRIKE_FLASH * exp(-dot(p, p) / 0.09);
for (int i = 0; i < 12; i++) {
if (float(i) >= NOTE_COUNT) break;
float id = float(i) + 1.0;
float cycle = iTime / NOTE_LIFE + hash11(id * 3.1);
float age = fract(cycle);
float round_ = floor(cycle);
float seed = hash12(vec2(id, round_));
float side = seed < 0.5 ? -1.0 : 1.0;
float startX = side * (0.42 + 0.34 * hash12(vec2(id + 9.0, round_)));
float startY = -0.75 + 1.25 * hash12(vec2(id + 17.0, round_));
vec2 pos = vec2(startX + 0.05 * sin(age * 7.0 + id) + side * age * 0.12, startY + age * 0.45);
float sway = 0.35 * sin(age * 5.0 + id * 2.0);
vec2 local = uv - pos;
float cs = cos(sway);
float sn = sin(sway);
local = vec2(cs * local.x + sn * local.y, cs * local.y - sn * local.x);
float scale = NOTE_SIZE * (0.75 + 0.5 * hash12(vec2(id + 23.0, round_)));
if (dot(local, local) > scale * scale * 36.0) continue;
float d = sdNote(local, scale, step(0.4, hash12(vec2(id + 31.0, round_))));
float core = 1.0 - smoothstep(0.0, px * 1.5, d);
float glow = exp(-max(d, 0.0) * 55.0) * 0.45;
float fade = sin(age * 3.14159);
float pick = hash12(vec2(id + 41.0, round_));
vec3 tint = pick < 0.34 ? GOLD : (pick < 0.67 ? LILAC : ROSE);
added += srgbToLinear(tint) * (core + glow) * fade * fade * NOTE_BRIGHT;
}
#if DEBUG_MODE == 1
vec3 col = added;
#elif DEBUG_MODE == 5
vec3 col = mix(base, vec3(tower, runes, cloud), 0.55);
#else
vec3 col = base + added * (1.0 - base);
#endif
col = linearToSrgb(col);
col += ditherTPDF(fragCoord, iFrame);
fragColor = vec4(col, 1.0);
}
