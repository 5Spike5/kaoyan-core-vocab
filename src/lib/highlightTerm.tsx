import { Fragment } from "react";
import type { ReactNode } from "react";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 在例句中把当前学习的单词/短语高亮（大小写不敏感，短语整体匹配）。
 * 匹配逻辑与语料检索一致（单词用词边界，短语用包含匹配）。
 */
export function highlightTerm(text: string, term: string): ReactNode {
  const query = term.trim();
  if (!query) {
    return text;
  }

  const escaped = escapeRegExp(query);
  const matcher = new RegExp(`\\b${escaped}\\b`, "gi");
  const matches = text.match(matcher);
  if (!matches || matches.length === 0) {
    return text;
  }

  const parts = text.split(matcher);
  return parts.map((part, index) => (
    <Fragment key={index}>
      {part}
      {index < matches.length ? <span className="hl">{matches[index]}</span> : null}
    </Fragment>
  ));
}
