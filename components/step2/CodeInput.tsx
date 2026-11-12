"use client";

import { useState, type ClipboardEvent } from "react";
import { ShieldAlert, Wand2 } from "lucide-react";
import { cleanCode } from "@/lib/code/clean";

type Props = {
  code: string;
  onChange: (code: string) => void;
};

// Design Ref: §3 ⑥ — 코드 에디터처럼 고정폭 글꼴로 쓰는 입력창.
// 사내 AI 답변을 통째로 붙여 넣으면 ```javascript 표시와 설명 문장은 자동으로 지우고 코드만 남긴다.
export default function CodeInput({ code, onChange }: Props) {
  const [cleaned, setCleaned] = useState(false);

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const pasted = event.clipboardData.getData("text");
    const result = cleanCode(pasted);
    if (!result.extracted) {
      setCleaned(false);
      return; // ``` 블록이 없으면 평소처럼 붙여 넣는다
    }
    event.preventDefault();
    const box = event.currentTarget;
    // 커서(또는 선택한 영역) 자리에 정리된 코드만 넣는다
    onChange(code.slice(0, box.selectionStart) + result.code + code.slice(box.selectionEnd));
    setCleaned(true);
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="code-input" className="text-sm font-bold text-navy">
        사내 AI가 준 코드
      </label>
      <textarea
        id="code-input"
        value={code}
        onChange={(event) => {
          setCleaned(false);
          onChange(event.target.value);
        }}
        onPaste={handlePaste}
        rows={14}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        placeholder={"사내 AI의 답변을 여기에 붙여 넣으세요.\n```javascript 표시와 설명 문장은 자동으로 지워집니다."}
        className="w-full resize-y rounded-2xl border border-navy/40 bg-[#14262f] px-4 py-3 font-mono text-xs leading-relaxed text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-navy"
      />
      {cleaned && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
          <Wand2 size={14} aria-hidden="true" />
          ```javascript 표시와 설명 문장을 지우고 코드만 남겼습니다.
        </p>
      )}
      <p className="flex items-start gap-1.5 text-xs text-amber-800">
        <ShieldAlert size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
        실행하기 전에 코드를 한 번 훑어보고, 이해되지 않는 코드는 실행하지 마세요.
      </p>
    </div>
  );
}
