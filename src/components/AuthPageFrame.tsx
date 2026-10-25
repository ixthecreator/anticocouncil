import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cloudService } from "../lib/cloudService";
import { PublicLayout } from "./LandingPage";
import "./auth-pages.css";

// CloudBase confirms an email with a code and returns listed members their access at once.
const codeProof = cloudService === "cloudbase";

export function AuthPageFrame({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="auth-page">
      <PublicLayout page="workspace">
        <a className="auth-back-link" href="/"><ArrowLeft size={16} aria-hidden="true" />返回首页</a>
        <div className="auth-layout">
          <section className="auth-content">
            {children}
          </section>
          <aside className="auth-aside" aria-label="访问说明">
            {aside ?? <>
              <h2>首次使用</h2>
              <ol className="auth-steps">
                <li><strong>注册账号</strong><p>使用常用邮箱，填写成员姓名。</p></li>
                <li><strong>验证邮箱</strong><p>{codeProof ? "填写邮件中的数字验证码。" : "打开验证邮件中的链接。"}</p></li>
                <li><strong>申请加入</strong><p>{codeProof ? "已登记的议会成员自动恢复权限；其他人提交申请，管理员批准后可进入工作台。" : "提交申请，管理员批准后可进入工作台。"}</p></li>
              </ol>
              <div className="auth-public-entry">
                <h3>查阅公开资料</h3>
                <p>公开档案无需登录。</p>
                <a href="/archive">前往档案馆<ArrowRight size={16} aria-hidden="true" /></a>
              </div>
            </>}
          </aside>
        </div>
      </PublicLayout>
    </div>
  );
}

export function AuthLoadingContent({ title, description, children, headingLevel = 1 }: {
  title: string; description?: string; children?: ReactNode; headingLevel?: 1 | 2;
}) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return <div className="auth-loading">
    <div role="status" aria-live="polite" aria-atomic="true">
      <span className="auth-spinner" aria-hidden="true" />
      <Heading>{title}</Heading>
      {description && <p>{description}</p>}
    </div>
    {children && <div className="auth-loading-actions">{children}</div>}
  </div>;
}
