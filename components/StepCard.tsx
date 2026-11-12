import type { ReactNode } from "react";

type Props = {
  step: number;
  title: string;
  // 앞 단계가 끝나기 전에는 흐리게 보여 준다 (Design §3 화면 상태)
  disabled?: boolean;
  children: ReactNode;
};

// Step 1·2 카드의 공통 틀: 번호 배지 + 제목 + 내용 칸
export default function StepCard({ step, title, disabled, children }: Props) {
  return (
    <section
      aria-labelledby={`step-${step}-title`}
      className={`step-card rounded-3xl border border-white/60 bg-panel p-7 shadow-[0_1px_0_rgba(255,255,255,0.8)_inset,0_20px_50px_-20px_rgba(27,51,64,0.25)] ${
        disabled ? "opacity-60" : ""
      }`}
    >
      <div className="mb-4 flex items-center gap-3">
        <span className="rounded-full bg-accent px-3 py-1 text-xs font-bold tracking-wide text-white">
          STEP {step}
        </span>
        <h2 id={`step-${step}-title`} className="text-lg font-semibold text-navy">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}
