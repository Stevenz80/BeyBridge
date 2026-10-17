export type ClusterPoint = { id: string; latitude: number; longitude: number };

export type MapCluster<T extends ClusterPoint> =
  | { kind: 'single'; point: T }
  | {
      kind: 'cluster';
      id: string;
      points: T[];
      latitude: number;
      longitude: number;
      // [west, south, east, north], for zooming in to separate the members.
      bounds: [number, number, number, number];
    };

// MapLibre renders a 512px world at zoom 0, in density-independent pixels.
const WORLD_SIZE = 512;
// Provider markers are 38dp wide; a margin covers cluster centroids drifting
// toward a neighbour, which would otherwise still overlap.
export const CLUSTER_RADIUS_DP = 48;
// At street level, remaining overlaps are genuinely shared addresses.
export const CLUSTER_MAX_ZOOM = 16;

function project(point: ClusterPoint, zoom: number) {
  const scale = WORLD_SIZE * 2 ** zoom;
  const latitude = (Math.max(-85, Math.min(85, point.latitude)) * Math.PI) / 180;
  return {
    x: ((point.longitude + 180) / 360) * scale,
    y: ((1 - Math.log(Math.tan(latitude) + 1 / Math.cos(latitude)) / Math.PI) / 2) * scale,
  };
}

/**
 * Greedily groups markers whose centres would overlap at `zoom`. Ids in
 * `keepSeparate` (the selected place) always render as their own marker.
 */
export function clusterMapPoints<T extends ClusterPoint>(
  points: readonly T[],
  zoom: number,
  keepSeparate: ReadonlySet<string> = new Set()
): MapCluster<T>[] {
  if (zoom >= CLUSTER_MAX_ZOOM) return points.map((point) => ({ kind: 'single', point }));

  const projected = points.map((point) => ({ point, ...project(point, zoom) }));
  const assigned = new Set<string>();
  const result: MapCluster<T>[] = [];

  for (const seed of projected) {
    if (assigned.has(seed.point.id)) continue;
    assigned.add(seed.point.id);
    if (keepSeparate.has(seed.point.id)) {
      result.push({ kind: 'single', point: seed.point });
      continue;
    }

    const members = [seed];
    for (const candidate of projected) {
      if (assigned.has(candidate.point.id) || keepSeparate.has(candidate.point.id)) continue;
      if (Math.hypot(candidate.x - seed.x, candidate.y - seed.y) < CLUSTER_RADIUS_DP) {
        members.push(candidate);
        assigned.add(candidate.point.id);
      }
    }

    if (members.length === 1) {
      result.push({ kind: 'single', point: seed.point });
      continue;
    }

    const memberPoints = members.map(({ point }) => point);
    const longitudes = memberPoints.map(({ longitude }) => longitude);
    const latitudes = memberPoints.map(({ latitude }) => latitude);
    result.push({
      kind: 'cluster',
      id: `cluster:${memberPoints.map(({ id }) => id).sort().join(',')}`,
      points: memberPoints,
      latitude: latitudes.reduce((sum, value) => sum + value, 0) / latitudes.length,
      longitude: longitudes.reduce((sum, value) => sum + value, 0) / longitudes.length,
      bounds: [Math.min(...longitudes), Math.min(...latitudes), Math.max(...longitudes), Math.max(...latitudes)],
    });
  }

  return result;
}
