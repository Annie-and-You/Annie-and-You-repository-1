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
          <div><h1>聚拢五指，抓住控件。</h1><p className="intro">用掌心定位，五个指尖向前聚拢，张开手释放。</p></div>
          <div className="experiment-label"><span aria-hidden="true">⌁</span><p>单手交互实验<small>张开、聚拢、移动、释放</small></p></div>
        </div>
        <CameraExperiment />
        <section className="next-note" aria-label="实验说明">
          <div><span className="note-icon" aria-hidden="true">◎</span><p><strong>先张开五指，再向前聚拢</strong><span>让手腕和全部指尖入镜，用掌心圆环对准控件。按钮张开手时生效；抓住推子后可移出控件，停止或丢手会释放抓取。</span></p></div>
          <p className="scope-note">当前为二维单手实验。<br />音乐、桌面透视与双手独立控制尚未接入。</p>
        </section>
      </main>
      <footer className="page-footer"><span>Gesture DJ / 动作实验室</span><a href={`${import.meta.env.BASE_URL}THIRD_PARTY_NOTICES.txt`} target="_blank" rel="noreferrer">第三方许可</a></footer>
    </div>
  );
}
