"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, RefreshCw, TriangleAlert } from "lucide-react";
import { TASK_EXAMPLES } from "@/lib/prompt/examples";
import { MAX_PROMPT_CHARS, type BuildResult } from "@/lib/prompt/build";

type Props = {
  task: string;
  onTaskChange: (task: string) => void;
  autoResult: BuildResult; // 앱이 자동으로 만든 결과
  prompt: string; // 칸에 있는 현재 내용 (직접 고쳤으면 고친 내용)
  edited: boolean; // 사용자가 직접 고쳤는지
  charCount: number; // 현재 내용의 글자 수
  onPromptChange: (text: string) => void;
  onRegenerate: () => void;
};

type CopyStatus = "idle" | "copied" | "failed";

// Design Ref: §3 ④⑤ — 작업 지시 + 직접 고칠 수 있는 프롬프트 + 복사 버튼.
// 직접 고친 뒤에는 작업 지시를 바꿔도 자동으로 덮어쓰지 않는다(놓친 개인정보를 고친 내용을 지키기 위해).
export default function PromptEditor({
  task,
  onTaskChange,
  autoResult,
  prompt,
  edited,
  charCount,
  onPromptChange,
  onRegenerate,
}: Props) {
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const tooLong = charCount > MAX_PROMPT_CHARS;
  const showTextarea = edited || autoResult.ok;
  const canCopy = showTextarea && prompt !== "" && !tooLong;

  async function handleCopy() {
    if (timerRef.current) clearTimeout(timerRef.current);
    try {
      await navigator.clipboard.writeText(prompt);
      setCopyStatus("copied");
      timerRef.current = setTimeout(() => setCopyStatus("idle"), 2500);
    } catch {
      // 복사가 막히면(권한·보안 환경) 글자를 모두 선택해 두고 직접 복사하게 안내한다
      promptRef.current?.focus();
      promptRef.current?.select();
      setCopyStatus("failed");
    }
  }

  function handleRegenerate() {
    if (window.confirm("직접 수정한 내용이 사라지고 프롬프트를 다시 만듭니다. 계속할까요?")) {
      setCopyStatus("idle");
      onRegenerate();
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div>
        <label htmlFor="task-input" className="text-sm font-bold text-navy">
          작업 지시
        </label>
        <textarea
          id="task-input"
          value={task}
          onChange={(event) => onTaskChange(event.target.value)}
          rows={4}
          className="mt-1 w-full resize-y rounded-2xl border border-navy/20 bg-white px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-navy"
        />
        {/* 예시를 누르면 위 작업 지시가 그 내용으로 바뀐다 (직접 고쳐 쓸 수 있다) */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="작업 지시 예시">
          <span className="text-xs text-navy/60">예시로 채우기:</span>
          {TASK_EXAMPLES.map((example) => (
            <button
              key={example.label}
              type="button"
              title={example.task}
              onClick={() => onTaskChange(example.task)}
              className="rounded-full border border-navy/30 bg-white px-2.5 py-1 text-xs text-navy transition-colors hover:bg-navy/5 focus:outline-none focus:ring-2 focus:ring-navy"
            >
              {example.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <label htmlFor="prompt-output" className="text-sm font-bold text-navy">
            사내 AI용 프롬프트
          </label>
          <span className={`text-xs font-medium ${tooLong ? "text-red-600" : "text-navy/60"}`}>
            {charCount.toLocaleString("ko-KR")} / {MAX_PROMPT_CHARS.toLocaleString("ko-KR")}자
          </span>
        </div>

        <p className="mt-1 flex items-start gap-1.5 text-xs text-amber-800">
          <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          복사하기 전에 개인정보가 남았는지 확인하세요. 특히 이름 열이 아닌 곳(비고 등)의 이름은
          가려지지 않습니다. 남은 것은 아래 칸에서 직접 고칠 수 있습니다.
        </p>

        {showTextarea ? (
          <>
            {!edited && autoResult.ok && autoResult.cellMaxLength < 50 && (
              <p className="mt-1 text-xs text-amber-700">
                프롬프트가 길어서 칸 하나를 {autoResult.cellMaxLength}자까지만 담았습니다.
              </p>
            )}
            <textarea
              id="prompt-output"
              ref={promptRef}
              value={prompt}
              onChange={(event) => {
                setCopyStatus("idle");
                onPromptChange(event.target.value);
              }}
              rows={16}
              spellCheck={false}
              className="mt-1 w-full resize-y rounded-2xl border border-navy/20 bg-white px-3 py-2 font-mono text-xs leading-relaxed text-navy focus:outline-none focus:ring-2 focus:ring-navy"
            />
          </>
        ) : (
          <p
            role="alert"
            className="mt-1 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          >
            <TriangleAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            프롬프트가 1만 자를 넘어 만들 수 없습니다. 작업 지시를 줄이거나, 엑셀에서 필요 없는
            시트·열을 지운 뒤 다시 선택하세요
          </p>
        )}

        {edited && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-navy/70">
            <span>직접 수정한 내용이 있어 작업 지시를 바꿔도 자동으로 다시 만들지 않습니다.</span>
            <button
              type="button"
              onClick={handleRegenerate}
              className="inline-flex items-center gap-1 rounded-md border border-navy/30 bg-white px-2 py-1 font-semibold text-navy hover:bg-navy/5"
            >
              <RefreshCw size={12} aria-hidden="true" />
              프롬프트 다시 만들기
            </button>
          </div>
        )}

        {showTextarea && tooLong && (
          <p role="alert" className="mt-2 text-sm font-medium text-red-700">
            프롬프트가 1만 자를 넘어 복사할 수 없습니다. 글자를 줄이면 복사할 수 있습니다.
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleCopy}
            disabled={!canCopy}
            className="inline-flex items-center gap-2 rounded-2xl bg-navy px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-navy/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {copyStatus === "copied" ? (
              <Check size={18} aria-hidden="true" />
            ) : (
              <Copy size={18} aria-hidden="true" />
            )}
            {copyStatus === "copied" ? "복사했습니다" : "사내 AI용 프롬프트 복사"}
          </button>
          {copyStatus === "failed" && (
            <p role="alert" className="text-sm font-medium text-red-700">
              글자를 직접 선택해 복사하세요
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
