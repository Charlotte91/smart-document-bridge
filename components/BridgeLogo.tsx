import { useId } from "react";

type Props = {
  size?: number; // 가로 크기(px). 세로는 비율에 맞춰 줄어든다
  animate?: boolean; // 처음 화면(인트로)에서 아치가 그려지는 효과를 줄지
  className?: string;
};

// 상징 로고: 두 강둑을 잇는 "다리 아치"와 그 위에서 반짝이는 별(스파클).
// 문서·데이터를 가볍게 이어 주는 브릿지라는 뜻이다. 직접 그린 SVG라 외부 파일이 필요 없다.
export default function BridgeLogo({ size = 120, animate = false, className }: Props) {
  const id = useId();
  const gradient = `${id}-g`;
  const glow = `${id}-glow`;
  return (
    <svg
      viewBox="0 0 240 130"
      width={size}
      height={(size * 130) / 240}
      className={className}
      role="img"
      aria-label="스마트 브릿지 로고"
    >
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7fd1d6" />
          <stop offset="0.55" stopColor="#f5ede4" />
          <stop offset="1" stopColor="#ee9b7d" />
        </linearGradient>
        <filter id={glow} x="-30%" y="-60%" width="160%" height="220%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g filter={`url(#${glow})`}>
        {/* 다리 아치 */}
        <path
          d="M14 108 C 62 14, 178 14, 226 108"
          fill="none"
          stroke={`url(#${gradient})`}
          strokeWidth="7"
          strokeLinecap="round"
          pathLength={1}
          className={animate ? "logo-arc" : undefined}
        />
        {/* 상판 */}
        <path
          d="M6 112 H234"
          stroke={`url(#${gradient})`}
          strokeWidth="5"
          strokeLinecap="round"
          className={animate ? "logo-deck" : undefined}
        />
        {/* 매다는 줄: 가볍게 이어 준다는 느낌 */}
        <g stroke="#f5ede4" strokeOpacity="0.55" strokeWidth="2" strokeLinecap="round" className={animate ? "logo-ties" : undefined}>
          <path d="M60 64 V108" />
          <path d="M92 44 V108" />
          <path d="M120 38 V108" />
          <path d="M148 44 V108" />
          <path d="M180 64 V108" />
        </g>
      </g>

      {/* 반짝이는 별 */}
      <g className={animate ? "logo-spark" : undefined} filter={`url(#${glow})`}>
        <path
          d="M196 22 L200 34 L212 38 L200 42 L196 54 L192 42 L180 38 L192 34 Z"
          fill="#fff7ea"
        />
        <circle cx="222" cy="20" r="2.4" fill="#fff7ea" />
        <circle cx="170" cy="14" r="1.8" fill="#fff7ea" />
      </g>
    </svg>
  );
}
