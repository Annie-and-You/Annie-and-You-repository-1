import type { TrackingFrame } from '../shared/contracts';

const chains = [[0, 1, 2, 3, 4], [0, 5, 6, 7, 8], [5, 9, 10, 11, 12], [9, 13, 14, 15, 16], [13, 17, 18, 19, 20], [17, 0]];

/** Canvas coordinates and camera share the full source aspect ratio; mirror once. */
export function drawTracking(canvas: HTMLCanvasElement, frame: TrackingFrame | null): void {
  if (frame) {
    if (canvas.width !== frame.sourceSize.width) canvas.width = frame.sourceSize.width;
    if (canvas.height !== frame.sourceSize.height) canvas.height = frame.sourceSize.height;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const hand of frame?.hands ?? []) {
    if (hand.landmarks.length !== 21 || hand.landmarks.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) continue;
    ctx.strokeStyle = hand.handedness === 'Left' ? '#ffd487' : '#80d7ff';
    ctx.lineWidth = Math.max(2, canvas.width / 400);
    ctx.lineCap = 'round';
    for (const chain of chains) {
      ctx.beginPath();
      chain.forEach((joint, index) => {
        const p = hand.landmarks[joint]!;
        const x = (1 - p.x) * canvas.width;
        const y = p.y * canvas.height;
        if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
    hand.landmarks.forEach((p, index) => {
      const x = (1 - p.x) * canvas.width;
      const y = p.y * canvas.height;
      const fingertip = [4, 8, 12, 16, 20].includes(index);
      ctx.fillStyle = fingertip ? '#ffffff' : '#142b43';
      ctx.beginPath(); ctx.arc(x, y, fingertip ? 5 : 3.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    });
  }
}
