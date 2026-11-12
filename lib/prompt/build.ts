// Design Ref: §4 ⑦, §5.1 — 가린 샘플과 작업 지시를 프롬프트 틀에 채워 한 덩어리 글자로 만든다.
// 같은 파일·같은 작업 지시면 항상 같은 글자가 나온다(SC-8). 시간·난수는 쓰지 않는다.
import type { MaskedSheet } from "../excel/mask";
import {
  EMPTY_TASK_PLACEHOLDER,
  HEADING_ROLE,
  HEADING_RULES,
  HEADING_SAMPLE,
  HEADING_STRUCTURE,
  HEADING_TASK,
  PROMPT_ROLE,
  PROMPT_RULES,
  SAMPLE_NOTICE,
} from "./template";

export const MAX_PROMPT_CHARS = 10_000; // 길이 제한은 글자 수 기준
const CELL_MAX_FIRST = 50; // 칸 하나의 최대 글자 수
const CELL_MAX_SECOND = 20; // 1만 자를 넘으면 이 길이로 다시 줄인다

/** 글자 수는 이모지 등도 1글자로 센다 */
export function countChars(text: string): number {
  return [...text].length;
}

// 칸을 max자로 줄인다: 넘으면 앞 (max-1)자 + "…". 마스킹이 끝난 글자에 적용하므로 자르면서 가림이 풀리지 않는다.
function truncateCell(text: string, max: number): string {
  const chars = [...text];
  return chars.length > max ? chars.slice(0, max - 1).join("") + "…" : text;
}

function columnRange(sheet: MaskedSheet): string {
  const first = sheet.columns[0].letter;
  const last = sheet.columns[sheet.columns.length - 1].letter;
  return first === last ? `${first}열` : `${first}~${last}열`;
}

// [파일 구조]: 시트별로 "열문자: 컬럼명" 한 줄. 바꿔 부른 컬럼명은 이유를 함께 적는다(AI가 열을 찾을 수 있게).
function buildStructureSection(sheets: MaskedSheet[]): string {
  return sheets
    .map((sheet) => {
      if (sheet.columns.length === 0) return `## 시트: ${sheet.name}\n(빈 시트)`;
      const lines = [
        `## 시트: ${sheet.name} (${columnRange(sheet)})`,
        sheet.columns.map((c) => `${c.letter}: ${c.name}`).join(" | "),
      ];
      for (const column of sheet.columns) {
        if (column.note) lines.push(`(${column.letter}열 '${column.name}' = ${column.note})`);
      }
      return lines.join("\n");
    })
    .join("\n\n");
}

// [샘플 데이터]: 시트별로 "샘플N: 값 | 값 …". 빈 칸은 (빈칸), 칸은 maxCell자로 줄인다.
function buildSampleSection(sheets: MaskedSheet[], maxCell: number): string {
  return sheets
    .map((sheet) => {
      if (sheet.columns.length === 0) return `## 시트: ${sheet.name}\n(빈 시트)`;
      const lines = [`## 시트: ${sheet.name}`];
      if (sheet.sampleRows.length === 0) lines.push("(데이터 행 없음)");
      sheet.sampleRows.forEach((row, index) => {
        const cells = row.map((text) => (text === "" ? "(빈칸)" : truncateCell(text, maxCell)));
        lines.push(`샘플${index + 1}: ${cells.join(" | ")}`);
      });
      return lines.join("\n");
    })
    .join("\n\n");
}

function assemble(sheets: MaskedSheet[], task: string, maxCell: number): string {
  const taskText = task.normalize("NFC").trim() || EMPTY_TASK_PLACEHOLDER;
  return [
    HEADING_ROLE,
    PROMPT_ROLE,
    "",
    HEADING_RULES,
    ...PROMPT_RULES,
    "",
    HEADING_STRUCTURE,
    buildStructureSection(sheets),
    "",
    HEADING_SAMPLE,
    SAMPLE_NOTICE,
    buildSampleSection(sheets, maxCell),
    "",
    HEADING_TASK,
    taskText,
  ].join("\n");
}

export type BuildResult =
  | { ok: true; prompt: string; charCount: number; cellMaxLength: number }
  | { ok: false; charCount: number }; // 20자로 줄여도 1만 자를 넘어 만들 수 없음

/** 프롬프트를 만든다. 1만 자를 넘으면 칸 길이를 50자 → 20자로 줄여 다시 만들고, 그래도 넘으면 중단한다. */
export function buildPrompt(sheets: MaskedSheet[], task: string): BuildResult {
  for (const cellMaxLength of [CELL_MAX_FIRST, CELL_MAX_SECOND]) {
    const prompt = assemble(sheets, task, cellMaxLength);
    const charCount = countChars(prompt);
    if (charCount <= MAX_PROMPT_CHARS) return { ok: true, prompt, charCount, cellMaxLength };
    if (cellMaxLength === CELL_MAX_SECOND) return { ok: false, charCount };
  }
  return { ok: false, charCount: 0 }; // 도달하지 않는 경우(타입 만족용)
}
