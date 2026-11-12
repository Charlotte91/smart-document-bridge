// Design Ref: §5 칸 표시 — 칸 값을 "프롬프트에 넣을 수 있는 글자"로 정리한다.
// 순서는 "NFC 정리 → 마스킹 → 길이 자르기"이고, 이 파일은 첫 단계(정리)만 맡는다.
// 글자 자르기(50자 → 20자)와 빈 칸 표기 "(빈칸)"은 마스킹이 끝난 뒤 프롬프트 만들 때(작업 7) 한다.
import type { CellValue } from "exceljs";

export const FORMULA_PLACEHOLDER = "(수식)"; // 결과값이 저장되지 않은 수식 칸

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// Date → UTC 기준 YYYY-MM-DD (시간은 버린다). ExcelJS가 날짜를 UTC로 읽기 때문이다.
function formatDate(date: Date): string {
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

/** 칸 값 하나를 글자로 바꾼다. 빈 칸은 빈 문자열. 줄바꿈은 공백으로, 한글은 NFC로 정리한다. */
export function cellToText(value: CellValue): string {
  return rawText(value).replace(/\s*[\r\n]+\s*/g, " ").normalize("NFC").trim();
}

function rawText(value: CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return formatDate(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint") return String(value);

  // 여기부터는 객체 값: 수식 / 서식 글자 / 하이퍼링크 / 오류값
  if ("formula" in value || "sharedFormula" in value) {
    const result = "result" in value ? value.result : undefined;
    if (result === null || result === undefined) return FORMULA_PLACEHOLDER;
    return rawText(result as CellValue);
  }
  if ("richText" in value) return value.richText.map((part) => part.text).join("");
  if ("error" in value) return String(value.error);
  if ("text" in value) return rawText(value.text as CellValue); // 하이퍼링크: 보이는 글자
  return "";
}
