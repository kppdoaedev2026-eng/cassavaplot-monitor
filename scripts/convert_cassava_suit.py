#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Convert cassava suitability shapefile (UTM 32647) to WGS84 GeoJSON.
Outputs two files:
  kpp_cassava_suit.geojson  - full detail (may be large)
  kpp_cassava_light.geojson - simplified for web (<3 MB)

Run from scripts/ folder:
  python convert_cassava_suit.py
"""

import json
import os
import shapefile
from pyproj import Transformer
from collections import defaultdict

BASE = os.path.dirname(os.path.abspath(__file__))
MAP_DIR = os.path.join(BASE, '..', '..', 'v3-gas', 'แผนที่')
OUT_DIR = os.path.join(BASE, '..', 'geojson')
os.makedirs(OUT_DIR, exist_ok=True)

SHP_PATH = os.path.join(MAP_DIR, 'Zoning_Cassava_KPP', 'Zon_Cass_kpt')

SUIT_COLORS = {'S1': '#2e7d32', 'S2': '#558b2f', 'S3': '#f9a825', 'N': '#c62828'}

# UTM Zone 47N (EPSG:32647) → WGS84 (EPSG:4326)
transformer = Transformer.from_crs('EPSG:32647', 'EPSG:4326', always_xy=True)

def utm_to_wgs84(coords):
    return [[round(lon, 5), round(lat, 5)]
            for lon, lat in (transformer.transform(x, y) for x, y in coords)]

def simplify_dp(coords, tol):
    """Ramer-Douglas-Peucker simplification."""
    if len(coords) <= 2:
        return coords
    dmax = 0
    idx = 0
    end = len(coords) - 1
    ax, ay = coords[0]
    bx, by = coords[end]
    denom = ((bx - ax)**2 + (by - ay)**2)**0.5
    for i in range(1, end):
        px, py = coords[i]
        if denom > 0:
            d = abs((by - ay)*px - (bx - ax)*py + bx*ay - by*ax) / denom
        else:
            d = ((px - ax)**2 + (py - ay)**2)**0.5
        if d > dmax:
            dmax = d
            idx = i
    if dmax >= tol:
        r1 = simplify_dp(coords[:idx + 1], tol)
        r2 = simplify_dp(coords[idx:], tol)
        return r1[:-1] + r2
    return [coords[0], coords[end]]

def convert_shapefile(tol_wgs84, n_decimal, label, outfile):
    """Convert SHP to GeoJSON with given simplification tolerance."""
    sf = shapefile.Reader(SHP_PATH, encoding='cp874')
    fields = [f[0] for f in sf.fields[1:]]
    total = len(sf.shapes())
    print(f'\nConverting {total} polygons -> {label} (tol={tol_wgs84} deg)...')

    features = []
    skipped = 0

    for i, sr in enumerate(sf.iterShapeRecords()):
        if i % 5000 == 0:
            print(f'  {i}/{total}...')

        shape = sr.shape
        if shape.shapeType == 0:
            skipped += 1
            continue

        rec = dict(zip(fields, sr.record))
        suit = str(rec.get('Suit_ca', 'N')).strip()

        # Build polygons from parts (UTM → WGS84 → simplify)
        points_utm = shape.points
        parts = list(shape.parts) + [len(points_utm)]
        rings = []
        for j in range(len(parts) - 1):
            ring_utm = points_utm[parts[j]:parts[j+1]]
            ring_wgs = utm_to_wgs84(ring_utm)
            ring_wgs = [[round(x, n_decimal), round(y, n_decimal)] for x, y in ring_wgs]
            ring_simp = simplify_dp(ring_wgs, tol_wgs84)
            if len(ring_simp) >= 4:
                rings.append(ring_simp)

        if not rings:
            skipped += 1
            continue

        if len(rings) == 1:
            geom = {'type': 'Polygon', 'coordinates': rings}
        else:
            geom = {'type': 'MultiPolygon', 'coordinates': [[r] for r in rings]}

        features.append({
            'type': 'Feature',
            'geometry': geom,
            'properties': {
                'suit': suit,
                'color': SUIT_COLORS.get(suit, '#888'),
                'rai': round(float(rec.get('Rai', 0) or 0), 1)
            }
        })

    out = {'type': 'FeatureCollection', 'features': features}
    out_path = os.path.join(OUT_DIR, outfile)
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))

    size_mb = os.path.getsize(out_path) / 1024 / 1024
    print(f'  → {outfile}: {len(features)} features, {size_mb:.2f} MB (skipped {skipped})')
    return size_mb

# Full detail (5 decimal, tol 0.0001° ≈ 11m)
convert_shapefile(tol_wgs84=0.0001, n_decimal=5,
                  label='full detail', outfile='kpp_cassava_suit.geojson')

# Light version (3 decimal, tol 0.001° ≈ 111m)
convert_shapefile(tol_wgs84=0.001, n_decimal=3,
                  label='light web', outfile='kpp_cassava_light.geojson')

print('\nDone.')
