// Design Ref: §4 ⑬⑭ — 코드 실행이 끝난 결과 파일을 화면 쪽에서 다시 읽고, 원본 시트가 그대로인지 확인한다.
import type { Workbook } from "exceljs";
import { loadWorkbookFromBuffer } from "./load";
import { scanRisks, type RiskFinding } from "./risk";
import { compareSnapshots, createSnapshot, type SheetDiff, type WorkbookSnapshot } from "./snapshot";

export type VerifyResult = {
  workbook: Workbook; // 읽은 결과 workbook (결과 미리보기에서 다시 쓴다)
  diffs: SheetDiff[]; // 비어 있으면 원본 시트 변경 없음
  newRisks: RiskFinding[]; // 결과에 새로 생긴 외부 연결 수식·링크 (비어 있으면 없음)
};

/** 결과 파일 데이터를 읽어 원본 스냅샷과 비교한다. 결과를 읽을 수 없으면 오류를 던진다. */
export async function verifyOriginalPreserved(
  original: WorkbookSnapshot,
  resultBuffer: ArrayBuffer,
): Promise<VerifyResult> {
  const workbook = await loadWorkbookFromBuffer(resultBuffer);
  const diffs = compareSnapshots(original, createSnapshot(workbook));
  const known = new Set(original.riskKeys);
  const newRisks = scanRisks(workbook).filter((risk) => !known.has(risk.key));
  return { workbook, diffs, newRisks };
}
