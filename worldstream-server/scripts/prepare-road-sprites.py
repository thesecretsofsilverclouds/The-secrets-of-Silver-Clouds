"""Extract literal uploaded footage; no image generation or redrawing.

Background extraction is a deterministic border flood-fill, preserving enclosed
light/dark parts of the original creature. Cropping and uniform scaling retain
the original run poses. Originals are read-only and are never moved or changed.
"""
from pathlib import Path
import subprocess, json, hashlib
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
AUDIT = ROOT / 'artifacts/road-sprite-audit'
PUBLIC = ROOT / 'public/ambient'
FFMPEG = ROOT.parent / 'tools/py-venv/Lib/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
DOWNLOADS = Path('C:/Users/chris/Downloads')
SOURCES = [
    ('orange', '552762317087035400', 4.0, 'white'),
    ('shades', '552762484808896521', 7.0, 'black'),
    ('blue', '552759199028875264', 9.0, 'mixed'),
    ('purple', '552759231069147144', 1.5, 'white'),
]
FRAMES, WIDTH, HEIGHT, BASELINE = 24, 192, 224, 218
AUDIT.mkdir(parents=True, exist_ok=True)
PUBLIC.mkdir(parents=True, exist_ok=True)

def components(mask):
    """Run-length union/find, avoiding an optional scientific-image dependency."""
    result = np.zeros(mask.shape, dtype=np.int32)
    parents = [0]
    previous = []
    def root(label):
        while parents[label] != label:
            parents[label] = parents[parents[label]]
            label = parents[label]
        return label
    for y, row in enumerate(mask):
        edges = np.flatnonzero(np.diff(np.r_[False, row, False].astype(np.int8)))
        current = []
        for left, right in zip(edges[::2], edges[1::2]):
            overlaps = [tag for start, end, tag in previous if end > left and start < right]
            if overlaps:
                tag = root(overlaps[0])
                for other in overlaps[1:]: parents[root(other)] = tag
            else:
                tag = len(parents); parents.append(tag)
            result[y, left:right] = tag
            current.append((left, right, tag))
        previous = current
    lookup = np.array([root(index) for index in range(len(parents))], dtype=np.int32)
    return lookup[result]

def transparent_subject(image, key):
    rgb = np.asarray(image.convert('RGB')).copy()
    high, low = rgb.max(axis=2), rgb.min(axis=2)
    white = (low > 222) & ((high.astype(int)-low) < 25)
    black = high < 4
    background = white if key == 'white' else black if key == 'black' else white | black
    # Close tiny codec gaps in the silhouette before flood-fill, so genuinely
    # black trousers cannot be mistaken for outside black through a pinhole.
    solid = Image.fromarray((~background).astype(np.uint8)*255)
    solid = solid.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))
    background = np.asarray(solid) == 0
    regions = components(background)
    border = np.unique(np.r_[regions[0, :], regions[-1, :], regions[:, 0], regions[:, -1]])
    outside = np.isin(regions, border[border != 0])
    foreground = ~outside
    regions = components(foreground)
    sizes = np.bincount(regions.ravel()); sizes[0] = 0
    main = regions == sizes.argmax()
    if key == 'white':
        opened = Image.fromarray(main.astype(np.uint8)*255).filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(5))
        main &= np.asarray(opened) > 0
    alpha = main.astype(np.float32)
    # Remove only the near-white matte at the outside edge; enclosed highlights
    # and the original face/eyes remain opaque and retain their source pixels.
    if key in ('white', 'mixed'):
        inner = np.asarray(Image.fromarray(main.astype(np.uint8)*255).filter(ImageFilter.MinFilter(5))) > 0
        edge = main & ~inner & (low > 130) & ((high.astype(int)-low) < 65)
        alpha[edge] = np.clip((255-low[edge].astype(np.float32))/125, 0.05, 1)
        values = rgb[edge].astype(np.float32)
        rgb[edge] = np.clip(255+(values-255)/alpha[edge,None], 0, 255).astype(np.uint8)
    # Keep only the physical creature component, not isolated codec specks or
    # floor shadows. The source artwork inside that silhouette stays untouched.
    rgba = np.dstack([rgb, (alpha*255).astype(np.uint8)])
    result = Image.fromarray(rgba, 'RGBA')
    return result.crop(result.getchannel('A').getbbox())

manifest = {'version': 1, 'provenance': 'Literal frames extracted from user-supplied Hailuo videos; existing sleeping PNGs.',
            'runners': [], 'sleepers': []}
for name, identifier, start, key in SOURCES:
    source = DOWNLOADS / f'Hailuo_Video_Anime creature desktop HD 4k a_{identifier}.mp4'
    approved = name in ('orange', 'shades')
    destination = PUBLIC if approved else AUDIT / 'candidates'
    destination.mkdir(exist_ok=True)
    raw = AUDIT / f'raw-{name}'; raw.mkdir(exist_ok=True)
    subprocess.run([str(FFMPEG), '-hide_banner', '-loglevel', 'error', '-y', '-ss', str(start),
        '-i', str(source), '-vf', 'scale=1280:720', '-frames:v', str(FRAMES), str(raw / '%02d.png')], check=True)
    crops = [transparent_subject(Image.open(raw / f'{index:02d}.png'), key) for index in range(1, FRAMES+1)]
    factor = min((WIDTH-12) / max(image.width for image in crops), (HEIGHT-16) / max(image.height for image in crops))
    frames = []
    for crop in crops:
        crop = crop.resize((round(crop.width*factor), round(crop.height*factor)), Image.Resampling.LANCZOS)
        frame = Image.new('RGBA', (WIDTH, HEIGHT))
        frame.alpha_composite(crop, ((WIDTH-crop.width)//2, BASELINE-crop.height))
        frames.append(frame)
    # Choose the nearest returning pose after at least half a second. The next
    # source frame is the seam reference, not duplicated as a held final frame.
    small = [np.asarray(frame.resize((48,56))).astype(np.float32) for frame in frames]
    seam = min(range(12, FRAMES), key=lambda index: np.mean(np.abs(small[0]-small[index])))
    frames = frames[:seam]
    strip = Image.new('RGBA', (WIDTH*len(frames), HEIGHT))
    for index, frame in enumerate(frames): strip.alpha_composite(frame, (index*WIDTH, 0))
    strip_path = destination / f'road-sprite-{name}-run-strip.webp'
    strip.save(strip_path, 'WEBP', quality=88, method=6)
    frames[0].save(destination / f'road-sprite-{name}-still.webp', 'WEBP', quality=88, method=6)
    frames[0].save(destination / f'road-sprite-{name}-run.webp', 'WEBP', save_all=True, append_images=frames[1:],
                   duration=[42 if index%3 != 2 else 41 for index in range(len(frames))], loop=0, quality=88, method=6)
    proof = Image.new('RGB', (WIDTH*6, HEIGHT*((len(frames)+5)//6)), '#071421')
    for index, frame in enumerate(frames):
        if index % 6 >= 3:
            tile = Image.new('RGBA', (WIDTH, HEIGHT), '#d1d5df'); tile.alpha_composite(frame)
            proof.paste(tile.convert('RGB'), ((index%6)*WIDTH, (index//6)*HEIGHT))
        else: proof.paste(frame, ((index%6)*WIDTH, (index//6)*HEIGHT), frame)
    proof.save(AUDIT / f'keyed-{name}-proof.jpg', quality=95)
    manifest['runners'].append({'id': name, 'source': str(source), 'sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
        'sourceStartSeconds': start, 'sourceFrames': len(frames), 'sourceFps': 24, 'backgroundKey': key,
        'frameWidth': WIDTH, 'frameHeight': HEIGHT, 'baseline': BASELINE, 'durationMs': round(len(frames)*1000/24),
        'frames': len(frames), 'fps': 24, 'facing': 'right', 'approved': approved,
        'url': f'/ambient/{strip_path.name}' if approved else None,
        'animated': f'/ambient/road-sprite-{name}-run.webp' if approved else None,
        'fallback': f'/ambient/road-sprite-{name}-still.webp' if approved else None,
        'outputPath': str(strip_path), 'stripBytes': strip_path.stat().st_size,
        'sourceCropSizes': [image.size for image in crops], 'uniformScale': factor})

for name, file in [('orange', 'night-sleeping-roadsprite.png'), ('shades', 'night-sleeping-roadsprite-shades.png')]:
    source = ROOT / 'Assets' / file
    image = Image.open(source).convert('RGBA')
    box = image.getchannel('A').getbbox(); cropped = image.crop(box)
    cropped.thumbnail((512, 512), Image.Resampling.LANCZOS)
    output = PUBLIC / f'road-sprite-{name}-sleep.webp'
    cropped.save(output, 'WEBP', quality=90, method=6)
    manifest['sleepers'].append({'id': name, 'source': str(source), 'sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
        'url': f'/ambient/{output.name}', 'width': cropped.width, 'height': cropped.height,
        'sourceAlphaBounds': box, 'bytes': output.stat().st_size, 'bakedZzz': name == 'shades'})
(AUDIT / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
# The public renderer receives only the two approved characters, dimensions and
# URLs. Local download paths and audit-only variants never enter its manifest.
public = {'version': 1,
    'runners': [{key: row[key] for key in ['id','url','frameWidth','frameHeight','frames','fps','facing','fallback','baseline']}
                for row in manifest['runners'] if row['id'] in ('orange','shades')],
    'sleepers': [{key: row[key] for key in ['id','url','width','height','bakedZzz']} for row in manifest['sleepers']]}
(PUBLIC / 'road-sprites.json').write_text(json.dumps(public, indent=2), encoding='utf-8')
print(json.dumps(public, indent=2))
