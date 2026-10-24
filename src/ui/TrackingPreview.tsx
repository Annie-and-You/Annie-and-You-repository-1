import type { TrackingFrame } from '../shared/contracts';

const connections = [
  [0, 1, 2, 3, 4],
  [0, 5, 6, 7, 8],
  [5, 9, 10, 11, 12],
  [9, 13, 14, 15, 16],
  [13, 17, 18, 19, 20],
  [17, 0],
] as const;

export function TrackingPreview({ frame }: { frame: TrackingFrame | null }) {
  const hasHands = Boolean(frame?.hands.length);
  const width = frame?.sourceSize.width ?? 1280;
  const height = frame?.sourceSize.height ?? 720;

  return (
    <div className="tracking-preview">
      <div className="preview-topline" aria-hidden="true">
        <span><span className="preview-dot" /> SAMPLE VIEW</span>
        <span>镜像预览</span>
      </div>
      <svg
        className="skeleton-view"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={hasHands ? `${frame!.hands.length} 只模拟手的关键点骨架` : '当前没有手部骨架'}
      >
        <defs>
          <pattern id="preview-grid" width="64" height="64" patternUnits="userSpaceOnUse">
            <path d="M 64 0 L 0 0 0 64" fill="none" stroke="#28342c" strokeWidth="1" />
            <circle cx="0" cy="0" r="2" fill="#3b493f" />
          </pattern>
        </defs>
        <rect width={width} height={height} fill="url(#preview-grid)" />
        <path
          d={`M ${width / 2 - 16} ${height / 2} h 32 M ${width / 2} ${height / 2 - 16} v 32`}
          stroke="#4b5c4e"
          strokeWidth="1.5"
        />
        {/* 原始关键点只在此镜像一次，文字与控件在 SVG 外。 */}
        <g transform={`translate(${width} 0) scale(-1 1)`}>
          {frame?.hands.map((hand, handIndex) => {
            const color = hand.handedness === 'Left' ? '#d6f77c' : '#f4a97b';
            return (
              <g key={handIndex}>
                {connections.map((chain, index) => (
                  <polyline
                    key={index}
                    points={chain.map((joint) => {
                      const point = hand.landmarks[joint];
                      return point ? `${point.x * width},${point.y * height}` : '';
                    }).join(' ')}
                    fill="none"
                    stroke={color}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.8"
                  />
                ))}
                {hand.landmarks.map((point, joint) => (
                  <g key={joint}>
                    {joint === 8 && (
                      <circle cx={point.x * width} cy={point.y * height} r="23" fill={color} opacity="0.12" />
                    )}
                    <circle
                      cx={point.x * width}
                      cy={point.y * height}
                      r={joint === 8 ? 8 : 4.5}
                      fill={joint === 8 ? color : '#18231b'}
                      stroke={color}
                      strokeWidth="2"
                    />
                  </g>
                ))}
              </g>
            );
          })}
        </g>
      </svg>
      {!hasHands && (
        <div className="preview-empty">
          <span className="empty-symbol" aria-hidden="true">＋</span>
          <h3>{frame ? '本帧没有手' : '等待第一个样本'}</h3>
          <p>{frame ? '可以切换为单手或双手，再生成一帧。' : '选择手部数量，点击“生成下一帧”。'}</p>
        </div>
      )}
      <div className="preview-bottomline">
        <span>模拟关键点 · 非摄像头画面</span>
        {hasHands && <span className="hand-legend"><i /> 左手样本{frame!.hands.length === 2 && <><i /> 右手样本</>}</span>}
      </div>
    </div>
  );
}
