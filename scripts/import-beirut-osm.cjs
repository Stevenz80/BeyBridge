/* Offline, reviewable import preparation. Never writes to a database.
 * OSM data © OpenStreetMap contributors, https://www.openstreetmap.org/copyright
 * Generated data is ODbL 1.0; app code keeps its own license. */
const fs = require('node:fs');
const path = require('node:path');
const SERVICE_REVIEWS = require('./beirut-service-reviews.json');

const ENDPOINT = 'https://overpass-api.de/api/interpreter';
// Category labels seen in name tags do not identify a business.
const GENERIC_NAMES = new Set(['مصبغة', 'laundry', 'dry cleaning', 'dry cleaner', 'blanchisserie']);
const QUERY = `[out:json][timeout:90];
rel["boundary"="administrative"]["ISO3166-2"="LB-BA"]->.boundary;
.boundary out geom;
.boundary map_to_area->.beirut;
(
  nwr(area.beirut)["craft"];
  nwr(area.beirut)["shop"~"^(car_repair|laundry|dry_cleaning|mobile_phone|computer)$"];
  node(id:${SERVICE_REVIEWS.map(review => review.id).join(',')});
);
out meta center;`;

const same = (a, b) => a.lat === b.lat && a.lon === b.lon;
function ringsFor(members, role) {
  const pieces = members.filter(m => m.type === 'way' && (m.role || 'outer') === role)
    .map(m => {
      if (!Array.isArray(m.geometry) || m.geometry.length < 2 ||
          m.geometry.some(p => !Number.isFinite(p.lat) || !Number.isFinite(p.lon))) {
        throw new Error('Incomplete Beirut boundary geometry');
      }
      return [...m.geometry];
    });
  const rings = [];
  while (pieces.length) {
    const ring = pieces.shift();
    while (!same(ring[0], ring.at(-1))) {
      const index = pieces.findIndex(p => same(p[0], ring.at(-1)) || same(p.at(-1), ring.at(-1)));
      if (index < 0) throw new Error('Unclosed Beirut boundary; refusing a bounding-box fallback');
      const next = pieces.splice(index, 1)[0];
      if (!same(next[0], ring.at(-1))) next.reverse();
      ring.push(...next.slice(1));
    }
    if (ring.length < 4) throw new Error('Invalid Beirut boundary ring');
    rings.push(ring);
  }
  return rings;
}

function inRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.lat > point.lat) !== (b.lat > point.lat) &&
        point.lon < (b.lon - a.lon) * (point.lat - a.lat) / (b.lat - a.lat) + a.lon) inside = !inside;
  }
  return inside;
}

function categoryFor(tags) {
  const crafts = { plumber: 1, electrician: 2, cleaning: 7, hvac: 9,
    carpenter: 11, painter: 12, locksmith: 13, pest_control: 14, moving_company: 15 };
  if (crafts[tags.craft]) return crafts[tags.craft];
  if (tags.shop === 'car_repair') return 3;
  if (['laundry', 'dry_cleaning'].includes(tags.shop)) return 20;
  if (['mobile_phone', 'computer'].includes(tags.shop) &&
      (tags.repair === 'yes' || tags['service:repair'] === 'yes')) return 19;
  return null; // Retail shops do not imply repairs, roadside assistance, or mobile service.
}

function reviewedCategoryFor(element) {
  // Only audited objects qualify. Changed source evidence needs another review;
  // names alone never establish a service, and boundary checks still apply.
  return SERVICE_REVIEWS.find(review => review.type === element.type && review.id === element.id &&
    Object.entries(review.evidenceTags).every(([key, value]) => element.tags?.[key] === value))?.categoryId ?? null;
}

function phone(value) {
  if (typeof value !== 'string') return '';
  const candidate = value.split(';')[0].trim().replace(/[\s().-]/g, '').replace(/^00/, '+');
  // Preserve only explicit international numbers. Never invent a local prefix.
  return /^\+[1-9]\d{7,14}$/.test(candidate) ? candidate : '';
}

function convert(response, importedAt = new Date().toISOString()) {
  if (response.remark || !Array.isArray(response.elements) || !response.osm3s?.timestamp_osm_base) {
    throw new Error('Missing metadata or incomplete Overpass response');
  }
  const boundaries = response.elements.filter(e => e.type === 'relation' &&
    e.tags?.['ISO3166-2'] === 'LB-BA' && e.tags?.boundary === 'administrative');
  if (boundaries.length !== 1) throw new Error('Expected exactly one Beirut administrative boundary (LB-BA)');
  const boundary = boundaries[0];
  const outer = ringsFor(boundary.members ?? [], 'outer');
  const inner = ringsFor(boundary.members ?? [], 'inner');
  if (!outer.length) throw new Error('Missing Beirut boundary geometry');
  const providers = new Map();
  for (const element of response.elements) {
    const tags = element.tags ?? {};
    const categoryId = categoryFor(tags) ?? reviewedCategoryFor(element);
    const name = [tags.name, tags['name:en'], tags['name:ar'], tags['name:fr']]
      .find(value => typeof value === 'string' && value.trim() && !GENERIC_NAMES.has(value.trim().toLowerCase()))?.trim() || '';
    const point = element.type === 'node' ? element : element.center;
    if (!categoryId || !name || tags.access === 'private' || tags.disused === 'yes' ||
        tags.abandoned === 'yes' || !point || !Number.isFinite(point.lat) || !Number.isFinite(point.lon)) continue;
    if (!outer.some(r => inRing(point, r)) || inner.some(r => inRing(point, r))) continue;
    if (!['node', 'way', 'relation'].includes(element.type) || !Number.isSafeInteger(element.id) ||
        element.id <= 0 || !Number.isFinite(Date.parse(element.timestamp))) {
      throw new Error('Business object is missing valid source identity/timestamp');
    }
    const id = `osm-${element.type}-${element.id}`;
    providers.set(id, {
      id, name, category_id: categoryId, owner_id: null,
      description: '', area: 'Beirut',
      address: [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' '),
      phone: [tags['contact:phone'], tags.phone, tags['contact:mobile'], tags.mobile].map(phone).find(Boolean) || '',
      // WhatsApp requires its own explicit source tag, never inferred from phone.
      whatsapp: phone(tags['contact:whatsapp']).replace(/^\+/, ''),
      latitude: point.lat, longitude: point.lon, opening_hours: {}, is_verified: false,
      listing_status: 'published', service_mode: 'on_site', price_type: 'quote',
      starting_price: null, emergency_service: false,
      price_currency: 'USD', years_experience: null, moderation_status: 'active',
      moderation_reason: '', moderated_at: null,
      map_source: { kind: 'openstreetmap', url: `https://www.openstreetmap.org/${element.type}/${element.id}`,
        names: [...new Set([name, tags['name:en'], tags['name:ar'], tags['name:fr'], tags.alt_name].filter(Boolean))],
        updatedAt: element.timestamp, importedAt, openingHours: tags.opening_hours || '' },
    });
  }
  if (!providers.size) throw new Error('No eligible Beirut businesses; existing catalog files are unchanged');
  return {
    attribution: '© OpenStreetMap contributors', license: 'ODbL-1.0',
    licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
    attributionUrl: 'https://www.openstreetmap.org/copyright',
    boundaryUrl: `https://www.openstreetmap.org/relation/${boundary.id}`,
    boundaryCode: 'LB-BA', dataTimestamp: response.osm3s.timestamp_osm_base, importedAt,
    providers: [...providers.values()].sort((a, b) => a.id.localeCompare(b.id)),
  };
}

function toSql(catalog) {
  const quote = value => value === null ? 'NULL' : typeof value === 'number' || typeof value === 'boolean'
    ? String(value) : "'" + (typeof value === 'object' ? JSON.stringify(value) : value).replaceAll("'", "''") + "'";
  const statements = catalog.providers.map(p => {
    const columns = Object.keys(p);
    const updates = columns.filter(c => !['id', 'owner_id', 'listing_status', 'is_verified',
      'moderation_status', 'moderation_reason', 'moderated_at'].includes(c))
      .map(c => `${c} = excluded.${c}`).join(', ');
    return `insert into public.providers (${columns.join(', ')}) values (${columns.map(c => quote(p[c])).join(', ')})
on conflict (id) do update set ${updates}
where providers.owner_id is null and providers.map_source->>'kind' = 'openstreetmap'
  and providers.listing_status = 'published' and providers.moderation_status = 'active';`;
  });
  return `-- OSM data © OpenStreetMap contributors, ODbL 1.0. Review before executing.
-- Requires 20261007130000_real_map_catalog.sql. Does not remove vanished businesses.
begin;
set local standard_conforming_strings = on;
${statements.join('\n')}
commit;\n`;
}

async function main() {
  const args = process.argv.slice(2);
  const input = args.indexOf('--input');
  const output = args.indexOf('--output');
  const directory = output >= 0 ? args[output + 1] : 'output/beirut-catalog';
  let raw;
  if (input >= 0) raw = fs.readFileSync(args[input + 1], 'utf8');
  else {
    const response = await fetch(ENDPOINT, { method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'BeyBridge-Beirut-Catalog/1.0' },
      body: new URLSearchParams({ data: QUERY }), signal: AbortSignal.timeout(120_000) });
    if (!response.ok) throw new Error(`OpenStreetMap import blocked: HTTP ${response.status}`);
    raw = await response.text();
  }
  const catalog = convert(JSON.parse(raw));
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'overpass-response.json'), raw);
  fs.writeFileSync(path.join(directory, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
  fs.writeFileSync(path.join(directory, 'import.sql'), toSql(catalog));
  console.log(`Prepared ${catalog.providers.length} Beirut listings in ${directory}. No database was changed.`);
}

module.exports = { convert, toSql, QUERY };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
