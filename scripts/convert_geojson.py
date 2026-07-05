#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Convert admin boundary GeoJSONs + cassava suitability shapefile
to lightweight KPP-specific GeoJSON files for web display.

Output:
  ../geojson/kpp_province.geojson
  ../geojson/kpp_districts.geojson
  ../geojson/kpp_tambons.geojson
  ../geojson/kpp_cassava_suit.geojson

Run from scripts/ folder:
  python convert_geojson.py
"""

import json
import os
import sys
import shapefile
from collections import defaultdict

BASE = os.path.dirname(os.path.abspath(__file__))
MAP_DIR = os.path.join(BASE, '..', '..', 'v3-gas', 'แผนที่')
OUT_DIR = os.path.join(BASE, '..', 'geojson')

os.makedirs(OUT_DIR, exist_ok=True)

KPP_PCODE = 'TH62'

# ---------- helper: simplify polygon coords ----------
def simplify_coords(coords, tol=0.0005):
    """Ramer-Douglas-Peucker simplification."""
    if len(coords) <= 2:
        return coords
    dmax = 0
    idx = 0
    end = len(coords) - 1
    for i in range(1, end):
        d = point_line_dist(coords[i], coords[0], coords[end])
        if d > dmax:
            dmax = d
            idx = i
    if dmax >= tol:
        r1 = simplify_coords(coords[:idx+1], tol)
        r2 = simplify_coords(coords[idx:], tol)
        return r1[:-1] + r2
    return [coords[0], coords[end]]

def point_line_dist(p, a, b):
    if a == b:
        return ((p[0]-a[0])**2 + (p[1]-a[1])**2) ** 0.5
    ax, ay = a; bx, by = b; px, py = p
    denom = ((bx-ax)**2 + (by-ay)**2) ** 0.5
    if denom == 0:
        return 0
    return abs((by-ay)*px - (bx-ax)*py + bx*ay - by*ax) / denom

def simplify_geometry(geom, tol=0.0005):
    """Simplify GeoJSON geometry coordinates."""
    t = geom.get('type', '')
    if t == 'Polygon':
        return {'type': 'Polygon',
                'coordinates': [simplify_coords(ring, tol) for ring in geom['coordinates']]}
    elif t == 'MultiPolygon':
        return {'type': 'MultiPolygon',
                'coordinates': [[simplify_coords(ring, tol) for ring in poly]
                                 for poly in geom['coordinates']]}
    return geom

def round_coords(coords, n=5):
    return [[round(x, n), round(y, n)] for x, y in coords]

def round_geom(geom):
    t = geom.get('type', '')
    if t == 'Polygon':
        return {'type': 'Polygon', 'coordinates': [round_coords(r) for r in geom['coordinates']]}
    elif t == 'MultiPolygon':
        return {'type': 'MultiPolygon',
                'coordinates': [[round_coords(r) for r in p] for p in geom['coordinates']]}
    return geom

# ---------- 1. Province boundary ----------
print('Extracting KPP province...')
with open(os.path.join(MAP_DIR, 'tha_admin_boundaries.geojson', 'tha_admin1.geojson'),
          encoding='utf-8') as f:
    admin1 = json.load(f)

kpp_feat = None
for feat in admin1['features']:
    if feat['properties'].get('adm1_pcode') == KPP_PCODE:
        kpp_feat = feat
        break

if kpp_feat:
    kpp_feat['geometry'] = round_geom(simplify_geometry(kpp_feat['geometry'], tol=0.001))
    kpp_feat['properties'] = {
        'name_th': 'กำแพงเพชร',
        'name_en': kpp_feat['properties'].get('adm1_name', 'Kamphaeng Phet'),
        'pcode': KPP_PCODE,
        'area_sqkm': kpp_feat['properties'].get('area_sqkm', 0)
    }
    out = {'type': 'FeatureCollection', 'features': [kpp_feat]}
    with open(os.path.join(OUT_DIR, 'kpp_province.geojson'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    print(f'  kpp_province.geojson written ({os.path.getsize(os.path.join(OUT_DIR,"kpp_province.geojson"))//1024} KB)')
else:
    print('  ERROR: KPP province not found!')

# ---------- 2. District boundaries ----------
print('Extracting KPP districts...')
with open(os.path.join(MAP_DIR, 'tha_admin_boundaries.geojson', 'tha_admin2.geojson'),
          encoding='utf-8') as f:
    admin2 = json.load(f)

dist_feats = []
for feat in admin2['features']:
    if feat['properties'].get('adm1_pcode') == KPP_PCODE:
        p = feat['properties']
        feat['geometry'] = round_geom(simplify_geometry(feat['geometry'], tol=0.001))
        feat['properties'] = {
            'name_th': p.get('adm2_name_th', p.get('adm2_name', '')),
            'name_en': p.get('adm2_name', ''),
            'pcode': p.get('adm2_pcode', ''),
            'prov_pcode': KPP_PCODE
        }
        dist_feats.append(feat)

out = {'type': 'FeatureCollection', 'features': dist_feats}
with open(os.path.join(OUT_DIR, 'kpp_districts.geojson'), 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
print(f'  kpp_districts.geojson: {len(dist_feats)} districts, '
      f'{os.path.getsize(os.path.join(OUT_DIR,"kpp_districts.geojson"))//1024} KB')

# ---------- 3. Tambon boundaries ----------
print('Extracting KPP tambons...')
with open(os.path.join(MAP_DIR, 'tha_admin_boundaries.geojson', 'tha_admin3.geojson'),
          encoding='utf-8') as f:
    admin3 = json.load(f)

tam_feats = []
for feat in admin3['features']:
    if feat['properties'].get('adm1_pcode') == KPP_PCODE:
        p = feat['properties']
        feat['geometry'] = round_geom(simplify_geometry(feat['geometry'], tol=0.0005))
        feat['properties'] = {
            'name_th': p.get('adm3_name_th', p.get('adm3_name', '')),
            'name_en': p.get('adm3_name', ''),
            'pcode': p.get('adm3_pcode', ''),
            'dist_pcode': p.get('adm2_pcode', ''),
            'prov_pcode': KPP_PCODE
        }
        tam_feats.append(feat)

out = {'type': 'FeatureCollection', 'features': tam_feats}
with open(os.path.join(OUT_DIR, 'kpp_tambons.geojson'), 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
print(f'  kpp_tambons.geojson: {len(tam_feats)} tambons, '
      f'{os.path.getsize(os.path.join(OUT_DIR,"kpp_tambons.geojson"))//1024} KB')

# ---------- 4. Cassava suitability zones ----------
print('Converting cassava suitability shapefile...')
shp_path = os.path.join(MAP_DIR, 'Zoning_Cassava_KPP', 'Zon_Cass_kpt')
sf = shapefile.Reader(shp_path, encoding='cp874')
fields = [f[0] for f in sf.fields[1:]]

# Strategy: aggregate suit_ca area by amphoe/tambon, then dissolve logically
# Since we can't do true polygon dissolve without shapely,
# we filter and simplify individual polygons but group by suit class color

SUIT_COLORS = {'S1': '#2e7d32', 'S2': '#558b2f', 'S3': '#f9a825', 'N': '#c62828'}

# Compute dominant suit class per tambon
tam_suit = defaultdict(lambda: defaultdict(float))  # tam_key -> {suit -> rai}
for rec in sf.iterRecords():
    row = dict(zip(fields, rec))
    suit = str(row.get('Suit_ca', 'N')).strip()
    tam = str(row.get('TAM_NAM_T', '')).strip()
    amp = str(row.get('AMPHOE_T', '')).strip()
    rai = float(row.get('Rai', 0) or 0)
    key = f"{amp}|{tam}"
    tam_suit[key][suit] += rai

# Build suit lookup: tambon key -> dominant suit
tam_dominant = {}
for key, suits in tam_suit.items():
    dom = max(suits, key=suits.get)
    tam_dominant[key] = dom

print(f'  Unique tambon-amphoe combos: {len(tam_dominant)}')

# Output per-polygon GeoJSON (simplified, all records)
# To keep file small, we use heavier simplification and round to 4 decimal places
features = []
total = len(sf.shapes())
print(f'  Processing {total} polygons...')

for i, sr in enumerate(sf.iterShapeRecords()):
    if i % 5000 == 0:
        print(f'    {i}/{total}...')
    rec = dict(zip(fields, sr.record))
    suit = str(rec.get('Suit_ca', 'N')).strip()
    shape = sr.shape

    if shape.shapeType == 0:  # Null shape
        continue

    # Build polygon geometry from parts
    points = shape.points
    parts = list(shape.parts) + [len(points)]
    rings = []
    for j in range(len(parts)-1):
        ring = [[round(p[0], 4), round(p[1], 4)] for p in points[parts[j]:parts[j+1]]]
        ring = simplify_coords(ring, tol=0.0003)
        if len(ring) >= 4:
            rings.append(ring)

    if not rings:
        continue

    geom = {'type': 'Polygon', 'coordinates': rings} if len(rings) == 1 \
           else {'type': 'MultiPolygon', 'coordinates': [[r] for r in rings]}

    features.append({
        'type': 'Feature',
        'geometry': geom,
        'properties': {
            'suit': suit,
            'color': SUIT_COLORS.get(suit, '#888'),
            'rai': round(float(rec.get('Rai', 0) or 0), 2)
        }
    })

out = {'type': 'FeatureCollection', 'features': features}
out_path = os.path.join(OUT_DIR, 'kpp_cassava_suit.geojson')
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, separators=(',', ':'))

size_mb = os.path.getsize(out_path) / 1024 / 1024
print(f'  kpp_cassava_suit.geojson: {len(features)} features, {size_mb:.1f} MB')

print('\nDone! Files in geojson/')
