import { useEffect, useRef, useState } from "react";

type FitTextProps = {
  text: string;
  className?: string;
  baseSize?: number;
};

/**
 * 在单行内完整显示文本：内容超出容器宽度时按比例缩小字号，
 * 保证单词/短语不被截断、也不换行。
 */
export default function FitText({ text, className, baseSize = 14 }: FitTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [ratio, setRatio] = useState(1);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const measure = () => {
      const maxWidth = element.clientWidth;
      const naturalWidth = element.scrollWidth;
      if (maxWidth <= 0 || naturalWidth <= 0) {
        return;
      }
      setRatio(Math.min(1, maxWidth / naturalWidth));
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [text]);

  return (
    <span
      ref={ref}
      className={className}
      style={
        ratio < 1 ? { fontSize: `${Math.round(baseSize * ratio * 100) / 100}px` } : undefined
      }
    >
      {text}
    </span>
  );
}
