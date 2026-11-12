// Design Ref: §5 더미 데이터 — 시연용 5,000행 민원처리현황 엑셀을 브라우저 안에서 만든다.
// 같은 코드는 언제 실행해도 같은 파일 내용이 나온다(고정 시드). 서버로 아무것도 보내지 않는다.

export const DUMMY_FILE_NAME = "사내_민원처리현황_대용량샘플.xlsx";
export const DUMMY_SHEET_NAME = "2026년_원본데이터";
export const DUMMY_ROW_COUNT = 5000;

const HEADERS = [
  "접수번호",
  "접수일자",
  "담당부서",
  "담당자명",
  "연락처",
  "민원유형",
  "처리상태",
  "처리소요일",
  "만족도점수",
  "주민등록번호", // 마스킹 검증용. 기존 열(A~I)의 위치를 바꾸지 않으려고 맨 끝(J열)에 둔다
] as const;

// 부서마다 처리소요일 평균이 조금씩 다르게 한다 (PRD 6번)
const DEPARTMENTS = [
  { name: "기획조정실", avgDays: 4 },
  { name: "정보화전략팀", avgDays: 5 },
  { name: "시스템운영팀", avgDays: 7 },
  { name: "고객지원팀", avgDays: 3 },
  { name: "보안관리팀", avgDays: 6 },
] as const;

const COMPLAINT_TYPES = [
  "시스템 장애",
  "계정·권한",
  "문서 요청",
  "보안 문의",
  "시설 불편",
  "기타",
] as const;

const STATUSES = ["접수", "처리중", "처리완료", "반려"] as const;

// 가짜 실명 형태의 이름 (실제 사람과 무관한 흔한 글자 조합)
const SURNAMES = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임"];
const GIVEN_NAMES = [
  "철수",
  "영희",
  "민수",
  "지은",
  "서연",
  "도윤",
  "하준",
  "수빈",
  "예진",
  "태현",
  "지훈",
  "유나",
];

// 고정 시드 난수(mulberry32): 같은 시드 → 항상 같은 숫자 순서
function createRandom(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(list: readonly T[], random: () => number): T {
  return list[Math.floor(random() * list.length)];
}

// 평균(avg)을 중심으로 1~14일 사이에 퍼지는 값
function processDays(avg: number, random: () => number): number {
  const value = avg + (random() + random() - 1) * 5;
  return Math.min(14, Math.max(1, Math.round(value)));
}

// 한글 글꼴을 파일에 명시한다. 지정하지 않으면 엑셀 기본 글꼴(Calibri)에는 한글이 없어서,
// 일부 프로그램(예: ONLYOFFICE)이 한글을 중국어 글꼴로 대신 그리는 일이 있다.
// 맥북 시연이 기준이라 맥에 기본으로 들어 있는 글꼴을 쓴다. 다른 글꼴로 바꾸려면 이 값만 고치면 된다.
export const DUMMY_FONT_NAME = "Apple SD Gothic Neo";
const DUMMY_FONT_SIZE = 11;

const COLUMN_WIDTHS = [14, 12, 14, 10, 16, 14, 10, 12, 12, 18];

/**
 * 실제 주민등록번호 규칙을 따르는 가짜 번호를 만든다 (마스킹 검증용 시험 데이터).
 * 형식: YYMMDD-GXXXXXX
 *  - YYMMDD: 존재하는 날짜(윤년 포함)
 *  - G: 성별·세기 (1900년대생 남 1·여 2, 2000년대생 남 3·여 4)
 *  - XXXXXX: 지역 번호 4자리 + 등록 순서 1자리 + 검증번호 1자리
 *  - 검증번호: 앞 12자리에 가중치 2,3,4,5,6,7,8,9,2,3,4,5를 곱해 더한 뒤 (11 − 합 % 11) % 10
 * 무작위로 만든 번호라서 특정인의 번호가 아니다. (우연히 실제 번호와 같을 가능성은 있다)
 */
function makeResidentId(random: () => number): string {
  const year = 1955 + Math.floor(random() * 50); // 1955~2004년생
  const month = 1 + Math.floor(random() * 12);
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  const day = 1 + Math.floor(random() * daysInMonth);
  const female = random() < 0.5;
  const genderDigit = year >= 2000 ? (female ? 4 : 3) : female ? 2 : 1;
  const region = String(Math.floor(random() * 96)).padStart(2, "0") + String(Math.floor(random() * 100)).padStart(2, "0");
  const order = Math.floor(random() * 10);

  const front = `${String(year % 100).padStart(2, "0")}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`;
  const first12 = `${front}${genderDigit}${region}${order}`;
  const weights = [2, 3, 4, 5, 6, 7, 8, 9, 2, 3, 4, 5];
  const sum = first12.split("").reduce((acc, digit, i) => acc + Number(digit) * weights[i], 0);
  const check = (11 - (sum % 11)) % 10;
  return `${front}-${genderDigit}${first12.slice(7)}${check}`;
}

const HEADER_NAVY = "FF1F3864"; // 헤더 배경(남색, ARGB)
const HEADER_WHITE = "FFFFFFFF"; // 헤더 글씨(흰색)

/**
 * 더미 엑셀 파일 내용을 만들어 돌려준다.
 * exceljs는 무거워서 이 함수가 불릴 때에만 불러온다(첫 화면은 가볍게).
 */
export async function createDummyWorkbookBuffer(): Promise<ArrayBuffer> {
  const ExcelJS = (await import("exceljs")).default;
  const random = createRandom(20260112);
  // 주민등록번호는 따로 만든 난수로 뽑는다: 다른 열의 값(부서·이름 등)이 이전 파일과 똑같이 유지되도록
  const residentRandom = createRandom(19791231);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(DUMMY_SHEET_NAME);

  // 열 너비와 기본 글꼴: 열에 지정해 두면 이후 만드는 모든 칸에 한글 글꼴이 적용된다
  sheet.columns = COLUMN_WIDTHS.map((width) => ({
    width,
    style: { font: { name: DUMMY_FONT_NAME, size: DUMMY_FONT_SIZE } },
  }));

  // 1행: 헤더 (남색 배경 + 흰색 굵은 글씨) — 결과 파일에서 원본 서식이 남는지 보여 주기 위함
  sheet.addRow([...HEADERS]);
  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = {
      name: DUMMY_FONT_NAME,
      size: DUMMY_FONT_SIZE,
      bold: true,
      color: { argb: HEADER_WHITE },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: HEADER_NAVY },
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  // 날짜는 Date.UTC로 만든다: 로컬 시간으로 만들면 UTC로 읽을 때 하루가 밀릴 수 있다
  const startMs = Date.UTC(2026, 0, 1);
  const dayMs = 24 * 60 * 60 * 1000;

  for (let i = 0; i < DUMMY_ROW_COUNT; i++) {
    const department = pick(DEPARTMENTS, random);
    const dayOffset = Math.floor((i * 365) / DUMMY_ROW_COUNT); // 접수번호 순서대로 날짜가 흐르게
    const phone = `010-${1000 + Math.floor(random() * 9000)}-${
      1000 + Math.floor(random() * 9000)
    }`;

    sheet.addRow([
      `M2026-${String(i + 1).padStart(5, "0")}`,
      new Date(startMs + dayOffset * dayMs),
      department.name,
      `${pick(SURNAMES, random)}${pick(GIVEN_NAMES, random)}`,
      phone,
      pick(COMPLAINT_TYPES, random),
      pick(STATUSES, random),
      processDays(department.avgDays, random),
      1 + Math.floor(random() * 5),
      makeResidentId(residentRandom),
    ]);
  }

  // 보기 좋게: 날짜 칸 서식 (열 너비와 글꼴은 위에서 열에 지정해 두었다)
  sheet.getColumn(2).numFmt = "yyyy-mm-dd";

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}
