import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type Ref } from 'react';
import { createPortal } from 'react-dom';
import { ControlLab, LAB_LAYOUT } from '../controls/control-lab';
import { clientToVideo, createRectMapping } from '../interaction/rect-mapping';
import { SingleHandPointer } from '../interaction/single-hand-pointer';
import type { CancelReason, ControlId, InteractionPointerEvent, PanelPoint, Size, TrackingFrame, VideoRect } from '../shared/contracts';

export interface InteractionLabHandle {
  frame(frame: TrackingFrame | null): void;
  cancel(reason: CancelReason): void;
}

const initialRect: VideoRect = { x: .08, y: .18, width: .84, height: .66 };
const states = { 'no-hand': '先伸入一只手', ambiguous: '两手接近，请先留一只手', 'waiting-open': '先张开五指', hover: '已就绪，五个指尖向前聚拢即可抓取', pressed: '五指已抓拢，张开手即可释放' };
const reasons: Record<CancelReason, string> = { 'tracking-lost': '追踪中断', 'ambiguous-hand': '手部归属不明确', 'mapping-changed': '面板或画面尺寸改变', 'input-takeover': '鼠标或键盘接管', 'session-stopped': '会话停止' };

export function InteractionLab({ ref, host, enabled, sourceSize }: { ref: Ref<InteractionLabHandle>; host: HTMLDivElement | null; enabled: boolean; sourceSize: Size }) {
  const [pointer] = useState(() => new SingleHandPointer());
  const [controls] = useState(() => new ControlLab());
  const mouse = useRef<number | null>(null);
  const manualPointer = useRef<number | null>(null);
  const manualKey = useRef(false);
  const [rect, setRect] = useState(initialRect);
  const [adjusting, setAdjusting] = useState(false);
  const [view, setView] = useState(() => ({ pointer: pointer.snapshot, controls: controls.snapshot }));
  const mapping = useMemo(() => createRectMapping(rect)!, [rect]);
  const refresh = useCallback(() => setView({ pointer: pointer.snapshot, controls: controls.snapshot }), [pointer, controls]);

  const cancel = useCallback((reason: CancelReason) => {
    pointer.cancel(reason, performance.now()).forEach((event) => controls.dispatch(event));
    if (mouse.current !== null) controls.dispatch({ pointerId: `mouse-${mouse.current}`, source: 'mouse', phase: 'cancel', reason, tMs: performance.now() });
    mouse.current = null;
    refresh();
  }, [refresh, pointer, controls]);

  useImperativeHandle(ref, () => ({
    cancel,
    frame(frame) {
      if (!frame) { cancel('tracking-lost'); return; }
      if (!enabled || adjusting || mouse.current !== null || manualPointer.current !== null || manualKey.current) return;
      pointer.process(frame, mapping).forEach((event) => controls.dispatch(event));
      refresh();
    },
  }), [cancel, enabled, adjusting, mapping, refresh, pointer, controls]);

  useEffect(() => {
    const up = (event: PointerEvent) => { if (manualPointer.current === event.pointerId) manualPointer.current = null; };
    const keyUp = () => { manualKey.current = false; };
    const blur = () => { manualPointer.current = null; manualKey.current = false; cancel('input-takeover'); };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', blur);
    };
  }, [cancel]);

  useEffect(() => {
    if (!host) return;
    let previous = '';
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const next = `${entry.contentRect.width}/${entry.contentRect.height}`;
      if (previous && previous !== next) cancel('mapping-changed');
      previous = next;
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, [host, cancel]);

  function updateRect(next: VideoRect) {
    cancel('mapping-changed');
    if (createRectMapping(next)) setRect(next);
  }

  function manualButton(id: 'test-a' | 'test-b') {
    cancel('input-takeover');
    const bounds = LAB_LAYOUT.find((control) => control.id === id)!.bounds;
    const point = { u: bounds.u + bounds.width / 2, v: bounds.v + bounds.height / 2 };
    for (const phase of ['down', 'up'] as const) controls.dispatch({ pointerId: 'mouse-keyboard', source: 'mouse', tMs: performance.now(), point, phase });
    refresh();
  }

  function manualLevel(value: number) {
    cancel('input-takeover');
    const bounds = LAB_LAYOUT.find((control) => control.id === 'level')!.bounds;
    const start = controls.snapshot.level;
    for (const phase of ['down', 'up'] as const) controls.dispatch({ pointerId: 'mouse-keyboard', source: 'mouse', tMs: performance.now(), point: { u: bounds.u + bounds.width / 2, v: .5 + (phase === 'up' ? (start - value) * bounds.height : 0) }, phase });
    refresh();
  }

  function mouseEvent(event: ReactPointerEvent<SVGSVGElement>, phase: 'down' | 'move' | 'up') {
    if (adjusting || !enabled || !host || (phase === 'down' && event.button !== 0)) return;
    if (phase !== 'down' && mouse.current !== event.pointerId) return;
    const videoPoint = clientToVideo({ x: event.clientX, y: event.clientY }, host.getBoundingClientRect(), sourceSize, phase !== 'down');
    const point = videoPoint && mapping.toPanel(videoPoint);
    if (!point) return;
    if (phase === 'down') { cancel('input-takeover'); mouse.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); }
    event.preventDefault();
    const action: InteractionPointerEvent = { pointerId: `mouse-${event.pointerId}`, source: 'mouse', phase, tMs: performance.now(), point };
    controls.dispatch(action);
    if (phase === 'up') { mouse.current = null; event.currentTarget.releasePointerCapture(event.pointerId); }
    refresh();
  }

  const { width: w, height: h } = sourceSize;
  const panel = { x: rect.x * w, y: rect.y * h, width: rect.width * w, height: rect.height * h };
  const textSize = Math.min(panel.width / 26, panel.height / 14);
  const at = (point: PanelPoint) => { const p = mapping.toVideo(point)!; return { x: p.x * w, y: p.y * h }; };
  const cursor = view.pointer.point && at(view.pointer.point);
  const captured = view.controls.captured;
  const names: Record<ControlId, string> = { 'test-a': '按钮 A', 'test-b': '按钮 B', level: '测试推子' };

  return <div className="interaction-lab">
    {host && enabled && createPortal(<svg className={`interaction-overlay ${adjusting ? 'is-adjusting' : ''}`} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="单手交互面板，支持五指抓拢或鼠标操作" onPointerDown={(event) => mouseEvent(event, 'down')} onPointerMove={(event) => mouseEvent(event, 'move')} onPointerUp={(event) => mouseEvent(event, 'up')} onPointerCancel={() => cancel('input-takeover')} onLostPointerCapture={() => { if (mouse.current !== null) cancel('input-takeover'); }}>
      <rect {...panel} rx={10} className="surface-outline" />
      <text x={panel.x + panel.width * .07} y={panel.y + panel.height * .09} fontSize={textSize * .65} className="surface-caption">{adjusting ? '调整面板，完成后先张开手' : '五指抓拢实验'}</text>
      {LAB_LAYOUT.map(({ id, bounds, kind }) => {
        const origin = at({ u: bounds.u, v: bounds.v });
        const width = bounds.width * panel.width, height = bounds.height * panel.height;
        const active = captured === id;
        return <g key={id} className={active ? 'control-captured' : ''}>
          <rect x={origin.x} y={origin.y} width={width} height={height} rx={kind === 'button' ? 9 : 6} className={kind === 'button' ? 'surface-button' : 'surface-fader'} />
          {kind === 'button' ? <><text x={origin.x + width * .08} y={origin.y + height * .43} fontSize={textSize} className="control-name">{names[id]}</text><text x={origin.x + width * .08} y={origin.y + height * .76} fontSize={textSize * .65} className="control-detail">已触发 {id === 'test-a' ? view.controls.a : view.controls.b} 次</text><circle cx={origin.x + width * .87} cy={origin.y + height / 2} r={textSize * .28} className="control-light" /></>
          : <><line x1={origin.x + width / 2} y1={origin.y + 8} x2={origin.x + width / 2} y2={origin.y + height - 8} className="fader-track" /><rect x={origin.x + width * .15} y={origin.y + (1 - view.controls.level) * height - 5} width={width * .7} height={10} rx={3} className="fader-thumb" /><text x={origin.x + width / 2} y={origin.y + height + textSize * 1.2} textAnchor="middle" fontSize={textSize * .8} className="control-name">{Math.round(view.controls.level * 100)}%</text></>}
        </g>;
      })}
      {cursor && !adjusting && <g className={`interaction-cursor ${view.pointer.state === 'pressed' ? 'is-pinched' : ''}`}><circle cx={cursor.x} cy={cursor.y} r={w / 75} /><circle cx={cursor.x} cy={cursor.y} r={w / 250} /></g>}
    </svg>, host)}
    <div className="interaction-heading"><h2>五指抓拢实验</h2><button className="text-button" disabled={!enabled} aria-expanded={adjusting} onClick={() => { cancel('mapping-changed'); setAdjusting(!adjusting); }}>{adjusting ? '完成调整' : '调整面板'}</button></div>
    <p className={`gesture-state ${view.pointer.state === 'pressed' ? 'is-pinched' : ''}`} role="status">{!enabled ? '开启摄像头后，先让一只手完整入镜。' : adjusting ? '调整时暂停手势，完成后重新张开手。' : states[view.pointer.state]}{enabled && view.pointer.ratio !== null && <span>聚拢比 {view.pointer.ratio.toFixed(2)}</span>}</p>
    {adjusting && <fieldset className="surface-settings"><legend>面板位置与大小</legend>{([
      ['x', '水平位置', 0, 1 - rect.width], ['y', '垂直位置', 0, 1 - rect.height], ['width', '面板宽度', .4, 1 - rect.x], ['height', '面板高度', .4, 1 - rect.y],
    ] as const).map(([key, label, min, max]) => <label key={key}>{label}<input type="range" min={min} max={max} step={.01} value={rect[key]} onChange={(event) => updateRect({ ...rect, [key]: Number(event.target.value) })} /></label>)}</fieldset>}
    <p className="gesture-instructions">先张开五指，用掌心圆环对准控件，再把五个指尖向前聚拢。按钮张开手时生效，推子抓拢后移动；丢手或归属不明确会取消，重新张开后再操作。</p>
    <div className="manual-controls" role="group" aria-label="鼠标与键盘后备操作" onPointerDownCapture={(event) => { cancel('input-takeover'); manualPointer.current = event.pointerId; }} onKeyDownCapture={(event) => { if ([' ', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) { cancel('input-takeover'); manualKey.current = true; } }}><button onClick={() => manualButton('test-a')}>按钮 A <output>{view.controls.a}</output></button><button onClick={() => manualButton('test-b')}>按钮 B <output>{view.controls.b}</output></button><label>测试推子 <output>{Math.round(view.controls.level * 100)}%</output><input aria-label="测试推子" type="range" min={0} max={1} step={.01} value={view.controls.level} onChange={(event) => manualLevel(Number(event.target.value))} /></label></div>
    <p className="interaction-note">{view.controls.lastCancel ? `最近取消：${reasons[view.controls.lastCancel]}。` : '下方可用鼠标或键盘对照操作。'} 计数包含手势与后备操作；尚未连接音乐。</p>
  </div>;
}
