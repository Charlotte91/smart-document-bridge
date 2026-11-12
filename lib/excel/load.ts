// Design Ref: §4 ①②③ — 파일 형식·크기 검사 후, 브라우저 메모리(ArrayBuffer)에서만 엑셀을 읽는다.
// 서버로 보내는 코드는 없다. 브라우저의 파일 선택은 업로드가 아니라 내 PC 안에서 읽는 것이다.
import type { Workbook } from "exceljs";

export const MAX_FILE_BYTES = 20 * 1024 * 1024; // "20MB" = 20×1024×1024 Byte

export const MESSAGE_NOT_XLSX =
  "PoC는 .xlsx만 지원합니다. 엑셀에서 .xlsx로 저장한 뒤 선택하세요";
export const MESSAGE_TOO_LARGE = "PoC는 20MB까지 지원합니다";
export const MESSAGE_CANNOT_OPEN =
  "파일을 열 수 없습니다. 암호·DRM이 걸려 있다면 해제한 뒤 다시 선택하세요";

/** 읽기 전에 형식(.xlsx)과 크기(20MB)를 검사한다. 문제가 없으면 null, 있으면 안내 문구를 돌려준다. */
export function validateFile(file: File): string | null {
  // 한글 파일명은 맥에서 자소가 풀려 있을 수 있어 NFC로 정리한 뒤 확장자를 본다
  const name = file.name.normalize("NFC").toLowerCase();
  if (!name.endsWith(".xlsx")) return MESSAGE_NOT_XLSX;
  if (file.size > MAX_FILE_BYTES) return MESSAGE_TOO_LARGE;
  return null;
}

export type LoadedFile = {
  fileName: string; // NFC로 정리한 파일명
  fileSize: number; // 원본 파일 크기(Byte) — 경량화 배지 계산에 쓴다
  buffer: ArrayBuffer; // 원본 그대로 보관 (Step 2 실행 때마다 사본을 만들어 쓴다)
  workbook: Workbook; // 읽은 원본 workbook
};

/**
 * 파일을 ArrayBuffer로 읽고 ExcelJS workbook으로 만든다.
 * 암호·DRM·손상 파일이면 MESSAGE_CANNOT_OPEN 오류를 던진다.
 * exceljs는 무거워서 이 함수가 불릴 때에만 불러온다.
 */
export async function loadWorkbookFromFile(file: File): Promise<LoadedFile> {
  const buffer = await file.arrayBuffer();
  const workbook = await loadWorkbookFromBuffer(buffer, MESSAGE_CANNOT_OPEN);
  return {
    fileName: file.name.normalize("NFC"),
    fileSize: file.size,
    buffer,
    workbook,
  };
}

export const MESSAGE_RESULT_UNREADABLE = "결과 파일을 읽을 수 없습니다";

/** ArrayBuffer를 ExcelJS workbook으로 만든다. 읽기에 실패하면 failMessage로 오류를 던진다. */
export async function loadWorkbookFromBuffer(
  buffer: ArrayBuffer,
  failMessage: string = MESSAGE_RESULT_UNREADABLE,
): Promise<Workbook> {
  try {
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    return workbook;
  } catch {
    throw new Error(failMessage);
  }
}
