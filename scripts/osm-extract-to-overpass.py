"""Build the Overpass-shaped response import-beirut-osm.cjs reads from an OSM extract.

Use this when the Overpass API cannot be reached. It selects the same objects as the
importer's query and drops contributor names and IDs.

    pip install osmium
    python3 scripts/osm-extract-to-overpass.py lebanon.osm.pbf response.json \\
        "$(node -p "require('./scripts/import-beirut-osm.cjs').GREATER_BEIRUT.join()")"
    node scripts/import-beirut-osm.cjs --input response.json

OSM data © OpenStreetMap contributors, ODbL 1.0.
"""
import json
import sys

import osmium

BBOX = (33.80, 35.44, 33.94, 35.62)  # south, west, north, east; keep in step with the importer
SHOPS = {'car_repair', 'laundry', 'dry_cleaning', 'mobile_phone', 'computer', 'locksmith'}
PLACES = {'suburb', 'town', 'village', 'quarter', 'neighbourhood'}

extract, output, suburbs = sys.argv[1], sys.argv[2], {int(i) for i in sys.argv[3].split(',')}
with open(__file__.replace('osm-extract-to-overpass.py', 'beirut-service-reviews.json'), encoding='utf8') as f:
    reviewed = {review['id'] for review in json.load(f)}


def in_box(lat, lon):
    return BBOX[0] <= lat <= BBOX[2] and BBOX[1] <= lon <= BBOX[3]


def meta(kind, obj):
    return {'type': kind, 'id': obj.id, 'timestamp': obj.timestamp.strftime('%Y-%m-%dT%H:%M:%SZ'),
            'version': obj.version, 'tags': {k: v for k, v in obj.tags}}


relations, boundary_ways = [], set()


class Boundaries(osmium.SimpleHandler):
    def relation(self, r):
        if r.tags.get('boundary') == 'administrative' and (r.tags.get('ISO3166-2') == 'LB-BA' or r.id in suburbs):
            element = meta('relation', r)
            element['members'] = [{'type': 'way', 'ref': m.ref, 'role': m.role} for m in r.members if m.type == 'w']
            relations.append(element)
            boundary_ways.update(m['ref'] for m in element['members'])


geometry, elements = {}, []


class Objects(osmium.SimpleHandler):
    def node(self, n):
        tags = n.tags
        if tags and n.location.valid() and in_box(n.location.lat, n.location.lon) and (
                'craft' in tags or tags.get('shop') in SHOPS or tags.get('place') in PLACES or n.id in reviewed):
            elements.append({**meta('node', n), 'lat': n.location.lat, 'lon': n.location.lon})

    def way(self, w):
        points = [{'lat': x.location.lat, 'lon': x.location.lon} for x in w.nodes if x.location.valid()]
        if w.id in boundary_ways and len(points) == len(w.nodes):
            geometry[w.id] = points
        if points and ('craft' in w.tags or w.tags.get('shop') in SHOPS):
            lats, lons = [p['lat'] for p in points], [p['lon'] for p in points]
            lat, lon = round((min(lats) + max(lats)) / 2, 7), round((min(lons) + max(lons)) / 2, 7)
            if in_box(lat, lon):
                elements.append({**meta('way', w), 'center': {'lat': lat, 'lon': lon}})


Boundaries().apply_file(extract)
Objects().apply_file(extract, locations=True)
for relation in relations:
    for member in relation['members']:
        member['geometry'] = geometry[member['ref']]  # KeyError: the extract clips this boundary
header = osmium.io.Reader(extract).header()
with open(output, 'w', encoding='utf8') as f:
    json.dump({'version': 0.6, 'generator': 'osm-extract-to-overpass.py',
               'osm3s': {'timestamp_osm_base': header.get('osmosis_replication_timestamp') or header.get('timestamp'),
                         'copyright': 'The data included in this document is from www.openstreetmap.org. '
                                      'The data is made available under ODbL.'},
               'elements': relations + elements}, f, ensure_ascii=False, indent=1)
print(f'{len(relations)} boundaries and {len(elements)} objects written to {output}')
