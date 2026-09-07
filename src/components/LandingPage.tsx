import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CheckCheck,
  Gavel,
  PenLine,
} from "lucide-react";
import "./landing.css";

function PublicHeader() {
  return (
    <header className="public-header">
      <a href="/" className="public-brand" aria-label="安提柯议会首页">
        <img src="/logo.png" alt="" />
        <span>
          安提柯议会<small>ANTICO COUNCIL</small>
        </span>
      </a>
      <nav aria-label="首页导航">
        <a href="/#about">关于议会</a>
        <a href="/#spaces">协作空间</a>
        <a href="/#journal">文字与记录</a>
      </nav>
      <a className="public-enter" href="/workspace">
        进入工作台
        <ArrowUpRight size={16} />
      </a>
    </header>
  );
}

function PublicFooter() {
  return (
    <footer className="public-footer">
      <div>
        <a className="footer-wordmark" href="/">
          安提柯议会<span>ANTICO COUNCIL</span>
        </a>
        <p>在交流中拓展视野，在协作中推进想法。</p>
      </div>
      <div className="public-footer-links">
        <a href="/workspace">
          协作工作台
          <ArrowUpRight size={14} />
        </a>
        <a href="/blog">
          文字与记录
          <ArrowUpRight size={14} />
        </a>
        <span>© {new Date().getFullYear()} Antico Council</span>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <div className="public-site">
      <PublicHeader />
      <main>
        <section className="landing-hero">
          <div className="hero-copy">
            <span className="public-eyebrow">
              <span />
              一个共同讨论与协作的空间
            </span>
            <h1>
              让讨论有回响，
              <br />
              让共识有<span className="hero-emphasis">行动。</span>
            </h1>
            <p>
              从一次例会、一场沙龙，到一篇文章、一项共同计划。
              <br className="desktop-break" />
              在安提柯议会，我们一起提出问题，也一起推动答案。
            </p>
            <div className="hero-actions">
              <a className="public-button" href="/workspace">
                进入协作工作台
                <ArrowUpRight size={18} />
              </a>
              <a className="public-text-link" href="#about">
                了解我们的空间
                <ArrowDown size={16} />
              </a>
            </div>
            <div className="hero-footnote">
              <span>讨论</span>
              <i />
              <span>决议</span>
              <i />
              <span>行动</span>
              <span className="hero-footnote-line" />
            </div>
          </div>
          <div
            className="council-art"
            aria-label="以圆桌为意象的议会插画"
            role="img"
          >
            <span className="art-corner top-left" />
            <span className="art-corner bottom-right" />
            <div className="art-caption">
              <span>THE COUNCIL</span>
              <span>共同参与，共同推进。</span>
            </div>
            <svg
              className="council-orbit"
              viewBox="0 0 500 470"
              fill="none"
              aria-hidden="true"
            >
              <circle
                cx="250"
                cy="230"
                r="169"
                stroke="#a7c1c0"
                strokeOpacity=".35"
              />
              <circle
                cx="250"
                cy="230"
                r="118"
                stroke="#a7c1c0"
                strokeOpacity=".28"
                strokeDasharray="3 8"
              />
              <circle
                cx="250"
                cy="230"
                r="72"
                fill="#264b5b"
                stroke="#a7c1c0"
                strokeOpacity=".3"
              />
              {Array.from({ length: 12 }, (_, i) => {
                const angle = ((i * 30 - 90) * Math.PI) / 180;
                return (
                  <g
                    key={i}
                    transform={`translate(${250 + 169 * Math.cos(angle)} ${230 + 169 * Math.sin(angle)}) rotate(${i * 30})`}
                  >
                    <rect
                      x="-12"
                      y="-12"
                      width="24"
                      height="24"
                      rx="9"
                      fill={
                        i === 0 || i === 4 || i === 8 ? "#dbba88" : "#799a9a"
                      }
                    />
                    <path
                      d="M-6 2Q0-5 6 2"
                      stroke="#183c4b"
                      strokeWidth="1.2"
                    />
                  </g>
                );
              })}
              <path
                d="M214 230H286M250 194V266"
                stroke="#dbc7a6"
                strokeWidth="1.2"
              />
              <circle
                cx="250"
                cy="230"
                r="26"
                stroke="#dbc7a6"
                strokeWidth="1.2"
              />
              <circle cx="250" cy="230" r="6" fill="#dbc7a6" />
              <path d="M45 410H455" stroke="#a7c1c0" strokeOpacity=".3" />
            </svg>
            <div className="art-bottom">
              <span>
                每一个声音，
                <br />
                都让讨论更完整。
              </span>
              <span className="art-edition">
                DISCUSS.
                <br />
                DECIDE.
                <br />
                DO.
              </span>
            </div>
          </div>
        </section>
        <section className="landing-about" id="about">
          <div className="section-label">
            <span>01 / ABOUT</span>
            <span>关于这个空间</span>
          </div>
          <div>
            <h2>
              把零散的想法，
              <br />
              变成持续的共同工作。
            </h2>
            <p>
              好的讨论需要空间，也需要后续。我们把例会议程、执行进度、沙龙安排和编辑协作放在一起，让想法有人接续，让过程有迹可循。
            </p>
            <p>这里既是相聚交流的入口，也是一起把事情做下去的工作台。</p>
          </div>
          <span className="about-symbol" aria-hidden="true">
            &
          </span>
        </section>
        <section className="landing-spaces" id="spaces">
          <div className="section-label">
            <span>02 / COLLABORATE</span>
            <span>从交流到行动</span>
          </div>
          <div className="spaces-heading">
            <h2>
              给每一种协作，
              <br />
              一个清晰的位置。
            </h2>
            <a className="public-text-link" href="/workspace">
              打开工作台
              <ArrowUpRight size={17} />
            </a>
          </div>
          <div className="space-grid">
            {[
              {
                number: "01",
                icon: Gavel,
                title: "一起议事",
                text: "整理议题、成员签到、记录汇报与表决。让讨论有准备，让决议有依据。",
                tags: "例会 · 议程 · 表决",
              },
              {
                number: "02",
                icon: CheckCheck,
                title: "一起推进",
                text: "把通过的决议交接给执行者，跟进授权与进度。每次回顾，都能找到下一步。",
                tags: "授权 · 执行 · 档案",
              },
              {
                number: "03",
                icon: PenLine,
                title: "一起创作",
                text: "安排沙龙与编辑计划，整理作者名片、设计素材和文创物料。让协作更从容。",
                tags: "沙龙 · 编辑 · 资料",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <article className="space-card" key={item.number}>
                  <div>
                    <Icon size={27} strokeWidth={1.4} />
                    <span>{item.number}</span>
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                  <span className="space-tags">{item.tags}</span>
                </article>
              );
            })}
          </div>
        </section>
        <section className="landing-journal" id="journal">
          <div className="journal-icon">
            <BookOpen size={51} strokeWidth={1} />
            <span>FIELD NOTES</span>
          </div>
          <div>
            <span className="public-eyebrow">文字与观察</span>
            <h2>
              让当下的思考，
              <br />
              成为下一次对话的起点。
            </h2>
            <p>
              这里将留给文章、沙龙札记与共同工作的记录。
              <br />
              文章栏目正在筹备，期待与你慢慢展开。
            </p>
          </div>
          <a className="journal-link" href="/blog" aria-label="查看文章栏目">
            <ArrowUpRight size={27} />
          </a>
        </section>
        <section className="landing-invitation">
          <span className="public-eyebrow">THE NEXT CONVERSATION</span>
          <h2>
            下一次讨论，
            <br className="mobile-break" />
            从这里开始。
          </h2>
          <a className="public-button" href="/workspace">
            进入协作工作台
            <ArrowRight size={18} />
          </a>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

export function BlogPage() {
  return (
    <div className="public-site">
      <PublicHeader />
      <main className="journal-page">
        <span className="public-eyebrow">THE COUNCIL JOURNAL</span>
        <h1>
          文字与记录<span>。</span>
        </h1>
        <p>讨论之外，也留一点篇幅，给值得展开的思考。</p>
        <div className="journal-empty">
          <BookOpen size={40} strokeWidth={1} />
          <h2>第一篇，正在酝酿。</h2>
          <p>文章栏目正在筹备。未来的文章、沙龙札记与活动记录会在这里相聚。</p>
          <a className="public-text-link" href="/">
            返回首页
            <ArrowRight size={16} />
          </a>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="public-site">
      <PublicHeader />
      <main className="journal-page">
        <span className="public-eyebrow">404 / PAGE NOT FOUND</span>
        <h1>这一页还不存在。</h1>
        <p>地址可能有误，也可能已经更新。</p>
        <a className="public-button" href="/">
          返回首页
          <ArrowRight size={17} />
        </a>
      </main>
      <PublicFooter />
    </div>
  );
}
