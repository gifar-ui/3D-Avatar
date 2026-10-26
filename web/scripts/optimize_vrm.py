"""Lossless size pass over the VRoid export before it ships to the web.

    python web/scripts/optimize_vrm.py vroid/avatar_v1.vrm web/public/models/avatar_v1.vrm

  morph targets  VRoid stores every face shape key densely: 57 keys x 4243 vertices x
                 (position + normal), almost all zeros. Each one is rewritten as a glTF
                 sparse accessor (only the vertices it moves), which three.js reads back
                 into exactly the same arrays.
  thumbnail      the VRM meta thumbnail (only shown by VRM tools, never rendered) is
                 shrunk to 256 px.

Everything else (meshes, textures, materials, VRM extensions) is copied byte for byte.
"""

import argparse
import io
import json
import struct
from pathlib import Path

from PIL import Image

FLOAT, U16, U32 = 5126, 5123, 5125
THUMB_PX = 256


def read_glb(path):
    data = Path(path).read_bytes()
    magic, _, _ = struct.unpack_from('<4sII', data, 0)
    assert magic == b'glTF', 'not a GLB file'
    json_len, _ = struct.unpack_from('<II', data, 12)
    gltf = json.loads(data[20:20 + json_len])
    bin_len, _ = struct.unpack_from('<II', data, 20 + json_len)
    bin_start = 28 + json_len
    return gltf, data[bin_start:bin_start + bin_len]


def write_glb(path, gltf, bin_chunk):
    js = json.dumps(gltf, separators=(',', ':'), ensure_ascii=False).encode()
    js += b' ' * (-len(js) % 4)
    bin_chunk += b'\0' * (-len(bin_chunk) % 4)
    total = 12 + 8 + len(js) + 8 + len(bin_chunk)
    out = struct.pack('<4sII', b'glTF', 2, total)
    out += struct.pack('<II', len(js), 0x4E4F534A) + js
    out += struct.pack('<II', len(bin_chunk), 0x004E4942) + bin_chunk
    Path(path).write_bytes(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('dst')
    args = ap.parse_args()

    gltf, blob = read_glb(args.src)
    views = gltf['bufferViews']
    accessors = gltf['accessors']
    chunks = {}                      # bufferView index -> bytes (old and new views)

    def view_bytes(i):
        if i not in chunks:
            v = views[i]
            off = v.get('byteOffset', 0)
            chunks[i] = blob[off:off + v['byteLength']]
        return chunks[i]

    def add_view(data):
        views.append({'buffer': 0, 'byteLength': len(data)})
        chunks[len(views) - 1] = data
        return len(views) - 1

    # morph targets -> sparse accessors
    targets = {a for m in gltf['meshes'] for p in m['primitives'] for t in p.get('targets', []) for a in t.values()}
    dense = sparse = 0
    for ai in sorted(targets):
        acc = accessors[ai]
        if acc['componentType'] != FLOAT or acc['type'] != 'VEC3' or 'sparse' in acc or 'bufferView' not in acc:
            continue
        v = views[acc['bufferView']]
        assert 'byteStride' not in v and acc.get('byteOffset', 0) == 0
        n = acc['count']
        values = struct.unpack_from(f'<{n * 3}f', view_bytes(acc['bufferView']))
        moved = [i for i in range(n) if values[3 * i] or values[3 * i + 1] or values[3 * i + 2]]
        dense += n * 12
        idx_type, idx_fmt = (U16, 'H') if n <= 0xFFFF else (U32, 'I')
        size = len(moved) * (12 + struct.calcsize(idx_fmt))
        if size >= n * 12:
            sparse += n * 12
            continue
        del acc['bufferView']
        acc.pop('byteOffset', None)
        if moved:                    # an accessor with neither bufferView nor sparse is all zeros
            idx = struct.pack(f'<{len(moved)}{idx_fmt}', *moved)
            vals = struct.pack(f'<{len(moved) * 3}f', *(values[3 * i + k] for i in moved for k in range(3)))
            acc['sparse'] = {
                'count': len(moved),
                'indices': {'bufferView': add_view(idx), 'componentType': idx_type},
                'values': {'bufferView': add_view(vals)},
            }
        sparse += size
    print(f'morph targets: {len(targets)} accessors, {dense / 1e6:.2f} MB -> {sparse / 1e6:.2f} MB')

    # thumbnail -> 256 px
    vrm = gltf.get('extensions', {}).get('VRMC_vrm', {})
    thumb = vrm.get('meta', {}).get('thumbnailImage')
    if thumb is not None:
        img = gltf['images'][thumb]
        before = len(view_bytes(img['bufferView']))
        pic = Image.open(io.BytesIO(view_bytes(img['bufferView'])))
        pic.thumbnail((THUMB_PX, THUMB_PX))
        buf = io.BytesIO()
        pic.save(buf, 'PNG', optimize=True)
        img['bufferView'] = add_view(buf.getvalue())
        img['mimeType'] = 'image/png'
        print(f'thumbnail: {before / 1e6:.2f} MB -> {buf.tell() / 1e6:.3f} MB')

    # repack the binary chunk with only the views still referenced, 4-byte aligned
    used = set()
    for a in accessors:
        if 'bufferView' in a:
            used.add(a['bufferView'])
        if 'sparse' in a:
            used.add(a['sparse']['indices']['bufferView'])
            used.add(a['sparse']['values']['bufferView'])
    used.update(im['bufferView'] for im in gltf.get('images', []) if 'bufferView' in im)
    remap, new_views, out = {}, [], bytearray()
    for i in sorted(used):
        data = view_bytes(i)
        out += b'\0' * (-len(out) % 4)
        v = dict(views[i], byteOffset=len(out), byteLength=len(data))
        remap[i] = len(new_views)
        new_views.append(v)
        out += data
    for a in accessors:
        if 'bufferView' in a:
            a['bufferView'] = remap[a['bufferView']]
        if 'sparse' in a:
            for k in ('indices', 'values'):
                a['sparse'][k]['bufferView'] = remap[a['sparse'][k]['bufferView']]
    for im in gltf.get('images', []):
        if 'bufferView' in im:
            im['bufferView'] = remap[im['bufferView']]
    gltf['bufferViews'] = new_views
    gltf['buffers'] = [{'byteLength': len(out)}]

    write_glb(args.dst, gltf, bytes(out))
    print(f'{args.src}: {Path(args.src).stat().st_size / 1e6:.2f} MB -> {args.dst}: {Path(args.dst).stat().st_size / 1e6:.2f} MB')


if __name__ == '__main__':
    main()
