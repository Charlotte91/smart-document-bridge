// Design Ref: §5 마스킹 — 샘플 3줄에서 이름·이메일·주민번호·전화번호를 가린다.
// 순서: 이메일 → 주민번호 → 전화번호 → 이름 열. (앞 단계 결과에 뒤 규칙이 다시 걸리지 않게)
// 글자 자르기(50자→20자)는 이 다음 단계(프롬프트 만들기)에서 한다. 자르면서 가림이 풀리지 않게 하기 위해서다.
import type { SheetStructure } from "./extract";
import { FORMULA_PLACEHOLDER } from "./cellText";

// 컬럼명에 이 글자가 들어 있으면 그 열을 이름 열로 본다 (PRD 5번)
// (PRD의 4개에 보안 점검에서 빠지기 쉬운 열 이름을 더했다. 더 많이 가리는 쪽이 안전하다)
const NAME_COLUMN_KEYWORDS = [
  "이름", "성명", "담당자", "고객명",
  "성함", "신청인", "민원인", "작성자", "접수자", "처리자", "대표자", "보호자",
  "직원명", "환자명", "회원명", "사용자명", "이용자",
];

export function isNameColumn(columnName: string): boolean {
  const name = columnName.normalize("NFC");
  return NAME_COLUMN_KEYWORDS.some((keyword) => name.includes(keyword)) || /name/i.test(name);
}

// 이메일: @ 앞 첫 2글자만 남긴다. @ 앞이 2글자 이하면 첫 1글자만 남긴다.
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
function maskEmail(match: string): string {
  const at = match.indexOf("@");
  const local = match.slice(0, at);
  const keep = local.length > 2 ? 2 : 1;
  return `${local.slice(0, keep)}***${match.slice(at)}`;
}

// 주민번호(외국인등록번호 포함): 앞 6자리만 남기고 뒤 7자리를 가린다. 구분은 하이픈·공백·없음 모두 잡고, 앞뒤에 다른 숫자가 붙어 있으면 제외한다.
const RESIDENT_ID = /(?<!\d)(\d{6})[- ]?[1-8]\d{6}(?!\d)/g;

// 전화번호: 앞자리(지역·통신사 번호)만 남기고 가운데·끝을 가린다. 구분은 하이픈·점·공백·없음 모두 잡고, 가운데가 3자리여도 똑같이 ****로 통일한다.
const PHONE = /(?<!\d)(0\d{1,2})[-. ]?\d{3,4}[-. ]?\d{4}(?!\d)/g;

// 국제 형식 전화번호: +82 10-1234-5678, +82-010-… → 앞자리만 남긴다
const PHONE_INTL = /(?<!\d)\+82[- .]?0?(\d{1,2})[-. ]?\d{3,4}[-. ]?\d{4}(?!\d)/g;

// 엑셀에 숫자로 입력된 번호는 맨 앞 0이 사라진다. 칸 전체가 이 모양이면 0을 되살려 같은 규칙으로 가린다.
//  - 휴대전화: 01012345678 → 1012345678 (010·011·016·017·018·019)
//  - 주민번호: 0xxxxx-xxxxxxx(2000년대생) → 12자리
const LOST_ZERO_PHONE = /^1[016789]\d{7,8}$/;
const LOST_ZERO_RESIDENT = /^\d{12}$/;

function maskNumericCell(text: string): string | null {
  const digits = text.replace(/[\s]/g, "");
  if (LOST_ZERO_PHONE.test(digits)) return `0${digits}`.replace(PHONE, "$1-****-****");
  if (LOST_ZERO_RESIDENT.test(digits)) {
    const padded = `0${digits}`;
    const month = Number(padded.slice(2, 4));
    const day = Number(padded.slice(4, 6));
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && RESIDENT_ID_TEST.test(padded)) {
      return `${padded.slice(0, 6)}-*******`;
    }
  }
  return null;
}
const RESIDENT_ID_TEST = /^\d{6}[1-8]\d{6}$/;

/** 이름: 첫 글자만 남기고 나머지를 *로 (김철수 → 김**). */
function maskName(text: string): string {
  const chars = [...text];
  if (chars.length <= 1) return text;
  return chars[0] + "*".repeat(chars.length - 1);
}

/** 칸 하나를 가린다. isName이 참이면 이름 규칙도 적용한다. */
export function maskCell(text: string, isName: boolean): string {
  if (text === "" || text === FORMULA_PLACEHOLDER) return text;
  const numeric = maskNumericCell(text);
  if (numeric !== null) return isName ? maskName(numeric) : numeric;
  let result = text
    .replace(EMAIL, maskEmail)
    .replace(RESIDENT_ID, "$1-*******")
    .replace(PHONE_INTL, "+82-$1-****-****")
    .replace(PHONE, "$1-****-****");
  if (isName) result = maskName(result);
  return result;
}

export type MaskedSheet = SheetStructure & {
  /** 샘플 칸마다 가려졌는지 여부. 미리보기에서 가린 칸을 회색으로 보여 주는 데 쓴다 */
  maskedCells: boolean[][];
};

// 컬럼명은 길이 제한이 없어 긴 지시문을 숨길 수 있고, 제목 줄 없는 파일이면 첫 데이터가 들어올 수 있다.
// 그래서 컬럼명(과 바꿔 부른 이유)에도 같은 가림을 적용하고 50자로 줄인다. 시트 이름은 AI 코드가 시트를 찾는 데 쓰므로 그대로 둔다.
const COLUMN_NAME_MAX = 50;
function safeColumnText(text: string): string {
  const masked = maskCell(text, false);
  const chars = [...masked];
  return chars.length > COLUMN_NAME_MAX ? chars.slice(0, COLUMN_NAME_MAX - 1).join("") + "…" : masked;
}

/** 모든 시트의 샘플을 가린다. 컬럼명도 같은 규칙으로 가리고 줄이며, 시트 이름은 그대로 둔다. */
export function maskStructure(sheets: SheetStructure[]): MaskedSheet[] {
  return sheets.map((sheet) => {
    const nameFlags = sheet.columns.map((column) => isNameColumn(column.name)); // 이름 열 판단은 원래 컬럼명으로
    const columns = sheet.columns.map((column) => ({
      ...column,
      name: safeColumnText(column.name),
      note: column.note === undefined ? undefined : safeColumnText(column.note),
    }));
    const maskedCells: boolean[][] = [];
    const sampleRows = sheet.sampleRows.map((row) => {
      const flags: boolean[] = [];
      const masked = row.map((text, index) => {
        const result = maskCell(text, nameFlags[index]);
        flags.push(result !== text);
        return result;
      });
      maskedCells.push(flags);
      return masked;
    });
    return { ...sheet, columns, sampleRows, maskedCells };
  });
}
