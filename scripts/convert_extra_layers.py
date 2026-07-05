#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Convert extra map layers (crop zoning, soil, registered cassava plots, points)
from v3-gas/แผนที่ into GeoJSON for GitHub Pages.

Run from scripts/ folder:
  python convert_extra_layers.py
"""

import hashlib
import json
import os
import sys
import shapefile
from pyproj import Transformer

sys.setrecursionlimit(10000)

BASE = os.path.dirname(os.path.abspath(__file__))
MAP_DIR = os.path.join(BASE, '..', '..', 'v3-gas', 'แผนที่')
OUT_DIR = os.path.join(BASE, '..', 'geojson')
os.makedirs(OUT_DIR, exist_ok=True)

transformer = Transformer.from_crs('EPSG:32647', 'EPSG:4326', always_xy=True)

def utm_to_wgs84(coords):
    return [[round(lon, 5), round(lat, 5)] for lon, lat in
            (transformer.transform(x, y) for x, y in coords)]

def simplify_dp(coords, tol):
    """Ramer-Douglas-Peucker simplification."""
    if len(coords) <= 2:
        return coords
    dmax = 0
    idx = 0
    end = len(coords) - 1
    ax, ay = coords[0]
    bx, by = coords[end]
    denom = ((bx - ax) ** 2 + (by - ay) ** 2) ** 0.5
    for i in range(1, end):
        px, py = coords[i]
        if denom > 0:
            d = abs((by - ay) * px - (bx - ax) * py + bx * ay - by * ax) / denom
        else:
            d = ((px - ax) ** 2 + (py - ay) ** 2) ** 0.5
        if d > dmax:
            dmax = d
            idx = i
    if dmax >= tol:
        r1 = simplify_dp(coords[:idx + 1], tol)
        r2 = simplify_dp(coords[idx:], tol)
        return r1[:-1] + r2
    return [coords[0], coords[end]]

def hsl_to_hex(h, s, l):
    s /= 100; l /= 100
    c = (1 - abs(2 * l - 1)) * s
    x = c * (1 - abs((h / 60) % 2 - 1))
    m = l - c / 2
    if h < 60: r, g, b = c, x, 0
    elif h < 120: r, g, b = x, c, 0
    elif h < 180: r, g, b = 0, c, x
    elif h < 240: r, g, b = 0, x, c
    elif h < 300: r, g, b = x, 0, c
    else: r, g, b = c, 0, x
    r, g, b = [round((v + m) * 255) for v in (r, g, b)]
    return '#%02x%02x%02x' % (r, g, b)

def color_from_code(code):
    """Deterministic categorical color for soil group/series codes."""
    h = int(hashlib.md5(str(code).encode('utf-8')).hexdigest(), 16) % 360
    return hsl_to_hex(h, 58, 46)

def build_geom(shape, tol, n_decimal):
    points = shape.points
    if not points:
        return None
    # some source files' .prj claims UTM47N but coordinates are already WGS84 degrees
    already_wgs84 = abs(points[0][0]) <= 180 and abs(points[0][1]) <= 90
    parts = list(shape.parts) + [len(points)]
    rings = []
    for j in range(len(parts) - 1):
        ring = points[parts[j]:parts[j + 1]]
        ring_wgs = ring if already_wgs84 else utm_to_wgs84(ring)
        ring_wgs = [[round(x, n_decimal), round(y, n_decimal)] for x, y in ring_wgs]
        ring_simp = simplify_dp(ring_wgs, tol) if tol else ring_wgs
        if len(ring_simp) >= 4:
            rings.append(ring_simp)
    if not rings:
        return None
    if len(rings) == 1:
        return {'type': 'Polygon', 'coordinates': rings}
    return {'type': 'MultiPolygon', 'coordinates': [[r] for r in rings]}

def open_shp_safe(path_no_ext):
    """pyshp mis-splits basenames containing a literal dot (e.g. 'Soil_จ.กำแพงเพชร') -
    stage the 3 sidecar files under a dot-free temp name first."""
    d = os.path.dirname(path_no_ext)
    base = os.path.basename(path_no_ext)
    if '.' not in base:
        return path_no_ext
    import shutil, tempfile
    tmp_dir = tempfile.mkdtemp(prefix='shp_safe_')
    safe_base = os.path.join(tmp_dir, 'layer')
    for ext in ('.shp', '.dbf', '.shx', '.prj'):
        src = os.path.join(d, base + ext)
        if os.path.exists(src):
            shutil.copy(src, safe_base + ext)
    return safe_base

def write_fc(features, outfile):
    out = {'type': 'FeatureCollection', 'features': features}
    out_path = os.path.join(OUT_DIR, outfile)
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    size_mb = os.path.getsize(out_path) / 1024 / 1024
    print(f'  -> {outfile}: {len(features)} features, {size_mb:.2f} MB')

# ── crop suitability zoning (Maize / Rice / Sugarcane) ──────────────────────
CROP_COLORS = {
    'maize':     {'S1': '#e65100', 'S2': '#f57c00', 'S3': '#ffcc80', 'N': '#b71c1c'},
    'rice':      {'S1': '#01579b', 'S2': '#0288d1', 'S3': '#81d4fa', 'N': '#b71c1c'},
    'sugarcane': {'S1': '#6a1b9a', 'S2': '#8e24aa', 'S3': '#ce93d8', 'N': '#b71c1c'},
}

CROP_SHP = {
    'maize':     (os.path.join(MAP_DIR, 'Zoning_Maize_KPP_ext', 'Zon_Maize_kpt'), 'Suit_mz'),
    'rice':      (os.path.join(MAP_DIR, 'Zoning_Rice_KPP_ext', 'Zon_Rice_kpt'), 'Suit_rc'),
    'sugarcane': (os.path.join(MAP_DIR, 'Zoning_Sugarcane_KPP', 'Zon_Suga_kpt'), 'Suit_su'),
}

for crop, (shp_path, suit_field) in CROP_SHP.items():
    sf = shapefile.Reader(shp_path, encoding='cp874')
    fields = [f[0] for f in sf.fields[1:]]
    total = len(sf)
    print(f'\nConverting {crop} ({total} records)...')
    features = []
    for i, sr in enumerate(sf.iterShapeRecords()):
        if i % 5000 == 0:
            print(f'  {i}/{total}...')
        rec = dict(zip(fields, sr.record))
        suit = str(rec.get(suit_field, 'N')).strip()
        geom = build_geom(sr.shape, tol=0.001, n_decimal=3)
        if not geom:
            continue
        features.append({
            'type': 'Feature', 'geometry': geom,
            'properties': {
                'suit': suit,
                'color': CROP_COLORS[crop].get(suit, '#888'),
                'rai': round(float(rec.get('Rai', 0) or 0), 1)
            }
        })
    write_fc(features, f'kpp_{crop}_light.geojson')

# ── soil group (กลุ่มชุดดิน) ──────────────────────────────────────────────
sf = shapefile.Reader(os.path.join(MAP_DIR, 'sg_kpt กลุ่มชุดดินจังหวัดกำแพงเพชร', 'kpt', 'soilgroup_kpt'), encoding='cp874')
fields = [f[0] for f in sf.fields[1:]]
total = len(sf)
print(f'\nConverting soilgroup ({total} records)...')
features = []
for i, sr in enumerate(sf.iterShapeRecords()):
    if i % 500 == 0:
        print(f'  {i}/{total}...')
    rec = dict(zip(fields, sr.record))
    grp = str(rec.get('soilgroup', '')).strip()
    geom = build_geom(sr.shape, tol=0.001, n_decimal=3)
    if not geom:
        continue
    features.append({
        'type': 'Feature', 'geometry': geom,
        'properties': {
            'soilgroup': grp,
            'color': color_from_code(grp),
            'tambon': rec.get('tam_nam_t', ''),
            'amphoe': rec.get('amphoe_t', ''),
            'texture': rec.get('tex_top', ''),
            'ph': rec.get('pH_top', ''),
            'fertility': rec.get('fer_top', '')
        }
    })
write_fc(features, 'kpp_soilgroup.geojson')

# ── soil series (ชุดดิน) ──────────────────────────────────────────────────
soil_series_path = open_shp_safe(os.path.join(MAP_DIR, 'sr_kpt ชุดดินจังหวัดกำแพงเพชร', 'กำแพงเพชร', 'Soil_จ.กำแพงเพชร', 'Soil_จ.กำแพงเพชร'))
sf = shapefile.Reader(soil_series_path, encoding='cp874')
fields = [f[0] for f in sf.fields[1:]]
total = len(sf)
print(f'\nConverting soilseries ({total} records)...')
features = []
for i, sr in enumerate(sf.iterShapeRecords()):
    if i % 500 == 0:
        print(f'  {i}/{total}...')
    rec = dict(zip(fields, sr.record))
    grp = str(rec.get('soilgroup', '')).strip()
    geom = build_geom(sr.shape, tol=0.001, n_decimal=3)
    if not geom:
        continue
    features.append({
        'type': 'Feature', 'geometry': geom,
        'properties': {
            'soilgroup': grp,
            'soilseries': rec.get('soilseries', ''),
            'seriesname': rec.get('seriesname', ''),
            'color': color_from_code(grp),
            'amphoe': rec.get('AMPHOE_T', ''),
            'texture': rec.get('texture_to', ''),
            'ph': rec.get('pH_top', ''),
            'fertility': rec.get('fertility', '')
        }
    })
write_fc(features, 'kpp_soilseries.geojson')

# ── registered cassava cultivation plots (ทะเบียนแปลงมันสำปะหลัง กสก.) ────
sf = shapefile.Reader(os.path.join(MAP_DIR, 'drought_cassava_download_20250630_SHP', '20250630_SHP', 'Cassava_20250630'), encoding='utf-8')
fields = [f[0] for f in sf.fields[1:]]
total = len(sf)
print(f'\nConverting registered cassava plots (scanning {total} national records for p_code=62)...')
features = []
for i, sr in enumerate(sf.iterShapeRecords()):
    if i % 50000 == 0:
        print(f'  {i}/{total}...')
    rec = dict(zip(fields, sr.record))
    if str(rec.get('p_code')) != '62':
        continue
    geom = build_geom(sr.shape, tol=0.0001, n_decimal=5)
    if not geom:
        continue
    features.append({
        'type': 'Feature', 'geometry': geom,
        'properties': {
            'tambon': rec.get('t_name', ''),
            'amphoe': rec.get('a_name', ''),
            'rai': round(float(rec.get('rai', 0) or 0), 2),
            'start_period': rec.get('start_name', ''),
            'harvest_period': rec.get('harv_name', ''),
            'data_date': str(rec.get('data_date', ''))
        }
    })
write_fc(features, 'kpp_registered_cassava.geojson')

# ── point layers: schools + villages ────────────────────────────────────────
sf = shapefile.Reader(os.path.join(MAP_DIR, '2 Boundary and Point-20260704T143250Z-3-001', '2 Boundary and Point', '5_School_-_mitrearth'), encoding='utf-8')
fields = [f[0] for f in sf.fields[1:]]
features = []
for sr in sf.iterShapeRecords():
    rec = dict(zip(fields, sr.record))
    pt = sr.shape.points[0]
    features.append({
        'type': 'Feature',
        'geometry': {'type': 'Point', 'coordinates': [round(pt[0], 5), round(pt[1], 5)]},
        'properties': {'name': rec.get('CUL_PNAME', ''), 'type': rec.get('DESC_', '')}
    })
write_fc(features, 'kpp_schools.geojson')

sf = shapefile.Reader(os.path.join(MAP_DIR, '2 Boundary and Point-20260704T143250Z-3-001', '2 Boundary and Point', '5_Village_KAMPHAENG_PHET_-_mitrearth'), encoding='utf-8')
fields = [f[0] for f in sf.fields[1:]]
features = []
for sr in sf.iterShapeRecords():
    rec = dict(zip(fields, sr.record))
    lon, lat = rec.get('Longitude'), rec.get('Lattitude')
    if lon is None or lat is None:
        continue
    features.append({
        'type': 'Feature',
        'geometry': {'type': 'Point', 'coordinates': [round(float(lon), 5), round(float(lat), 5)]},
        'properties': {
            'name': rec.get('VillageTha', ''),
            'tambon': rec.get('TambonThai', ''),
            'amphoe': rec.get('AmphoeThai', '')
        }
    })
write_fc(features, 'kpp_villages.geojson')

print('\nDone.')
