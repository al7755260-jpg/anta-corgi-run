import * as T from 'three';
import {routeFrame} from './routes.js';
import {trackMaterial, toonMaterial} from './art-direction.js';

// A return journey may cover the same physical pavement in the opposite
// direction. Clip that shared area once, instead of drawing two coloured
// ribbons a few millimetres apart and relying on a depth bias to hide them.
const EPS = 1e-8;
const HASH_SIZE = 3;
const COPLANAR_HEIGHT = .075;

const signedArea = polygon => polygon.reduce((sum, p, i) => {
  const q = polygon[(i + 1) % polygon.length];
  return sum + p[0] * q[2] - q[0] * p[2];
}, 0) * .5;

function cleanPolygon(polygon) {
  return polygon.filter((p, i) => {
    const q = polygon[(i + polygon.length - 1) % polygon.length];
    return Math.hypot(p[0] - q[0], p[2] - q[2]) > 1e-8;
  });
}

function clipHalfPlane(polygon, a, b, direction, inside) {
  const result = [];
  const side = p => ((b[0] - a[0]) * (p[2] - a[2]) - (b[2] - a[2]) * (p[0] - a[0])) * direction;
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i], q = polygon[(i + 1) % polygon.length];
    const dp = side(p), dq = side(q);
    const keepP = inside ? dp >= 0 : dp <= 0;
    const keepQ = inside ? dq >= 0 : dq <= 0;
    if (keepP) result.push(p);
    if (keepP !== keepQ) {
      const t = dp / (dp - dq);
      result.push(p.map((value, k) => value + (q[k] - value) * t));
    }
  }
  return result;
}

function overlapPolygon(polygon, triangle) {
  let intersection = polygon;
  const direction = Math.sign(signedArea(triangle));
  for (let i = 0; i < 3 && intersection.length; i++) {
    intersection = clipHalfPlane(intersection, triangle[i], triangle[(i + 1) % 3], direction, true);
  }
  return intersection;
}

function heightAt(triangle, point) {
  const [a, b, c] = triangle;
  const den = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
  const u = ((b[2] - c[2]) * (point[0] - c[0]) + (c[0] - b[0]) * (point[2] - c[2])) / den;
  const v = ((c[2] - a[2]) * (point[0] - c[0]) + (a[0] - c[0]) * (point[2] - c[2])) / den;
  return u * a[1] + v * b[1] + (1 - u - v) * c[1];
}

function clipHeightBand(polygon, triangle, direction) {
  const result = [];
  const value = p => COPLANAR_HEIGHT - direction * (p[1] - heightAt(triangle, p));
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i], q = polygon[(i + 1) % polygon.length];
    const a = value(p), b = value(q);
    if (a >= 0) result.push(p);
    if ((a >= 0) !== (b >= 0)) {
      const t = a / (a - b);
      result.push(p.map((n, k) => n + (q[k] - n) * t));
    }
  }
  return result;
}

function subtractTriangle(polygon, triangle) {
  let overlap = overlapPolygon(polygon, triangle);
  if (overlap.length < 3 || Math.abs(signedArea(overlap)) < EPS) return [polygon];
  // A bridge and the path under it are independent floors, not duplicates.
  // At a ramp bend only part of the projected overlap may share a floor;
  // trim that height band rather than leaving an intersecting wedge intact.
  overlap = cleanPolygon(clipHeightBand(clipHeightBand(overlap, triangle, 1), triangle, -1));
  if (overlap.length < 3 || Math.abs(signedArea(overlap)) < EPS) return [polygon];
  const outside = [], direction = Math.sign(signedArea(overlap));
  let remaining = polygon;
  for (let i = 0; i < overlap.length && remaining.length; i++) {
    const a = overlap[i], b = overlap[(i + 1) % overlap.length];
    const part = clipHalfPlane(remaining, a, b, direction, false);
    if (part.length >= 3 && Math.abs(signedArea(part)) > EPS) outside.push(part);
    remaining = clipHalfPlane(remaining, a, b, direction, true);
  }
  return outside;
}

function buckets(triangle) {
  const x0 = Math.floor(Math.min(...triangle.map(p => p[0])) / HASH_SIZE);
  const x1 = Math.floor(Math.max(...triangle.map(p => p[0])) / HASH_SIZE);
  const z0 = Math.floor(Math.min(...triangle.map(p => p[2])) / HASH_SIZE);
  const z1 = Math.floor(Math.max(...triangle.map(p => p[2])) / HASH_SIZE);
  const keys = [];
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) keys.push(`${x},${z}`);
  return keys;
}

export function sampleTrackCells(route) {
  const count = Math.ceil(route.length * 2), crossSections = [];
  for (let i = 0; i <= count; i++) {
    const distance = i / count * route.length;
    const f = routeFrame(route, distance), halfWidth = Math.max(.38, f.laneSpacing + .26);
    const vertices = [-1, 1].map(side => {
      const offset = side * halfWidth, p = f.position.clone().addScaledVector(f.right, offset);
      return [p.x, p.y + .025, p.z, offset, f.laneSpacing, distance, halfWidth];
    });
    crossSections.push({vertices, lift: f.lift});
  }
  const cells = [];
  for (let i = 0; i < count; i++) {
    const a = crossSections[i], b = crossSections[i + 1];
    // The lift has its own solid platform; a vertical ribbon has no floor area.
    if (a.lift || b.lift) continue;
    cells.push({
      index: i, distance: (i + .5) / count * route.length,
      triangles: [[a.vertices[0], a.vertices[1], b.vertices[0]], [a.vertices[1], b.vertices[1], b.vertices[0]]],
      edges: [[a.vertices[0], b.vertices[0]], [a.vertices[1], b.vertices[1]]],
    });
  }
  return cells;
}

export function clipTrackWindow(cells, distance, behind = 14, ahead = 97) {
  const candidates = cells.filter(cell => cell.distance >= distance - behind && cell.distance <= distance + ahead);
  // Keep the pavement under/just ahead of the dog authoritative. The distant
  // return leg contributes only uncovered area, with no flashing colour layers.
  candidates.sort((a, b) => Math.abs(a.distance - distance) - Math.abs(b.distance - distance));
  const hash = new Map(), positions = [], surface = [], edges = [], triangles = [];
  let sourceArea = 0, renderedArea = 0, sourceTriangles = 0;
  for (const cell of candidates) {
    let cellSourceArea = 0, cellRenderedArea = 0;
    for (const triangle of cell.triangles) {
      const area = Math.abs(signedArea(triangle));
      if (area < EPS) continue;
      sourceArea += area; cellSourceArea += area; sourceTriangles++;
      const keys = buckets(triangle), previous = new Set();
      for (const key of keys) for (const old of hash.get(key) || []) previous.add(old);
      let fragments = [triangle];
      for (const old of previous) {
        fragments = fragments.flatMap(fragment => subtractTriangle(fragment, old));
        if (!fragments.length) break;
      }
      for (const fragment of fragments) {
        const fragmentArea = Math.abs(signedArea(fragment));
        renderedArea += fragmentArea; cellRenderedArea += fragmentArea;
        for (let i = 1; i < fragment.length - 1; i++) {
          const face = [fragment[0], fragment[i], fragment[i + 1]];
          if (Math.abs(signedArea(face)) < EPS) continue;
          triangles.push(face);
          for (const p of face) { positions.push(...p.slice(0, 3)); surface.push(...p.slice(3)); }
        }
      }
      // Store the original footprint: its union is already covered by this
      // triangle and earlier owners, so later clipping stays small and stable.
      for (const key of keys) { if (!hash.has(key)) hash.set(key, []); hash.get(key).push(triangle); }
    }
    // Skirts are cosmetic. Never add a second pair below a shared return floor.
    if (cellRenderedArea > cellSourceArea * .98) for (const [a, b] of cell.edges) {
      const at = [a[0], a[1] - .02, a[2]], ab = [a[0], a[1] - .22, a[2]];
      const bt = [b[0], b[1] - .02, b[2]], bb = [b[0], b[1] - .22, b[2]];
      edges.push(...at, ...ab, ...bt, ...ab, ...bb, ...bt);
    }
  }
  return {positions, surface, edges, triangles, stats: {sourceTriangles, renderedTriangles: triangles.length, sourceArea, renderedArea, removedArea: sourceArea - renderedArea}};
}

export function createTrackSurface(route) {
  const group = new T.Group(), cells = sampleTrackCells(route);
  const top = new T.Mesh(new T.BufferGeometry(), trackMaterial());
  const skirt = new T.Mesh(new T.BufferGeometry(), toonMaterial({color: '#246782', side: T.DoubleSide}));
  top.receiveShadow = true; group.add(top, skirt);
  let previousKey = null;
  group.userData.updateRouteSurface = (distance, onLift = false) => {
    group.visible = !onLift;
    const key = Math.floor(distance / 2);
    if (key === previousKey) return;
    previousKey = key;
    const data = clipTrackWindow(cells, key * 2);
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(data.positions, 3));
    geometry.setAttribute('routeSurface', new T.Float32BufferAttribute(data.surface, 4));
    geometry.computeVertexNormals(); geometry.computeBoundingSphere();
    top.geometry.dispose(); top.geometry = geometry;
    const edgeGeometry = new T.BufferGeometry();
    edgeGeometry.setAttribute('position', new T.Float32BufferAttribute(data.edges, 3));
    edgeGeometry.computeVertexNormals(); edgeGeometry.computeBoundingSphere();
    skirt.geometry.dispose(); skirt.geometry = edgeGeometry;
    group.userData.surfaceStats = data.stats;
  };
  group.userData.updateRouteSurface(0);
  return group;
}
