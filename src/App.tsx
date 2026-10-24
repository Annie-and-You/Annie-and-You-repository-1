import { CameraExperiment } from './ui/CameraExperiment';

export default function App() {
  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#main" aria-label="Gesture DJ，跳至主内容"><span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>Gesture DJ</a>
        <span className="header-caption">把动作，变成声音。</span>
        <span className="local-label"><span className="status-dot" /> 媒体留在本机</span>
      </header>
      <main id="main">
        <div className="page-heading">
          <div><h1>让双手进入画面。</h1><p className="intro">先找到舒服的机位，再让音乐跟上你的动作。</p></div>
          <div className="experiment-label"><span aria-hidden="true">⌁</span><p>摄像头实验<small>检查画面、手部与追踪表现</small></p></div>
        </div>
        <CameraExperiment />
        <section className="next-note" aria-label="实验说明">
          <div><span className="note-icon" aria-hidden="true">◎</span><p><strong>让手腕和全部指尖都入镜</strong><span>在正常室内光下试试单手、双手和完整的拖动轨迹。调整屏幕角度，找到自然的操作范围。</span></p></div>
          <p className="scope-note">本页验证摄像头与手部追踪。<br />音乐、捏合控件和桌面对齐尚未接入。</p>
        </section>
      </main>
      <footer className="page-footer"><span>Gesture DJ / 动作实验室</span><a href={`${import.meta.env.BASE_URL}THIRD_PARTY_NOTICES.txt`} target="_blank" rel="noreferrer">第三方许可</a></footer>
    </div>
  );
}
