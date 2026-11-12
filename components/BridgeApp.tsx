"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { Workbook } from "exceljs";
import Header from "./Header";
import StepCard from "./StepCard";
import FileDropZone, { type LoadedFileInfo } from "./step1/FileDropZone";
import CodeInput from "./step2/CodeInput";
import DownloadButton from "./step2/DownloadButton";
import ResultPreview from "./step2/ResultPreview";
import RunPanel from "./step2/RunPanel";
import LightweightBadge from "./step1/LightweightBadge";
import PromptEditor from "./step1/PromptEditor";
import StructurePreview from "./step1/StructurePreview";
import { buildPrompt, countChars } from "@/lib/prompt/build";
import { DEFAULT_TASK } from "@/lib/prompt/template";
import { extractStructure } from "@/lib/excel/extract";
import { loadWorkbookFromFile, validateFile } from "@/lib/excel/load";
import { maskStructure, type MaskedSheet } from "@/lib/excel/mask";
import { createSnapshot, type WorkbookSnapshot } from "@/lib/excel/snapshot";

// Design Ref: §3 — 대시보드 본체. 넓은 화면은 좌우 2단, 1024px보다 좁으면 위아래로 쌓는다.
// Design Ref: §4 상태 표 — 큰 데이터(원본 ArrayBuffer·workbook·스냅샷)는 화면 다시 그리기와 무관하게 ref에 둔다.
export default function BridgeApp() {
  const [fileInfo, setFileInfo] = useState<LoadedFileInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // 시트별 컬럼명 + 가린 샘플 3줄. 가리기 전 원문 샘플은 화면 상태에 남기지 않는다.
  const [structure, setStructure] = useState<MaskedSheet[] | null>(null);
  // 작업 지시: 처음엔 PRD 기본 예시가 채워져 있다 (새로고침하면 다시 기본값)
  const [task, setTask] = useState(DEFAULT_TASK);
  // 사용자가 프롬프트를 직접 고친 내용. null이면 고치지 않은 것(앱이 만든 프롬프트를 그대로 쓴다)
  const [editedPrompt, setEditedPrompt] = useState<string | null>(null);
  // Step 2: 사내 AI가 돌려준 코드 (붙여 넣을 때 ``` 표시·설명은 CodeInput이 걷어낸다)
  const [code, setCode] = useState("");

  // 앱이 만드는 프롬프트는 "가린 구조 + 작업 지시"에서 항상 같은 글자로 나오는 값이라 저장하지 않고 계산한다.
  const promptResult = useMemo(
    () => (structure ? buildPrompt(structure, task) : null),
    [structure, task],
  );
  // 칸에 실제로 들어 있는 내용 기준으로 글자 수·배지·복사를 처리한다 (Design §4 상태 표)
  const promptEdited = editedPrompt !== null;
  const currentPrompt = editedPrompt ?? (promptResult?.ok ? promptResult.prompt : "");
  const currentCharCount = promptEdited ? countChars(editedPrompt) : (promptResult?.charCount ?? 0);

  // 이후 작업(구조 추출·Worker 실행·원본 비교)이 꺼내 쓸 원본 데이터. 새 파일을 고르면 통째로 바뀐다.
  const originalBufferRef = useRef<ArrayBuffer | null>(null);
  const workbookRef = useRef<Workbook | null>(null);
  const snapshotRef = useRef<WorkbookSnapshot | null>(null);
  // 코드 실행 결과(결과 엑셀 파일 데이터). 작업 15·16(미리보기·다운로드)에서 꺼내 쓴다.
  const resultBufferRef = useRef<ArrayBuffer | null>(null);
  // 결과를 읽어 둔 workbook. 미리보기를 다시 그려야 하므로 화면 상태로 둔다 (id가 바뀌면 미리보기 탭 선택도 새로 시작)
  const [result, setResult] = useState<{ id: number; workbook: Workbook; buffer: ArrayBuffer } | null>(
    null,
  );
  const resultIdRef = useRef(0);
  // 놓는 칸 밖에 파일을 떨어뜨리면 브라우저가 파일을 열어 버려 화면 상태를 잃는다 → 창 전체에서 기본 동작을 막는다
  useEffect(() => {
    const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes("Files");
    const prevent = (event: DragEvent) => {
      if (hasFiles(event)) event.preventDefault();
    };
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, []);

  const loadSeqRef = useRef(0); // 읽는 중에 다른 파일을 고르면 이전 결과를 버리기 위한 번호

  // 새 파일을 읽는 데 성공한 뒤에 바뀐 화면(프롬프트 수정·복사 표시·코드·실행 상태·미리보기)을 새로 시작하기 위한 번호.
  // 이 번호가 key로 쓰여서, 번호가 바뀌면 그 안의 화면 조각이 모두 새로 만들어진다 (진행 중이던 실행도 함께 끝난다).
  const [fileKey, setFileKey] = useState(0);

  async function handleSelectFile(file: File) {
    // 형식·크기가 맞지 않으면 안내만 하고, 지금까지 하던 작업(프롬프트 수정·코드·결과)은 그대로 둔다
    const problem = validateFile(file);
    if (problem) {
      setLoadError(problem);
      return;
    }

    const seq = ++loadSeqRef.current;
    setLoadError(null);
    setLoading(true);
    const startedAt = performance.now();
    try {
      const loaded = await loadWorkbookFromFile(file);
      if (seq !== loadSeqRef.current) return; // 그 사이 다른 파일을 골랐다
      const snapshot = createSnapshot(loaded.workbook);
      // 시트 이름·컬럼명·샘플 3줄을 꺼낸 뒤 바로 개인정보를 가린다
      const sheets = maskStructure(extractStructure(loaded.workbook));
      if (seq !== loadSeqRef.current) return;

      // 새 파일을 읽는 데 성공했다 → 이전 파일의 데이터와 작업 내용을 모두 새것으로 바꾼다
      originalBufferRef.current = loaded.buffer;
      workbookRef.current = loaded.workbook;
      snapshotRef.current = snapshot;
      resultBufferRef.current = null;
      setResult(null);
      setEditedPrompt(null); // 직접 고친 프롬프트도 지운다
      setCode(""); // 붙여 넣은 코드도 지운다
      setFileKey((key) => key + 1);
      setStructure(sheets);
      // 표시 시간(SC-2)은 읽기 + 스냅샷 + 구조 추출 + 마스킹까지 모두 포함해서 잰다
      setFileInfo({
        fileName: loaded.fileName,
        fileSize: loaded.fileSize,
        sheetNames: loaded.workbook.worksheets.map((sheet) =>
          sheet.name.normalize("NFC"),
        ),
        loadMs: Math.round(performance.now() - startedAt),
      });
    } catch (e) {
      if (seq !== loadSeqRef.current) return;
      // 암호·DRM·손상 파일 등: 안내만 하고 이전 작업은 그대로 둔다
      setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }

  const fileReady = fileInfo !== null;

  return (
    <div className="flex flex-1 flex-col">
      <Header />

      <main className="relative z-10 mx-auto -mt-12 grid w-full max-w-6xl flex-1 grid-cols-1 gap-6 px-6 pb-12 lg:grid-cols-2">
        <StepCard step={1} title="로컬 경량화 + 프롬프트 생성">
          <FileDropZone
            onSelect={handleSelectFile}
            loading={loading}
            info={fileInfo}
            error={loadError}
          />
          {fileInfo && currentPrompt !== "" && (
            <LightweightBadge originalBytes={fileInfo.fileSize} prompt={currentPrompt} />
          )}
          {structure && <StructurePreview key={`structure-${fileKey}`} sheets={structure} />}
          {promptResult && (
            <PromptEditor
              key={`prompt-${fileKey}`}
              task={task}
              onTaskChange={setTask}
              autoResult={promptResult}
              prompt={currentPrompt}
              edited={promptEdited}
              charCount={currentCharCount}
              onPromptChange={setEditedPrompt}
              onRegenerate={() => setEditedPrompt(null)}
            />
          )}
        </StepCard>

        <StepCard step={2} title="AI 코드 실행 + 결과 다운로드" disabled={!fileReady}>
          {fileReady ? (
            <Fragment key={fileKey}>
              <CodeInput code={code} onChange={setCode} />
              <RunPanel
                code={code}
                getOriginalBuffer={() => originalBufferRef.current}
                getSnapshot={() => snapshotRef.current}
                onResult={(done) => {
                  resultBufferRef.current = done?.buffer ?? null;
                  setResult(
                    done
                      ? { id: ++resultIdRef.current, workbook: done.workbook, buffer: done.buffer }
                      : null,
                  );
                }}
              />
              {result && (
                <ResultPreview
                  key={result.id}
                  workbook={result.workbook}
                  originalSheetNames={fileInfo?.sheetNames ?? []}
                />
              )}
              {result && <DownloadButton buffer={result.buffer} />}
            </Fragment>
          ) : (
            <div className="rounded-2xl border border-navy/15 bg-white px-6 py-12 text-center text-sm text-navy/60">
              Step 1에서 파일을 먼저 고르세요.
            </div>
          )}
        </StepCard>
      </main>
    </div>
  );
}
