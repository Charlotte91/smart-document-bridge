// Design Ref: §4 ⑤, §5.1 — 모든 시트의 이름·1행 컬럼명·샘플 3줄(2~4행)만 꺼낸다.
// 나머지 행은 프롬프트에 한 줄도 넣지 않는다. 샘플 속 개인정보 가림은 다음 작업(마스킹)에서 한다.
import type { Workbook, Worksheet } from "exceljs";
import { cellToText } from "./cellText";

export const SAMPLE_ROW_COUNT = 3; // 컬럼명(1행) 아래 샘플은 2~4행 고정

export type ColumnInfo = {
  letter: string; // 열 문자 (A, B, …)
  name: string; // 정리된 컬럼명
  note?: string; // 바꿔 부른 이유 (프롬프트에 열 문자와 함께 적는다)
};

export type SheetStructure = {
  name: string; // NFC로 정리한 시트 이름
  columns: ColumnInfo[]; // 비어 있으면 "(빈 시트)"
  sampleRows: string[][]; // 가리기 전 샘플. 열 순서는 columns와 같다
  hidden?: boolean; // 숨김 시트인가 (숨김 시트의 샘플도 프롬프트에 들어가므로 화면에 표시한다)
};

/** 1행에서 값이 있는 마지막 열 번호. 1행이 비었으면 0 */
function lastHeaderColumn(sheet: Worksheet): number {
  let last = 0;
  sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
    if (cellToText(cell.value) !== "" && colNumber > last) last = colNumber;
  });
  return last;
}

/**
 * 1행 컬럼명을 정리한다.
 * - 이름이 빈 열 → "열_C" (열 위치)
 * - 같은 이름이 또 나옴 → "비고_2", "비고_3" … (원본에 이미 그 이름이 있으면 건너뛴다)
 */
function buildColumns(sheet: Worksheet, lastCol: number): ColumnInfo[] {
  const rawNames: string[] = [];
  for (let col = 1; col <= lastCol; col++) {
    rawNames.push(cellToText(sheet.getRow(1).getCell(col).value));
  }

  const reserved = new Set(rawNames.filter((name) => name !== "")); // 원본에 있는 모든 이름
  const used = new Set<string>();
  const columns: ColumnInfo[] = [];

  rawNames.forEach((raw, index) => {
    const letter = sheet.getColumn(index + 1).letter;
    let name = raw;
    let note: string | undefined;

    if (raw === "") {
      name = `열_${letter}`;
      for (let n = 2; reserved.has(name) || used.has(name); n++) name = `열_${letter}_${n}`;
      note = "원본 1행이 비어 있어 열 위치로 부름";
    } else if (used.has(raw)) {
      let n = 2;
      name = `${raw}_${n}`;
      while (reserved.has(name) || used.has(name)) name = `${raw}_${++n}`;
      note = `원본 이름 '${raw}'이(가) 중복되어 바꿔 부름`;
    }

    used.add(name);
    columns.push({ letter, name, note });
  });

  return columns;
}

function extractSheet(sheet: Worksheet): SheetStructure {
  const name = sheet.name.normalize("NFC");
  const hidden = sheet.state !== "visible";
  const lastCol = lastHeaderColumn(sheet);
  if (lastCol === 0) return { name, columns: [], sampleRows: [], hidden }; // 빈 시트(1행이 비어 있음)

  const columns = buildColumns(sheet, lastCol);
  const sampleRows: string[][] = [];
  const lastRow = Math.min(1 + SAMPLE_ROW_COUNT, sheet.rowCount); // 데이터가 3줄보다 적으면 있는 만큼만
  for (let rowNumber = 2; rowNumber <= lastRow; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    sampleRows.push(columns.map((_, index) => cellToText(row.getCell(index + 1).value)));
  }
  return { name, columns, sampleRows, hidden };
}

/** 모든 시트(숨김 시트 포함)의 구조를 꺼낸다. */
export function extractStructure(workbook: Workbook): SheetStructure[] {
  return workbook.worksheets.map(extractSheet);
}
