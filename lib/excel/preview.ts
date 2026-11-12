// Design Ref: §3 ⑨ — 결과 workbook의 시트를 화면 표로 보여 주기 위한 데이터를 만든다.
// 고른 시트의 상단 15줄만, 칸 배경색·글자색·굵기를 함께 담는다.
import type { Cell, Workbook, Worksheet } from "exceljs";
import { cellToText } from "./cellText";

export const PREVIEW_MAX_ROWS = 15; // 시트당 보여 주는 줄 수 (1행 헤더 포함)
export const PREVIEW_MAX_COLS = 30; // 열이 아주 많은 시트는 앞쪽 30열까지만

export type PreviewCell = {
  text: string;
  background: string | null; // CSS 색 (#RRGGBB). 칠해진 색이 없으면 null
  color: string | null; // 글자색
  bold: boolean;
};

export type SheetPreview = {
  name: string;
  rows: PreviewCell[][]; // 상단 15줄
  columnCount: number; // 화면에 보여 주는 열 수
  totalColumns: number; // 시트 전체 열 수
  totalRows: number; // 시트 전체 줄 수
};

// 엑셀 색(ARGB, 예: FFFFCCCC)을 CSS 색(#FFCCCC)으로 바꾼다. 앞 두 자리(투명도)는 엑셀이 무시하므로 버린다.
// 테마 색처럼 ARGB가 없는 색은 정확히 옮길 수 없어 null로 둔다.
export function argbToCss(argb: string | undefined): string | null {
  if (!argb) return null;
  const hex = argb.length === 8 ? argb.slice(2) : argb;
  return /^[0-9a-fA-F]{6}$/.test(hex) ? `#${hex.toUpperCase()}` : null;
}

// 숫자 서식(0.0, #,##0, 0%, 0.00% 등 흔한 것)을 반영한 글자를 만든다. 모르는 서식이면 null (원래 글자를 쓴다).
const NUMBER_FORMAT = /^(?:"([^"]*)"|[$₩¥€])?([#,0]+)(?:\.(0+))?(%)?(?:"([^"]*)")?$/;
export function formatNumber(value: number, numFmt: string | undefined): string | null {
  if (!numFmt || numFmt === "General" || !Number.isFinite(value)) return null;
  const section = numFmt.split(";")[0].replace(/_.|\\|\[[^\]]*\]/g, "");
  const match = NUMBER_FORMAT.exec(section);
  if (!match) return null;
  const [, quotedPrefix, integerPart, decimals, percent, suffix] = match;
  const symbol = /^[$₩¥€]/.exec(section)?.[0] ?? "";
  const scaled = percent ? value * 100 : value;
  const fixed = Math.abs(scaled).toFixed(decimals ? decimals.length : 0);
  const [intDigits, fracDigits] = fixed.split(".");
  const grouped = integerPart.includes(",")
    ? intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    : intDigits;
  const sign = scaled < 0 && Number(fixed) !== 0 ? "-" : "";
  return `${sign}${quotedPrefix ?? symbol}${grouped}${fracDigits ? `.${fracDigits}` : ""}${percent ?? ""}${suffix ?? ""}`;
}

function readCell(cell: Cell): PreviewCell {
  // 병합된 칸은 맨 왼쪽 위 칸에만 글자를 보여 준다
  const isMergedFollower = cell.master && cell.master.address !== cell.address;
  const fill = cell.fill as
    | { type?: string; pattern?: string; fgColor?: { argb?: string } }
    | undefined;
  const background =
    fill?.type === "pattern" && fill.pattern === "solid" ? argbToCss(fill.fgColor?.argb) : null;

  return {
    text: isMergedFollower
      ? ""
      : (typeof cell.value === "number" ? formatNumber(cell.value, cell.numFmt) : null) ??
        cellToText(cell.value),
    background,
    color: argbToCss(cell.font?.color?.argb),
    bold: Boolean(cell.font?.bold),
  };
}

function previewOf(sheet: Worksheet): SheetPreview {
  const totalColumns = sheet.columnCount;
  const columnCount = Math.min(totalColumns, PREVIEW_MAX_COLS);
  const rowLimit = Math.min(PREVIEW_MAX_ROWS, sheet.rowCount);

  const rows: PreviewCell[][] = [];
  for (let r = 1; r <= rowLimit; r++) {
    const row = sheet.getRow(r);
    const cells: PreviewCell[] = [];
    for (let c = 1; c <= columnCount; c++) cells.push(readCell(row.getCell(c)));
    rows.push(cells);
  }

  return {
    name: sheet.name.normalize("NFC"),
    rows,
    columnCount,
    totalColumns,
    totalRows: sheet.rowCount,
  };
}

/** 모든 시트(숨김 포함)의 이름을 순서대로 돌려준다. */
export function listSheetNames(workbook: Workbook): string[] {
  return workbook.worksheets.map((sheet) => sheet.name.normalize("NFC"));
}

/** 이름으로 시트를 찾아 상단 15줄 미리보기 데이터를 만든다. 없으면 null. */
export function buildSheetPreview(workbook: Workbook, sheetName: string): SheetPreview | null {
  const sheet = workbook.worksheets.find((s) => s.name.normalize("NFC") === sheetName);
  return sheet ? previewOf(sheet) : null;
}
