import assert from 'node:assert/strict';
import test from 'node:test';
import { CLUSTER_MAX_ZOOM, clusterMapPoints } from '../src/lib/map-clusters.ts';
import catalog from '../public/data/beirut-catalog.json' with { type: 'json' };

const points = catalog.providers
  .filter((provider) => provider.latitude !== null && provider.longitude !== null)
  .map(({ id, latitude, longitude }) => ({ id, latitude, longitude }));

function count(groups) {
  return groups.reduce((sum, group) => sum + (group.kind === 'single' ? 1 : group.points.length), 0);
}

test('groups overlapping catalog markers at the initial city zoom without losing any', () => {
  const groups = clusterMapPoints(points, 11.5);
  assert.equal(count(groups), points.length);
  assert.ok(groups.some((group) => group.kind === 'cluster'));
  assert.ok(groups.length < points.length);
});

test('separates every marker at street level', () => {
  const groups = clusterMapPoints(points, CLUSTER_MAX_ZOOM);
  assert.ok(groups.every((group) => group.kind === 'single'));
  assert.equal(groups.length, points.length);
});

test('keeps the selected place as its own marker', () => {
  const crowded = clusterMapPoints(points, 11.5).find((group) => group.kind === 'cluster');
  const selectedId = crowded.points[0].id;
  const groups = clusterMapPoints(points, 11.5, new Set([selectedId]));
  assert.ok(groups.some((group) => group.kind === 'single' && group.point.id === selectedId));
  assert.ok(groups.every((group) => group.kind === 'single' || !group.points.some(({ id }) => id === selectedId)));
});

test('cluster bounds contain all members and zooming in splits clusters', () => {
  const clusters = clusterMapPoints(points, 11.5).filter((group) => group.kind === 'cluster');
  for (const cluster of clusters) {
    const [west, south, east, north] = cluster.bounds;
    for (const point of cluster.points) {
      assert.ok(point.longitude >= west && point.longitude <= east);
      assert.ok(point.latitude >= south && point.latitude <= north);
    }
  }
  assert.ok(clusterMapPoints(points, 13.5).length > clusterMapPoints(points, 11.5).length);
});
