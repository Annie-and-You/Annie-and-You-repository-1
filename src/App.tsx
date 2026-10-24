import { useState } from 'react';
import type { TrackingFrame } from './shared/contracts';
import { createMockTrackingFrame } from './tracking/mock-tracking';
import { TrackingPreview } from './ui/TrackingPreview';

const stages = [
  ['S0', '工程基础'],
  ['S1', '摄像头实验'],
  ['S2', '单手控件'],
  ['S3', '单曲集成'],
  ['S4', '桌面透视'],
  ['S5', '双手控制'],
] as const;

export default function App() {
  const [handCount, setHandCount] = useState<0 | 1 | 2>(1);
  const [sampleIndex, setSampleIndex] = useState(0);
  const [frame, setFrame] = useState<TrackingFrame | null>(null);

  function selectHands(count: 0 | 1 | 2) {
    setHandCount(count);
    setFrame(null);
  }

  function nextSample() {
    const next = sampleIndex + 1;
    setSampleIndex(next);
    setFrame(createMockTrackingFrame(next, performance.now(), handCount));
  }

  function reset() {
    setHandCount(1);
    setSampleIndex(0);
    setFrame(null);
  }

  const pointCount = frame?.hands.reduce(
    (total, hand) => total + hand.landmarks.length,
    0,
  );

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#main" aria-label="Gesture DJ，跳至主内容">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
          GESTURE<span className="brand-slash">/</span>DJ
        </a>
        <span className="header-caption">LOCAL INTERACTION LAB</span>
        <span className="phase-badge"><span className="status-dot" /> S0 · 工程基础</span>
      </header>

      <main id="main">
        <div className="page-heading">
          <div>
            <p className="eyebrow">从一帧输入开始 / INPUT FIRST</p>
            <h1>手势输入实验台<span className="heading-dot">.</span></h1>
            <p className="intro">检查手部样本与画面，为接入摄像头和音乐做好准备。</p>
          </div>
          <div className="local-label"><span className="status-dot" /> 本地运行</div>
        </div>

        <div className="workbench">
          <section className="preview-card" aria-labelledby="preview-title">
            <div className="card-heading">
              <h2 id="preview-title">输入预览</h2>
              <span className="source-badge">模拟输入</span>
            </div>
            <TrackingPreview frame={frame} />
            <div className="sample-controls">
              <fieldset>
                <legend>模拟手部数量</legend>
                <div className="segmented-control">
                  {([0, 1, 2] as const).map((count) => (
                    <label key={count}>
                      <input
                        type="radio"
                        name="hands"
                        value={count}
                        checked={handCount === count}
                        onChange={() => selectHands(count)}
                      />
                      <span>{['无手', '单手', '双手'][count]}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="control-actions">
                <button className="button-secondary" onClick={reset}>重置</button>
                <button className="button-primary" onClick={nextSample}>
                  生成下一帧 <span aria-hidden="true">↗</span>
                </button>
              </div>
            </div>
          </section>

          <aside className="inspector" aria-label="输入与接入状态">
            <section className="info-card" aria-labelledby="sample-title">
              <div className="card-heading">
                <h2 id="sample-title">当前样本</h2>
                <span className="small-mono">FRAME</span>
              </div>
              <div className="sample-number" aria-live="polite" aria-atomic="true">
                <span>{frame ? `#${String(frame.frameId).padStart(3, '0')}` : '—'}</span>
                <p>{frame ? (frame.hands.length ? '样本已生成' : '无手样本') : '等待采样'}</p>
              </div>
              <dl className="sample-details">
                <div><dt>输入来源</dt><dd>模拟数据</dd></div>
                <div><dt>手部数量</dt><dd>{frame?.hands.length ?? '—'}</dd></div>
                <div><dt>关键点总数</dt><dd>{pointCount ?? '—'}</dd></div>
                <div><dt>样本尺寸</dt><dd className="small-mono">1280 × 720</dd></div>
                <div><dt>追踪性能</dt><dd className="muted">未测量</dd></div>
              </dl>
            </section>

            <section className="info-card connections" aria-labelledby="connection-title">
              <h2 id="connection-title">接入状态</h2>
              <ul>
                <li><span>页面与样本</span><span className="ready-label">可用</span></li>
                <li><span>摄像头追踪</span><span>待 S1</span></li>
                <li><span>本地音频</span><span>待 A1</span></li>
              </ul>
              <p>下一步：用真实摄像头检查机位、双手活动范围与追踪表现。</p>
            </section>
          </aside>
        </div>

        <section className="roadmap" aria-label="项目阶段">
          {stages.map(([id, name], index) => (
            <div key={id} className={`stage ${index === 0 ? 'stage-current' : ''}`}>
              <span className="stage-id">{id}</span>
              <span>{name}</span>
              {index === 0 && <span className="stage-now">当前</span>}
            </div>
          ))}
        </section>

        <footer className="page-footer">
          <p><span className="notice-mark" aria-hidden="true">i</span> 本页使用模拟样本，尚未连接摄像头；没有申请摄像头或麦克风权限。</p>
          <span className="small-mono">GESTURE DJ / FOUNDATION</span>
        </footer>
      </main>
    </div>
  );
}
