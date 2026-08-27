import type { ReactNode } from "react";

type EmptyStateProps = {
  /** 简笔插画：传入内联 SVG */
  illustration?: ReactNode;
  title: string;
  description?: string;
  children?: ReactNode;
};

/** 统一的空状态：插画 + 标题 + 描述 + 行动按钮。 */
export default function EmptyState({
  illustration,
  title,
  description,
  children,
}: EmptyStateProps) {
  return (
    <div className="empty-state">
      {illustration ? (
        <div className="empty-state-art" aria-hidden="true">
          {illustration}
        </div>
      ) : null}
      <h2 className="empty-state-title">{title}</h2>
      {description ? (
        <p className="empty-state-desc">{description}</p>
      ) : null}
      {children ? <div className="empty-state-actions">{children}</div> : null}
    </div>
  );
}
