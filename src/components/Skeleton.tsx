import type { ReactNode } from "react";

/** 灰色占位块：配合 .skeleton shimmer 动画，替代“正在加载…”纯文字。 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`skeleton ${className ?? ""}`} aria-hidden="true" />
  );
}

/** 复习页加载占位：词卡 + 四个选项的形状。 */
export function ReviewSkeleton() {
  return (
    <section className="page review-page" aria-busy="true">
      <Skeleton className="skeleton-topbar" />
      <div className="word-card">
        <Skeleton className="skeleton-badge" />
        <Skeleton className="skeleton-word" />
        <Skeleton className="skeleton-line" />
      </div>
      <div className="option-grid" aria-hidden="true">
        <Skeleton className="skeleton-option" />
        <Skeleton className="skeleton-option" />
        <Skeleton className="skeleton-option" />
        <Skeleton className="skeleton-option" />
      </div>
    </section>
  );
}

/** 列表页加载占位：标题 + 若干行。 */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <section className="page" aria-busy="true">
      <Skeleton className="skeleton-heading" />
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="skeleton-row" />
      ))}
    </section>
  );
}

/** 懒加载路由的兜底占位。 */
export function PageSkeleton({ children }: { children?: ReactNode }) {
  return (
    <section className="page" aria-busy="true">
      <Skeleton className="skeleton-heading" />
      <Skeleton className="skeleton-block" />
      <Skeleton className="skeleton-block short" />
    </section>
  );
}
