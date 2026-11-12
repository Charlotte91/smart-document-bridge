"use client";

import { useEffect, useState } from "react";
import BridgeLogo from "./BridgeLogo";

// 별 70개의 위치·크기·깜빡임 시작 시간. 난수 대신 고정 계산이라 서버·브라우저에서 똑같이 그려진다.
const STARS = Array.from({ length: 70 }, (_, i) => {
  const a = (i * 9301 + 49297) % 233280;
  const b = (i * 7919 + 12345) % 233280;
  return {
    left: (a / 233280) * 100,
    top: (b / 233280) * 100,
    size: 1 + ((i * 37) % 30) / 12,
    delay: ((i * 53) % 40) / 10,
  };
});

// 처음 접속했을 때 나오는 인트로: 별이 반짝이는 밤하늘 위에서 다리 아치가 그려지고 로고가 떠오른다.
// 약 4초 뒤 저절로 사라지며(CSS), 누르거나 Esc를 누르면 바로 건너뛴다. 움직임 줄이기 설정이면 나오지 않는다.
export default function IntroSplash() {
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setGone(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (gone) return null;

  return (
    <div
      className="intro-splash"
      onClick={() => setGone(true)}
      role="presentation"
      aria-hidden="true"
    >
      <div className="intro-stars">
        {STARS.map((star, index) => (
          <span
            key={index}
            style={{
              left: `${star.left}%`,
              top: `${star.top}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              animationDelay: `${star.delay}s`,
            }}
          />
        ))}
      </div>

      <div className="intro-center">
        <BridgeLogo size={280} animate />
        <p className="intro-title">SMART BRIDGE</p>
        <p className="intro-sub">문서·데이터 경량화 브릿지</p>
      </div>

      <p className="intro-skip">화면을 누르면 건너뜁니다</p>
    </div>
  );
}
