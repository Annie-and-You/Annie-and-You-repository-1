import type { HandObservation } from '../shared/contracts';

export type Delegate = 'GPU' | 'CPU';
export interface TrackingConfig { delegate: Delegate; numHands: 1 | 2 }

export type WorkerRequest =
  | { type: 'init'; config: TrackingConfig; baseUrl: string }
  | { type: 'frame'; ticket: number; bitmap: ImageBitmap; timestampMs: number };

export type WorkerReply =
  | { type: 'ready'; delegate: Delegate; fallback: boolean }
  | { type: 'result'; ticket: number; hands: readonly HandObservation[]; inferenceMs: number }
  | { type: 'fallback'; delegate: 'CPU'; ticket: number }
  | { type: 'error'; message: string };
