"""Makes the outfit read clearly on the web: the white shirt, the plaid trousers, the belt and the shoes.

    python web/scripts/outfit_vrm.py web/public/models/avatar_v1.vrm web/public/models/avatar_v2.vrm

The VRoid shirt is a pure white texture whose folds, seams, pocket and button placket are only a
few levels below white, and its MToon shade colour is near white too: lit, it clips to flat white
(the page's ambient light adds on top) and in shade it barely darkens. The trousers' texture is
512 px, so the plaid and the belt go soft at the half-body shot. The white sneakers have the
shirt's trouble on a 256 px texture, and at full body they are only ~60 px wide on screen.

  shirt     its lit colour a step below white (near neutral, so it reads white) with a neutral grey
            shade, so the shading shows; the texture's own detail (folds, seams, pocket, placket)
            deepened by SHIRT_DETAIL
  trousers  texture doubled to 1024 px and sharpened; the plaid's contrast raised a little; the
            belt (the texture's darkest parts) darkened, so the buckle and the loops stand out;
            a deeper shade colour; stored as a 256-colour PNG (its alpha is a mask)
  shoes     as the shirt (a step below white, a neutral grey shade, the detail deepened: panels,
            laces, the sole's edge), on a texture doubled to 512 px, sharpened and mostly out of
            its cream tint (deepened, the cream read as dirty beige)
  outlines  a touch wider on the clothes, so the shirt's edge holds against the light backdrop

Everything else is copied as it is. Colours are given in sRGB and stored linear, as glTF wants.
"""

import argparse
import io
import sys
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter

sys.path.insert(0, str(Path(__file__).parent))
from optimize_vrm import read_glb, write_glb  # noqa: E402

SHIRT = {'color': '#EFEFF2', 'shade': '#B3B5BF', 'shift': 0.05, 'toony': 0.9}
TROUSERS = {'color': '#F2F2F2', 'shade': '#9A9CAB'}
SHOES = {'color': '#F5F5F7', 'shade': '#B4B6BF'}
CLOTH_OUTLINE = 0.0012           # outlineWidthFactor (VRoid: 0.0008)
SHIRT_DETAIL = 1.8               # how much deeper the shirt texture's shading gets (1 = as is)
SHOES_DETAIL, SHOES_PX, SHOES_SATURATION = 1.5, 512, 0.35   # the texture's cream tint, mostly out
TROUSERS_PX = 1024
PLAID_CONTRAST = 1.12
BELT_BELOW, BELT_DARKEN = 110, 0.72   # pixels darker than this (luminance) are the belt: x this


def linear(hex_colour):
    c = [int(hex_colour[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]


def deepen(img, k):
    """Each pixel's distance below white times k: faint shading painted on white gets stronger."""
    rgb, alpha = img.convert('RGBA').convert('RGB'), img.convert('RGBA').getchannel('A')
    rgb = rgb.point(lambda v: max(0, 255 - round((255 - v) * k)))
    out = rgb.convert('RGBA')
    out.putalpha(alpha)
    return out


def shoes(img):
    img = img.convert('RGBA').resize((SHOES_PX, SHOES_PX), Image.LANCZOS)
    alpha = img.getchannel('A')
    img = ImageEnhance.Color(img.convert('RGB')).enhance(SHOES_SATURATION).convert('RGBA')
    img.putalpha(alpha)
    img = deepen(img, SHOES_DETAIL)
    alpha = img.getchannel('A')
    rgb = img.convert('RGB').filter(ImageFilter.UnsharpMask(radius=1, percent=70, threshold=2))
    out = rgb.convert('RGBA')
    out.putalpha(alpha)
    return out


def trousers(img):
    img = img.convert('RGBA')
    alpha = img.getchannel('A').resize((TROUSERS_PX, TROUSERS_PX), Image.LANCZOS)
    rgb = img.convert('RGB').resize((TROUSERS_PX, TROUSERS_PX), Image.LANCZOS)
    rgb = rgb.filter(ImageFilter.UnsharpMask(radius=1.2, percent=80, threshold=2))
    rgb = ImageEnhance.Contrast(rgb).enhance(PLAID_CONTRAST)
    luma = rgb.convert('L')
    belt = luma.point(lambda v: 255 if v < BELT_BELOW else 0)
    rgb = Image.composite(rgb.point(lambda v: round(v * BELT_DARKEN)), rgb, belt)
    out = rgb.convert('RGBA')
    out.putalpha(alpha)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('dst')
    args = ap.parse_args()

    gltf, blob = read_glb(args.src)
    views, images = gltf['bufferViews'], gltf['images']

    def image_of(texture_index):
        return images[gltf['textures'][texture_index]['source']]

    def load(im):
        v = views[im['bufferView']]
        off = v.get('byteOffset', 0)
        return Image.open(io.BytesIO(blob[off:off + v['byteLength']]))

    replaced = {}                 # image index -> new PNG bytes
    done = set()
    for mat in gltf['materials']:
        mtoon = mat.get('extensions', {}).get('VRMC_materials_mtoon')
        pbr = mat.get('pbrMetallicRoughness', {})
        if mtoon is None or 'CLOTH' not in mat['name']:
            continue
        mtoon['outlineWidthFactor'] = CLOTH_OUTLINE
        name = mat['name']
        part = SHIRT if '_Tops_' in name else TROUSERS if '_Bottoms_' in name else SHOES if '_Shoes_' in name else None
        if part is None:
            continue
        pbr['baseColorFactor'] = linear(part['color']) + [1]
        mtoon['shadeColorFactor'] = linear(part['shade'])
        if 'shift' in part:
            mtoon['shadingShiftFactor'] = part['shift']
            mtoon['shadingToonyFactor'] = part['toony']
        # the base and shade textures are the same image in a VRoid export: edit it once
        src = gltf['images'].index(image_of(pbr['baseColorTexture']['index']))
        if src in done:
            continue
        done.add(src)
        img = load(images[src])
        img = deepen(img, SHIRT_DETAIL) if part is SHIRT else shoes(img) if part is SHOES else trousers(img)
        if part is TROUSERS:     # 256 colours hold the greys of the plaid: 1.7 MB -> ~0.2 MB, same look
            img = img.quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
        buf = io.BytesIO()
        img.save(buf, 'PNG', optimize=True)
        replaced[src] = buf.getvalue()
        print(f"{mat['name']}: image {src} {load(images[src]).size} -> {img.size}, {len(replaced[src]) // 1024} KB")

    # repack: every view as it was, the edited images as new views at the end, 4-byte aligned
    out = bytearray()
    new_views = []
    for v in views:
        off = v.get('byteOffset', 0)
        out += b'\0' * (-len(out) % 4)
        new_views.append(dict(v, byteOffset=len(out)))
        out += blob[off:off + v['byteLength']]
    for src, data in replaced.items():
        out += b'\0' * (-len(out) % 4)
        new_views.append({'buffer': 0, 'byteOffset': len(out), 'byteLength': len(data)})
        images[src]['bufferView'] = len(new_views) - 1
        images[src]['mimeType'] = 'image/png'
        out += data
    # drop the views nothing points to any more (the replaced images)
    used = {a['bufferView'] for a in gltf['accessors'] if 'bufferView' in a}
    for a in gltf['accessors']:
        if 'sparse' in a:
            used |= {a['sparse']['indices']['bufferView'], a['sparse']['values']['bufferView']}
    used |= {im['bufferView'] for im in images if 'bufferView' in im}
    keep = sorted(used)
    remap = {old: new for new, old in enumerate(keep)}
    packed = bytearray()
    final_views = []
    for old in keep:
        v = new_views[old]
        data = out[v['byteOffset']:v['byteOffset'] + v['byteLength']]
        packed += b'\0' * (-len(packed) % 4)
        final_views.append(dict(v, byteOffset=len(packed)))
        packed += data
    for a in gltf['accessors']:
        if 'bufferView' in a:
            a['bufferView'] = remap[a['bufferView']]
        if 'sparse' in a:
            for k in ('indices', 'values'):
                a['sparse'][k]['bufferView'] = remap[a['sparse'][k]['bufferView']]
    for im in images:
        if 'bufferView' in im:
            im['bufferView'] = remap[im['bufferView']]
    gltf['bufferViews'] = final_views
    gltf['buffers'] = [{'byteLength': len(packed)}]

    write_glb(args.dst, gltf, bytes(packed))
    print(f'{args.src}: {Path(args.src).stat().st_size / 1e6:.2f} MB -> {args.dst}: {Path(args.dst).stat().st_size / 1e6:.2f} MB')


if __name__ == '__main__':
    main()
