"use client";

import { Download } from "lucide-react";
import { downloadBlob, formatSize } from "@/lib/file";

export const RESULT_FILE_NAME = "최종_가공완료_보고서.xlsx";

type Props = {
  buffer: ArrayBuffer; // 코드 실행으로 만들어진 결과 엑셀 파일 데이터
};

// Design Ref: §3 ⑩, §4 ⑮ — 결과 엑셀을 서버를 거치지 않고 브라우저에서 바로 내려받는다.
export default function DownloadButton({ buffer }: Props) {
  return (
    <div className="mt-3 flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => downloadBlob(buffer, RESULT_FILE_NAME)}
        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:brightness-95"
      >
        <Download size={18} aria-hidden="true" />
        완성된 엑셀(.xlsx) 즉시 다운로드
      </button>
      <p className="text-center text-xs text-navy/60">
        {RESULT_FILE_NAME} · {formatSize(buffer.byteLength)}
      </p>
    </div>
  );
}
