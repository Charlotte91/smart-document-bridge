"use client";

import { useRef, useState, type DragEvent } from "react";
import { FileSpreadsheet, Loader2, TriangleAlert, Upload } from "lucide-react";
import { formatSize } from "@/lib/file";

export type LoadedFileInfo = {
  fileName: string;
  fileSize: number;
  sheetNames: string[];
  loadMs: number; // 읽는 데 걸린 시간(밀리초)
};

type Props = {
  onSelect: (file: File) => void;
  loading: boolean;
  info: LoadedFileInfo | null;
  error: string | null;
};

// Design Ref: §3 ① — 끌어 놓기·클릭으로 .xlsx를 고르는 곳. 형식·크기 검사와 읽기는 상위(BridgeApp)가 한다.
export default function FileDropZone({ onSelect, loading, info, error }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0]; // 여러 개를 놓아도 첫 번째만 쓴다
    if (file) onSelect(file);
  }

  return (
    <div className="flex flex-col gap-3">
      <label
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-3xl border-2 border-dashed bg-white px-6 py-10 text-center transition-colors focus-within:ring-2 focus-within:ring-navy ${
          dragging ? "border-navy bg-navy/5" : "border-navy/30 hover:border-navy/60"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onSelect(file);
            event.target.value = ""; // 같은 파일을 다시 골라도 반응하게 비워 둔다
          }}
        />
        {loading ? (
          <Loader2 size={36} className="animate-spin text-navy/70" aria-hidden="true" />
        ) : (
          <Upload size={36} className="text-navy/70" aria-hidden="true" />
        )}
        <p className="font-medium text-navy">
          {loading
            ? "파일을 읽는 중…"
            : "여기에 .xlsx 파일을 끌어 놓거나 클릭해서 선택하세요"}
        </p>
        <p className="text-sm text-navy/60">
          .xlsx만, 20MB까지 · 파일은 내 PC 브라우저 안에서만 읽고 서버로 보내지 않습니다
        </p>
      </label>

      {/* 아무것도 저장하지 않는다는 점과 새로고침 뒤 행동을 항상 알려 준다 (PRD 4번·DESIGN 상태 설계) */}
      <p className="text-xs text-navy/60">
        이 화면은 파일·프롬프트·코드·결과를 어디에도 저장하지 않습니다. 새로고침하거나 창을 닫으면 모두
        사라지니, 새로고침한 뒤에는 파일을 다시 선택하세요.
      </p>

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          <TriangleAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            {error}
            {info && (
              <span className="mt-1 block font-normal text-red-600">
                이전에 고른 파일과 작업 내용은 그대로 유지됩니다.
              </span>
            )}
          </span>
        </p>
      )}

      {info && (
        <div className="rounded-2xl border border-navy/15 bg-white px-4 py-3 text-sm text-navy">
          <p className="flex items-center gap-2 font-semibold">
            <FileSpreadsheet size={18} aria-hidden="true" />
            <span className="break-all">{info.fileName}</span>
          </p>
          <p className="mt-1 text-navy/70">
            {formatSize(info.fileSize)} · 시트 {info.sheetNames.length}개 · 읽기·구조 추출·가림{" "}
            {info.loadMs}ms
          </p>
          <p className="mt-1 break-all text-navy/70">
            시트: {info.sheetNames.join(", ")}
          </p>
        </div>
      )}
    </div>
  );
}
