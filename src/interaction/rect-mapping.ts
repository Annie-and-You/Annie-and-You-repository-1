import type { PanelPoint, Size, SurfaceMapping, VideoPoint, VideoRect } from '../shared/contracts';

export function sourceToVideo(point: VideoPoint): VideoPoint | null {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) return null;
  return { x: 1 - point.x, y: point.y };
}

/** Deliberately does not clamp: a captured pointer may leave the surface. */
export function createRectMapping(rect: VideoRect): SurfaceMapping | null {
  if (Object.values(rect).some((n) => !Number.isFinite(n)) || rect.width <= 0 || rect.height <= 0 || rect.x < 0 || rect.y < 0 || rect.x + rect.width > 1.000001 || rect.y + rect.height > 1.000001) return null;
  return {
    toVideo: ({ u, v }: PanelPoint) => Number.isFinite(u) && Number.isFinite(v) ? { x: rect.x + u * rect.width, y: rect.y + v * rect.height } : null,
    toPanel: ({ x, y }: VideoPoint) => Number.isFinite(x) && Number.isFinite(y) ? { u: (x - rect.x) / rect.width, v: (y - rect.y) / rect.height } : null,
  };
}

/** CSS object-fit: contain, shared with the SVG's xMidYMid meet viewport. */
export function clientToVideo(point: VideoPoint, box: Readonly<{ left: number; top: number; width: number; height: number }>, source: Size, captured = false): VideoPoint | null {
  if ([point.x, point.y, box.left, box.top, box.width, box.height, source.width, source.height].some((n) => !Number.isFinite(n)) || box.width <= 0 || box.height <= 0 || source.width <= 0 || source.height <= 0) return null;
  const scale = Math.min(box.width / source.width, box.height / source.height);
  const width = source.width * scale, height = source.height * scale;
  const x = (point.x - box.left - (box.width - width) / 2) / width;
  const y = (point.y - box.top - (box.height - height) / 2) / height;
  return captured || (x >= 0 && x <= 1 && y >= 0 && y <= 1) ? { x, y } : null;
}
