// Design Ref: §4 ④⑭, §5 원본 비교 — 파일을 읽은 직후 원본 시트의 칸 값과 1행 헤더 서식을 글자로 저장해 두고,
// 코드를 실행한 뒤 결과 파일의 같은 이름 시트와 비교해 원본이 바뀌었는지 찾는다. (Plan SC-7: 원본 변경 0건)
import type { CellValue, Workbook, Worksheet } from "exceljs";
import { scanRisks } from "./risk";

export type WorkbookSnapshot = {
  /** 시트 이름(NFC) → 행(0부터) → 열(0부터) → 정규화한 칸 값 글자. 빈 칸은 빈 문자열 */
  values: Record<string, string[][]>;
  /** 시트 이름(NFC) → 1행 헤더 각 칸의 서식 글자(굵기·글꼴·글자색·배경색) */
  headerStyles: Record<string, string[]>;
  /** 원본에 이미 있던 외부 연결 수식·링크의 키 (결과에서 새로 생긴 것만 경고하려고 저장) */
  riskKeys: string[];
};

/**
 * 칸 값을 비교하기 좋은 글자로 바꾼다.
 * Date → getTime, 수식 → formula+result, 서식 글자 → 글자만, 나머지 → 글자.
 * (Date나 수식 객체는 ===로 비교하면 같은 값도 항상 다르게 나오기 때문)
 */
export function normalizeCellValue(value: CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return `date:${value.getTime()}`;
  if (typeof value === "object") {
    if ("formula" in value || "sharedFormula" in value) {
      const formula =
        "formula" in value ? value.formula : (value.sharedFormula ?? "");
      const result = "result" in value ? normalizeCellValue(value.result as CellValue) : "";
      return `formula:${formula}=>${result}`;
    }
    if ("richText" in value) {
      return value.richText.map((part) => part.text).join("").normalize("NFC");
    }
    if ("text" in value) {
      // 하이퍼링크: 보이는 글자와 함께 연결 주소도 비교한다 (주소만 바꾸는 것도 원본 변경이다)
      const link = "hyperlink" in value && typeof value.hyperlink === "string" ? `|link:${value.hyperlink}` : "";
      return `${String(value.text).normalize("NFC")}${link}`;
    }
    if ("error" in value) return String(value.error);
    return JSON.stringify(value);
  }
  return typeof value === "string" ? value.normalize("NFC") : String(value);
}

// 1행 칸 하나의 서식을 글자 한 줄로 만든다 (SC-7: 헤더 남색·흰 글씨가 유지되는지)
function headerStyleSignature(sheet: Worksheet, colNumber: number): string {
  const cell = sheet.getRow(1).getCell(colNumber);
  const font = cell.font ?? {};
  const fill = cell.fill as { type?: string; pattern?: string; fgColor?: { argb?: string } } | undefined;
  return [
    font.bold ? "bold" : "-",
    font.italic ? "italic" : "-",
    font.name ?? "-",
    font.size ?? "-",
    font.color?.argb ?? "-",
    fill?.type ?? "-",
    fill?.pattern ?? "-",
    fill?.fgColor?.argb ?? "-",
  ].join("|");
}

/** 모든 시트의 모든 칸 값과 1행 헤더 서식을 저장한다. */
export function createSnapshot(workbook: Workbook): WorkbookSnapshot {
  const values: WorkbookSnapshot["values"] = {};
  const headerStyles: WorkbookSnapshot["headerStyles"] = {};

  workbook.eachSheet((sheet) => {
    const name = sheet.name.normalize("NFC");
    const rows: string[][] = [];
    sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cells[colNumber - 1] = normalizeCellValue(cell.value);
      });
      rows[rowNumber - 1] = cells;
    });
    values[name] = rows;

    const styles: string[] = [];
    for (let col = 1; col <= sheet.columnCount; col++) {
      styles[col - 1] = headerStyleSignature(sheet, col);
    }
    headerStyles[name] = styles;
  });

  return { values, headerStyles, riskKeys: scanRisks(workbook).map((r) => r.key) };
}

export type SheetDiff = {
  sheet: string;
  missing: boolean; // 원본 시트가 결과에서 사라졌는가
  changedCells: number; // 값이 바뀐(또는 새로 생긴) 칸 수
  examples: string[]; // 바뀐 칸 주소 예시 (최대 3개)
  headerStyleChanged: boolean; // 1행 헤더 서식이 바뀌었는가
};

function columnLetter(index: number): string {
  let n = index + 1;
  let letters = "";
  while (n > 0) {
    const rest = (n - 1) % 26;
    letters = String.fromCharCode(65 + rest) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

/**
 * 원본 스냅샷과 결과 스냅샷을 비교한다. 원본에 있던 시트마다 같은 이름 시트를 찾아
 * 모든 칸 값과 1행 헤더 서식을 비교하고, 달라진 시트만 돌려준다. 빈 배열이면 원본이 그대로다.
 * (결과에 새로 추가된 시트는 정상이므로 보지 않는다)
 */
export function compareSnapshots(original: WorkbookSnapshot, result: WorkbookSnapshot): SheetDiff[] {
  const diffs: SheetDiff[] = [];

  for (const sheet of Object.keys(original.values)) {
    const before = original.values[sheet];
    const after = result.values[sheet];
    if (!after) {
      diffs.push({ sheet, missing: true, changedCells: 0, examples: [], headerStyleChanged: false });
      continue;
    }

    let changedCells = 0;
    const examples: string[] = [];
    const rowCount = Math.max(before.length, after.length);
    for (let r = 0; r < rowCount; r++) {
      const rowBefore = before[r] ?? [];
      const rowAfter = after[r] ?? [];
      const colCount = Math.max(rowBefore.length, rowAfter.length);
      for (let c = 0; c < colCount; c++) {
        if ((rowBefore[c] ?? "") !== (rowAfter[c] ?? "")) {
          changedCells++;
          if (examples.length < 3) examples.push(`${columnLetter(c)}${r + 1}`);
        }
      }
    }

    const styleBefore = original.headerStyles[sheet] ?? [];
    const styleAfter = result.headerStyles[sheet] ?? [];
    const headerStyleChanged =
      styleBefore.length !== styleAfter.length || styleBefore.some((s, i) => s !== styleAfter[i]);

    if (changedCells > 0 || headerStyleChanged) {
      diffs.push({ sheet, missing: false, changedCells, examples, headerStyleChanged });
    }
  }

  return diffs;
}
