"use client";

import { useState } from "react";
import { FlaskConical, Loader2, ShieldCheck } from "lucide-react";
import { createDummyWorkbookBuffer, DUMMY_FILE_NAME } from "@/lib/excel/dummy";
import { downloadBlob } from "@/lib/file";

// Design Ref: §3 — 청록 헤더(윈도 불빛 배경): 제목 + 더미 엑셀 생성 버튼
export default function Header() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 브라우저 안에서 더미 엑셀을 만들어 바로 내려받는다 (서버 전송 없음)
  async function handleDummyDownload() {
    setBusy(true);
    setError(null);
    try {
      const buffer = await createDummyWorkbookBuffer();
      downloadBlob(buffer, DUMMY_FILE_NAME);
    } catch (e) {
      setError(
        `더미 파일을 만들지 못했습니다: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <header className="window-glow text-cream">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 pb-20 pt-10 text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-[2.6rem] sm:leading-tight">
          스마트 문서/데이터 경량화 브릿지{" "}
          <span className="align-middle text-sm font-normal text-cream/70">(PoC)</span>
        </h1>

        {/* 흰 테두리 알약 안내문: WindowSwap의 입력창 모양 */}
        <p className="inline-flex items-center gap-2 rounded-full border border-cream/50 bg-white/5 px-5 py-2 text-sm text-cream/90 backdrop-blur-sm">
          <ShieldCheck size={16} aria-hidden="true" />
          내 PC 브라우저 안에서만 처리합니다 · 네트워크 전송 0 Byte
        </p>

        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={handleDummyDownload}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 bg-cream px-6 py-3 text-sm font-semibold text-navy transition-colors hover:bg-white disabled:cursor-wait disabled:opacity-70"
          >
            {busy ? (
              <Loader2 size={18} className="animate-spin" aria-hidden="true" />
            ) : (
              <FlaskConical size={18} aria-hidden="true" />
            )}
            {busy
              ? "더미 엑셀 만드는 중…"
              : "시연용 대용량 더미 엑셀(5,000행) 즉시 생성·다운로드"}
          </button>
          {error && (
            <p role="alert" className="text-sm font-medium text-red-200">
              {error}
            </p>
          )}
        </div>
      </div>
    </header>
  );
}
