"use client";

import { useEffect, useRef, useState } from "react";
import { CircleCheck, Loader2, Play, TriangleAlert } from "lucide-react";
import { cleanCode } from "@/lib/code/clean";
import { BLOCKED_MESSAGE, checkForbidden, type GuardResult } from "@/lib/code/guard";
import { verifyOriginalPreserved } from "@/lib/excel/verify";
import type { SheetDiff, WorkbookSnapshot } from "@/lib/excel/snapshot";
import type { RiskFinding } from "@/lib/excel/risk";
import type { Workbook } from "exceljs";
import { formatSize } from "@/lib/file";
import {
  MESSAGE_ORIGINAL_SAFE,
  MESSAGE_ORIGINAL_CHANGED,
  MESSAGE_SYNTAX_HINT,
  RUN_TIME_LIMIT_MS,
  runInWorker,
  type RunHandle,
  type RunOutcome,
  type RunPhase,
} from "@/lib/runner/runInWorker";

type Props = {
  code: string;
  getOriginalBuffer: () => ArrayBuffer | null; // 실행할 때 원본 파일 데이터를 꺼내 온다
  getSnapshot: () => WorkbookSnapshot | null; // 실행 전 원본 시트 스냅샷 (실행 뒤 비교용)
  // 실행이 끝나면 결과 파일 데이터와 읽은 workbook을 넘긴다 (실패·새 실행 시작 땐 null)
  onResult: (result: { buffer: ArrayBuffer; workbook: Workbook } | null) => void;
};

type RunState =
  | { kind: "idle" }
  | { kind: "running"; phase: RunPhase; since: number | null }
  | { kind: "done"; size: number; diffs: SheetDiff[]; risks: RiskFinding[] }
  | { kind: "failed"; outcome: Extract<RunOutcome, { ok: false }> };

// Design Ref: §3 ⑦⑧ — 실행 버튼 + 진행 표시 + 알림.
// 순서: 코드 정리 → 금지어 검사 → Web Worker에서 원본 사본에 실행 → 10초 제한 → 결과 데이터 받기.
export default function RunPanel({ code, getOriginalBuffer, getSnapshot, onResult }: Props) {
  const [blocked, setBlocked] = useState<{ code: string; result: GuardResult } | null>(null);
  const [run, setRun] = useState<RunState>({ kind: "idle" });
  const [now, setNow] = useState(() => Date.now());
  const handleRef = useRef<RunHandle | null>(null);
  const mountedRef = useRef(true);

  // 화면을 떠나면(예: 다른 파일 선택) 진행 중인 실행을 바로 끝낸다
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      handleRef.current?.cancel();
    };
  }, []);

  // 남은 시간 표시용 시계 (코드 실행 단계에서만 돈다)
  const since = run.kind === "running" ? run.since : null;
  useEffect(() => {
    if (since === null) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [since]);

  async function handleRun() {
    const { code: cleaned } = cleanCode(code); // 직접 입력한 코드에 ``` 표시가 있어도 정리한 뒤 쓴다

    // ① 실행 전 금지어 검사: 걸리면 Worker를 만들지도 않는다
    const guard = checkForbidden(cleaned);
    if (!guard.ok) {
      setBlocked({ code, result: guard });
      setRun({ kind: "idle" }); // 이전 실행 결과·오류 알림은 거두고 차단 안내만 보인다
      onResult(null);
      return;
    }
    setBlocked(null);

    const original = getOriginalBuffer();
    if (!original) return;

    onResult(null);
    setNow(Date.now());
    setRun({ kind: "running", phase: "preparing", since: null });

    // ②③ Worker 격리 실행 + 10초 제한
    const handle = runInWorker(original, cleaned, (phase) => {
      if (!mountedRef.current) return;
      setNow(Date.now());
      setRun((current) =>
        current.kind === "running"
          ? { kind: "running", phase, since: phase === "running" ? Date.now() : null }
          : current,
      );
    });
    handleRef.current = handle;
    const outcome = await handle.promise;
    handleRef.current = null;
    if (!mountedRef.current) return;

    if (outcome.ok) {
      // ⑬⑭ 결과 파일을 다시 읽고, 실행 전 원본 시트와 비교해 바뀐 곳이 있으면 경고한다
      try {
        const snapshot = getSnapshot();
        const verified = snapshot
          ? await verifyOriginalPreserved(snapshot, outcome.buffer)
          : null;
        if (!mountedRef.current) return;
        if (verified) onResult({ buffer: outcome.buffer, workbook: verified.workbook });
        setRun({
          kind: "done",
          size: outcome.buffer.byteLength,
          diffs: verified?.diffs ?? [],
          risks: verified?.newRisks ?? [],
        });
      } catch (e) {
        if (!mountedRef.current) return;
        onResult(null);
        setRun({
          kind: "failed",
          outcome: {
            ok: false,
            kind: "error",
            message: e instanceof Error ? e.message : String(e),
          },
        });
      }
    } else {
      onResult(null);
      setRun({ kind: "failed", outcome });
    }
  }

  const running = run.kind === "running";
  const shownBlock = blocked && blocked.code === code ? blocked.result : null;
  const remainingSec =
    run.kind === "running" && run.since !== null
      ? Math.max(0, Math.ceil((RUN_TIME_LIMIT_MS - (now - run.since)) / 1000))
      : null;

  return (
    <div className="mt-4 flex flex-col gap-3">
      <button
        type="button"
        onClick={handleRun}
        disabled={code.trim() === "" || running}
        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-navy px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-navy/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {running ? (
          <Loader2 size={18} className="animate-spin" aria-hidden="true" />
        ) : (
          <Play size={18} aria-hidden="true" />
        )}
        {running ? "실행 중…" : "로컬 브라우저에서 엑셀 가공 실행"}
      </button>

      {run.kind === "running" && (
        <p role="status" className="text-sm text-navy/70">
          {run.phase === "preparing"
            ? "엑셀을 읽고 실행 준비 중…"
            : run.phase === "writing"
              ? "결과 파일을 만드는 중…"
              : (
                  <>
                    코드 실행 중…
                    {/* 남은 시간은 1초마다 바뀌므로 화면 읽기 프로그램이 매번 읽지 않게 가린다 */}
                    <span aria-hidden="true"> 남은 시간 {remainingSec}초</span>
                  </>
                )}
        </p>
      )}

      {shownBlock && !shownBlock.ok && (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <p className="flex items-start gap-2 font-semibold">
            <TriangleAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            {BLOCKED_MESSAGE}
          </p>
          <ul className="mt-2 list-disc pl-6 text-xs">
            {shownBlock.findings.map((finding) => (
              <li key={finding.label}>
                <code className="font-mono font-semibold">{finding.label}</code> — {finding.line}번째 줄
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-red-600">
            사내 AI에게 &ldquo;외부 통신·eval·import·require 없이 다시 짜 달라&rdquo;고 요청한 뒤 새
            코드를 붙여 넣으세요.
          </p>
        </div>
      )}

      {run.kind === "failed" && (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <p className="flex items-start gap-2 font-semibold">
            <TriangleAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            {run.outcome.message}
          </p>
          {run.outcome.isSyntax && <p className="mt-1 text-xs">{MESSAGE_SYNTAX_HINT}</p>}
          {run.outcome.kind !== "worker" && (
            <p className="mt-1 text-xs text-red-600">{MESSAGE_ORIGINAL_SAFE}</p>
          )}
        </div>
      )}

      {run.kind === "done" && run.diffs.length > 0 && (
        <div
          role="alert"
          className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <p className="flex items-start gap-2 font-semibold">
            <TriangleAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            {MESSAGE_ORIGINAL_CHANGED}
          </p>
          <ul className="mt-2 list-disc pl-6 text-xs">
            {run.diffs.map((diff) => (
              <li key={diff.sheet}>
                <span className="font-semibold">{diff.sheet}</span> —{" "}
                {[
                  diff.missing ? "시트가 사라졌습니다" : null,
                  diff.changedCells > 0
                    ? `바뀐 칸 ${diff.changedCells.toLocaleString("ko-KR")}개 (예: ${diff.examples.join(", ")})`
                    : null,
                  diff.headerStyleChanged ? "1행 헤더 서식이 바뀌었습니다" : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs">
            작업 지시에서 &ldquo;원본 시트는 그대로 두고 새 시트에 담아 달라&rdquo;고 한 번 더 요청하세요.
            이 결과 파일의 원본 시트는 가공된 값이 섞여 있을 수 있습니다.
          </p>
        </div>
      )}

      {run.kind === "done" && run.risks.length > 0 && (
        <div
          role="alert"
          className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <p className="flex items-start gap-2 font-semibold">
            <TriangleAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            결과 파일에 외부로 연결될 수 있는 수식·링크가 {run.risks.length.toLocaleString("ko-KR")}개 들어
            있습니다. 내려받아 열기 전에 확인하세요.
          </p>
          <ul className="mt-2 list-disc pl-6 text-xs">
            {run.risks.slice(0, 5).map((risk) => (
              <li key={risk.key}>
                <span className="font-semibold">{risk.sheet}</span> {risk.address} — {risk.kind}
              </li>
            ))}
            {run.risks.length > 5 && <li>… 외 {run.risks.length - 5}개</li>}
          </ul>
          <p className="mt-2 text-xs">
            이런 수식·링크는 엑셀에서 &ldquo;편집 사용&rdquo;이나 링크 클릭을 하면 가리지 않은 원본 데이터를
            외부로 보낼 수 있습니다. 사내 AI에게 해당 수식·링크 없이 값만 담아 달라고 다시 요청하세요.
          </p>
        </div>
      )}

      {run.kind === "done" && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"
        >
          <CircleCheck size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          실행이 끝났습니다. 결과 파일({formatSize(run.size)})이 만들어졌습니다. 아래에서 결과를
          확인하고 내려받으세요.
        </p>
      )}
    </div>
  );
}
