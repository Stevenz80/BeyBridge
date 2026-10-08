const { test } = require('node:test');
const assert = require('node:assert/strict');
const { convert, toSql } = require('./import-beirut-osm.cjs');
const fs = require('node:fs');
const path = require('node:path');

// Synthetic geometry ONLY for tests. This is not a Beirut boundary or real business data.
const timestamp = '2026-10-07T00:00:00Z';
const outer = [{lat: 0, lon: 0}, {lat: 0, lon: 4}, {lat: 4, lon: 4}, {lat: 4, lon: 0}, {lat: 0, lon: 0}];
const inner = [{lat: 2, lon: 2}, {lat: 2, lon: 3}, {lat: 3, lon: 3}, {lat: 3, lon: 2}, {lat: 2, lon: 2}];
const business = (id, extra = {}) => ({type: 'node', id, timestamp, lat: 1, lon: 1,
  tags: {name: "Test O'Brien repair", shop: 'car_repair'}, ...extra});
function response(elements = [business(1)]) {
  return {osm3s: {timestamp_osm_base: timestamp}, elements: [
    {type: 'relation', id: 9, tags: {'ISO3166-2': 'LB-BA', boundary: 'administrative'}, members: [
      {type: 'way', role: 'outer', geometry: outer.slice(0, 3)},
      {type: 'way', role: 'outer', geometry: outer.slice(2).reverse()},
      {type: 'way', role: 'inner', geometry: inner},
    ]}, ...elements]};
}

test('includes only businesses inside the administrative boundary, excluding holes', () => {
  const catalog = convert(response([business(1), business(2, {lat: 8}), business(3, {lat: 2.5, lon: 2.5})]), timestamp);
  assert.deepEqual(catalog.providers.map(p => p.id), ['osm-node-1']);
});
test('missing, incomplete, or empty data never becomes a successful import', () => {
  assert.throws(() => convert({elements: []}));
  assert.throws(() => convert({...response(), remark: 'runtime timeout'}));
  const missing = response(); missing.elements[0].members.pop(); missing.elements[0].members.pop();
  assert.throws(() => convert(missing), /Unclosed/);
  assert.throws(() => convert(response([])), /No eligible/);
  const wrong = response(); wrong.elements[0].tags['ISO3166-2'] = 'LB-JL';
  assert.throws(() => convert(wrong), /exactly one/);
});
test('does not invent contacts, parsed hours, prices, verification, or owner accounts', () => {
  const p = convert(response()).providers[0];
  assert.equal(p.phone, ''); assert.equal(p.whatsapp, ''); assert.equal(p.starting_price, null);
  assert.equal(p.is_verified, false); assert.equal(p.owner_id, null); assert.deepEqual(p.opening_hours, {});
  assert.equal(p.map_source.url, 'https://www.openstreetmap.org/node/1');
  assert.equal(p.map_source.updatedAt, timestamp);
});
test('explicit international phone and raw hours survive without inferring WhatsApp', () => {
  const p = convert(response([business(1, {tags: {name: 'Fixture', craft: 'plumber',
    phone: '+961 1 234 567', opening_hours: 'Mo-Fr 09:00-17:00'}})])).providers[0];
  assert.equal(p.phone, '+9611234567'); assert.equal(p.whatsapp, '');
  assert.equal(p.map_source.openingHours, 'Mo-Fr 09:00-17:00');
});

test('retains explicit mobile contacts and French-only business names found in Beirut', () => {
  const p = convert(response([business(1, {tags: {'name:fr': 'Laudry express', shop: 'laundry',
    'contact:mobile': '+961 70 770 577'}})])).providers[0];
  assert.equal(p.name, 'Laudry express');
  assert.equal(p.phone, '+96170770577');
  assert.equal(p.whatsapp, '');
});

test('a generic category label is not treated as an identified business', () => {
  const catalog = convert(response([business(1), business(2, {tags: {name: 'مصبغة', shop: 'dry_cleaning'}})]));
  assert.deepEqual(catalog.providers.map(p => p.id), ['osm-node-1']);
});

test('preserves multilingual source names for business search', () => {
  const p = convert(response([business(1, {tags: {name: 'مصبغة بلازا', 'name:en': 'Plaza Laundry',
    'name:fr': 'Laverie Plaza', shop: 'laundry'}})])).providers[0];
  assert.deepEqual(p.map_source.names, ['مصبغة بلازا', 'Plaza Laundry', 'Laverie Plaza']);
});
test('retail shops are not converted into repair or mobile services', () => {
  const catalog = convert(response([business(1), business(2, {tags: {name: 'Phone retailer', shop: 'mobile_phone'}}),
    business(3, {tags: {name: 'Repair fixture', shop: 'mobile_phone', repair: 'yes'}}),
    business(4, {tags: {name: 'Tyre retail', shop: 'tyres'}})]));
  assert.deepEqual(catalog.providers.map(p => p.id), ['osm-node-1', 'osm-node-3']);
});
test('refresh SQL escapes source text and protects ownership and moderation decisions', () => {
  const sql = toSql(convert(response()));
  assert.match(sql, /O''Brien/); assert.match(sql, /providers.owner_id is null/);
  assert.match(sql, /providers.moderation_status = 'active'/);
  assert.match(sql, /providers.listing_status = 'published'/);
  assert.doesNotMatch(sql, /delete from|owner_id = excluded|is_verified = excluded/i);
});

test('shipped real catalog and SQL reproduce exactly from the retained OSM response', () => {
  const source = require('../public/data/beirut-source.json');
  const catalog = require('../public/data/beirut-catalog.json');
  assert.deepEqual(convert(source, catalog.importedAt), catalog);
  assert.equal(toSql(catalog), fs.readFileSync(path.join(__dirname, '../supabase/catalogs/beirut-20261008.sql'), 'utf8'));
  assert.equal(catalog.boundaryUrl, 'https://www.openstreetmap.org/relation/316552');
  assert.ok(catalog.providers.length > 0);
  assert.ok(catalog.providers.every(p => p.owner_id === null && !p.is_verified));
});
