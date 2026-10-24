import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const target = resolve(root, 'public/tracking');
const modelHash = 'fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1';
const modelUrl = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const destination = resolve(target, 'hand_landmarker.task');
const cached = resolve(root, '.cache/assets/hand_landmarker.task');
const valid = (buffer) => createHash('sha256').update(buffer).digest('hex') === modelHash;

await mkdir(target, { recursive: true });
let model;
for (const path of [destination, cached]) {
  try { const data = await readFile(path); if (valid(data)) { model = data; break; } }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
if (!model) {
  console.log('Preparing pinned Hand Landmarker model (development setup only)…');
  const response = await fetch(modelUrl, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`Model preparation failed: HTTP ${response.status}`);
  model = Buffer.from(await response.arrayBuffer());
  if (!valid(model)) throw new Error('Model SHA-256 mismatch; refusing the downloaded resource.');
  await mkdir(resolve(root, '.cache/assets'), { recursive: true });
  await writeFile(cached, model);
}
await writeFile(destination, model);
await cp(resolve(root, 'node_modules/@mediapipe/tasks-vision/wasm'), resolve(target, 'wasm'), { recursive: true });
console.log('Local tracking assets ready: MediaPipe 1.1.1 / hand_landmarker float16 v1.');
