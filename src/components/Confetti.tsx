import { useMemo, type CSSProperties } from "react";

const COLORS = ["#4c6fff", "#8b5cf6", "#0e9f6e", "#e11d66", "#f79009", "#12b76a"];

type Piece = {
  left: number;
  delay: number;
  duration: number;
  color: string;
  size: number;
  rotation: number;
  drift: number;
};

/** 轻量彩带庆祝动效（纯 CSS，无依赖；prefers-reduced-motion 时自动静止）。 */
export default function Confetti({ count = 48 }: { count?: number }) {
  const pieces = useMemo<Piece[]>(
    () =>
      Array.from({ length: count }, () => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        duration: 2.2 + Math.random() * 1.6,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: 6 + Math.random() * 6,
        rotation: Math.random() * 360,
        drift: -40 + Math.random() * 80,
      })),
    [count],
  );

  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((piece, index) => (
        <span
          key={index}
          className="confetti-piece"
          style={
            {
              left: `${piece.left}%`,
              width: piece.size,
              height: piece.size * 0.5,
              background: piece.color,
              animationDelay: `${piece.delay}s`,
              animationDuration: `${piece.duration}s`,
              "--confetti-rotate": `${piece.rotation}deg`,
              "--confetti-drift": `${piece.drift}px`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
