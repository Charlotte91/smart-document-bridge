import { calcReductionPercent, countBytes, formatSize } from "@/lib/file";

type Props = {
  originalBytes: number; // 원본 파일 크기
  prompt: string; // 사내 AI에 넣는 프롬프트 전체
};

// Design Ref: §3 ② — 경량화 배지. 숫자는 모두 실제 계산값이다. (Plan SC-1: 99% 이상 감소)
export default function LightweightBadge({ originalBytes, prompt }: Props) {
  const promptBytes = countBytes(prompt);
  const percent = calcReductionPercent(originalBytes, promptBytes);

  return (
    <div className="mt-4 rounded-2xl bg-gradient-to-br from-accent to-[#b0573f] px-5 py-4 text-white shadow-[0_12px_30px_-12px_rgba(202,115,88,0.7)]">
      <p className="text-lg font-extrabold leading-snug sm:text-xl">
        {percent > 0
          ? `🔥 용량 ${percent.toFixed(1)}% 경량화 & 네트워크 전송 0 Byte!`
          : "원본이 작아 경량화 효과가 없습니다 · 네트워크 전송 0 Byte!"}
      </p>
      <p className="mt-1 text-sm font-medium text-white/90">
        원본 {formatSize(originalBytes)}({originalBytes.toLocaleString("ko-KR")} Byte) → 사내 AI에
        넣는 프롬프트 {promptBytes.toLocaleString("ko-KR")} Byte
      </p>
    </div>
  );
}
