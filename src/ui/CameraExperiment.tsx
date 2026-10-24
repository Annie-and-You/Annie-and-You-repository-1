import { useCallback, useEffect, useRef, useState } from 'react';
import { CameraSession, type ResolutionPreset } from '../camera/camera-session';
import type { TrackingFrame } from '../shared/contracts';
import { createMockTrackingFrame } from '../tracking/mock-tracking';
import { TrackingSession, type TrackingStatus } from '../tracking/tracking-session';
import type { Delegate } from '../tracking/worker-protocol';
import { drawTracking } from './draw-tracking';
import { TrackingPreview } from './TrackingPreview';

const initialStatus: TrackingStatus = { status: 'stopped', delegate: 'GPU', numHands: 2, fallback: false, hands: 0, metrics: null, error: null };
const number = (value: number | null | undefined, unit = '', digits = 0) => value === null || value === undefined ? '—' : `${value.toFixed(digits)}${unit}`;

function cameraError(error: unknown): string {
  const name = error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return '摄像头权限未获允许。请在地址栏的站点权限中允许摄像头，再重新启用。';
  if (name === 'NotFoundError') return '未找到摄像头。请连接或启用摄像头后重试。';
  if (name === 'NotReadableError' || name === 'AbortError') return '摄像头无法读取。请关闭可能占用摄像头的会议或录制软件后重试。';
  return '摄像头未能启动。请使用桌面版 Edge 的 localhost 地址，并检查系统摄像头权限。';
}

export function CameraExperiment() {
  const [mode, setMode] = useState<'camera' | 'mock'>('camera');
  const [preset, setPreset] = useState<ResolutionPreset>('640');
  const [delegate, setDelegate] = useState<Delegate>('GPU');
  const [numHands, setNumHands] = useState<1 | 2>(2);
  const [requesting, setRequesting] = useState(false);
  const [status, setStatus] = useState<TrackingStatus>(initialStatus);
  const [settings, setSettings] = useState<MediaTrackSettings | null>(null);
  const [notice, setNotice] = useState('开启后只申请摄像头，不申请麦克风。');
  const [mockHands, setMockHands] = useState<0 | 1 | 2>(2);
  const [mockFrame, setMockFrame] = useState<TrackingFrame | null>(null);
  const sampleIndex = useRef(0);
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const camera = useRef(new CameraSession());
  const tracker = useRef<TrackingSession | null>(null);
  const generation = useRef(0);
  const busy = requesting || status.status === 'loading' || status.status === 'running';

  const release = useCallback(() => {
    tracker.current?.stop();
    generation.current++;
    tracker.current = null;
    camera.current.stop();
    if (canvas.current) drawTracking(canvas.current, null);
  }, []);

  const stop = useCallback((message = '摄像头已停止。本轮数据已保留，重新开启会开始新的计量。') => {
    release();
    setRequesting(false);
    setStatus((current) => ({ ...current, status: 'stopped', hands: 0, error: null }));
    setNotice(message);
  }, [release]);

  useEffect(() => {
    const hidden = () => { if (document.hidden) stop('页面已隐藏，摄像头与追踪已停止。回到页面后请重新开启。'); };
    document.addEventListener('visibilitychange', hidden);
    return () => {
      document.removeEventListener('visibilitychange', hidden);
      release();
    };
  }, [release, stop]);

  async function start() {
    if (!video.current || !canvas.current || busy) return;
    const current = ++generation.current;
    setRequesting(true);
    setStatus({ ...initialStatus, delegate, numHands });
    setSettings(null);
    setNotice('等待摄像头权限；允许后开始本地识别。');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera unavailable');
      const actual = await camera.current.start(video.current, preset);
      if (current !== generation.current || !actual) return;
      setSettings({ ...actual, width: video.current.videoWidth || actual.width || 0, height: video.current.videoHeight || actual.height || 0 });
      setRequesting(false);
      const session = new TrackingSession(video.current, { delegate, numHands }, {
        frame(frame) { if (current === generation.current && canvas.current) drawTracking(canvas.current, frame); },
        state(next) {
          if (current !== generation.current) return;
          setStatus(next);
          if (next.status === 'error') { camera.current.stop(); setNotice('调整配置后可以重新开启；模拟输入仍可使用。'); }
          else if (next.status === 'running') setNotice(next.fallback ? 'GPU 不可用，已转为 CPU。本轮单独计量 CPU 表现。' : '把手腕与全部指尖放进画面，尝试自然移动。');
          else if (next.status === 'loading') setNotice('正在加载本地识别资源，摄像头画面已开启。');
        },
      });
      tracker.current = session;
      const stream = video.current.srcObject as MediaStream;
      stream.getVideoTracks().forEach((track) => track.addEventListener('ended', () => { if (current === generation.current) stop('摄像头已断开。请检查设备后重新开启。'); }, { once: true }));
      session.start();
    } catch (error) {
      if (current !== generation.current) return;
      camera.current.stop();
      setRequesting(false);
      setStatus({ ...initialStatus, status: 'error', error: cameraError(error) });
    }
  }

  function changeMode(next: 'camera' | 'mock') {
    if (mode === next) return;
    stop();
    setMode(next);
    setMockFrame(null);
  }

  const metrics = mode === 'camera' ? status.metrics : null;
  const running = status.status === 'running';
  const stateText = mode === 'mock' ? '模拟输入' : requesting ? '等待授权' : status.status === 'loading' ? '加载识别' : running ? '追踪中' : status.status === 'error' ? '需要处理' : '未开启';

  return (
    <section className="experiment" aria-label="手部追踪实验台">
      <div className="experiment-toolbar">
        <div className="source-switch" role="group" aria-label="输入来源"><button aria-pressed={mode === 'camera'} onClick={() => changeMode('camera')}>摄像头</button><button aria-pressed={mode === 'mock'} onClick={() => changeMode('mock')}>模拟输入</button></div>
        <span className={`session-indicator ${running && mode === 'camera' ? 'is-running' : ''}`}><i />{stateText}</span>
      </div>
      <div className="workbench">
        <div className="visual-workspace">
          <div className="camera-view" hidden={mode !== 'camera'} style={{ aspectRatio: settings?.width && settings.height ? `${settings.width} / ${settings.height}` : '16 / 9' }}>
            <video ref={video} muted playsInline aria-label="镜像摄像头画面" />
            <canvas ref={canvas} aria-label="手部骨架与食指尖位置" role="img" />
            <div className="view-label"><span>镜像画面</span><span>{settings?.width ? `${settings.width} × ${settings.height}` : '等待视频输入'}</span></div>
            {!busy && <div className="camera-empty"><div className="capture-symbol" aria-hidden="true"><span /><i /><b /><em /></div><h2>{status.status === 'error' ? '先检查摄像头连接' : '你的动作，从这里开始'}</h2><p>{status.status === 'error' ? '根据下方提示处理，再重新开启。' : '开启摄像头，让双手完整进入画面。'}</p><span className="privacy-tag">仅本地处理，无需录制</span></div>}
            <div className="view-legend"><span><i /> 手部骨架</span><span><i /> 食指尖</span><span>最多 {numHands} 只手</span></div>
          </div>
          {mode === 'mock' && <TrackingPreview frame={mockFrame} />}
          <div className="workspace-message" role="status"><span className="message-icon" aria-hidden="true">{status.status === 'error' && mode === 'camera' ? '!' : 'i'}</span><p>{mode === 'mock' ? '模拟样本只检查骨架与界面，不代表真实识别表现。' : status.error ?? notice}</p></div>
        </div>
        <aside className="inspector" aria-label="会话诊断">
          <div className="inspector-heading"><h2>会话诊断</h2><span>每 0.5 秒更新</span></div>
          <div className="hand-readout"><strong>{mode === 'mock' ? mockFrame?.hands.length ?? '—' : running ? status.hands : '—'}</strong><span>只手入镜<small>{mode === 'mock' ? '离散生成的示例' : '模型返回数量，非稳定身份'}</small></span></div>
          <dl className="diagnostic-list"><div><dt>实际视频</dt><dd>{mode === 'camera' && settings?.width ? `${settings.width} × ${settings.height}` : '—'}</dd></div><div><dt>设备帧率</dt><dd>{mode === 'camera' ? number(settings?.frameRate, ' fps', 1) : '—'}</dd></div><div><dt>识别配置</dt><dd>{mode === 'camera' && metrics ? `${status.delegate} / ${status.numHands} 手` : '—'}</dd></div></dl>
          <div className="performance-readout"><span>有效结果频率</span><p>{number(metrics?.validHz, '', 1)}<small>Hz</small></p><span>{mode === 'mock' ? '模拟输入不计性能' : busy ? '本轮平均值' : metrics ? '已停止，保留本轮汇总' : '开启后开始计量'}</span></div>
          <dl className="diagnostic-list performance-details"><div><dt>有效结果比例</dt><dd>{number(metrics?.validPercent, '%', 1)}</dd></div><div><dt>采样到返回 p50</dt><dd>{number(metrics?.latencyP50, ' ms')}</dd></div><div><dt>采样到返回 p95</dt><dd>{number(metrics?.latencyP95, ' ms')}</dd></div><div><dt>推理耗时 p95</dt><dd>{number(metrics?.inferenceP95, ' ms')}</dd></div><div><dt>已返回帧</dt><dd>{metrics?.processed ?? '—'}</dd></div></dl>
          <p className="measurement-note">有效结果要求配置数量的手均有完整、有限且在画面内的 21 点。比例按已返回帧计算；忙时跳过旧帧。软件耗时不等于动作到声音的延迟。</p>
        </aside>
      </div>
      {mode === 'camera' ? <div className="camera-controls"><div className="configuration">
        <label>请求分辨率<select value={preset} disabled={busy} onChange={(event) => setPreset(event.target.value as ResolutionPreset)}><option value="640">640 × 480</option><option value="720">1280 × 720</option></select></label>
        <label>识别后端<select value={delegate} disabled={busy} onChange={(event) => setDelegate(event.target.value as Delegate)}><option value="GPU">GPU 优先</option><option value="CPU">CPU</option></select></label>
        <label>检测手数<select value={numHands} disabled={busy} onChange={(event) => setNumHands(Number(event.target.value) as 1 | 2)}><option value={1}>单手</option><option value={2}>双手</option></select></label>
      </div><button className={busy ? 'button-stop' : 'button-primary'} onClick={() => busy ? stop() : void start()}>{busy ? '停止摄像头' : '开启摄像头'}<span aria-hidden="true">{busy ? '■' : '●'}</span></button></div>
      : <div className="camera-controls mock-controls"><fieldset><legend>模拟手部数量</legend><div className="segmented-control">{([0, 1, 2] as const).map((count) => <label key={count}><input type="radio" name="hands" value={count} checked={mockHands === count} onChange={() => { setMockHands(count); setMockFrame(null); }} /><span>{['无手', '单手', '双手'][count]}</span></label>)}</div></fieldset><div className="mock-actions"><button className="button-secondary" onClick={() => { sampleIndex.current = 0; setMockHands(2); setMockFrame(null); }}>重置</button><button className="button-primary" onClick={() => setMockFrame(createMockTrackingFrame(++sampleIndex.current, performance.now(), mockHands))}>生成下一帧<span aria-hidden="true">＋</span></button></div></div>}
    </section>
  );
}
