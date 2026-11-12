// Design Ref: §5 금지어, §7 ① — 실행 전 금지어 검사. 첫 번째 안전장치다.
// 통신·동적 실행 단어가 보이는 코드는 Web Worker까지 보내지 않는다.
// 주석·문자열 안에 있어도 막는다(안전한 쪽으로). 이 검사를 빠져나간 코드는 ②Worker 격리 ③10초 제한 ④CSP가 막는다.

export const BLOCKED_MESSAGE = "외부 통신·동적 실행 코드는 실행할 수 없습니다";

// PRD 5번 must ②의 금지어 + importScripts. 이름 앞뒤가 다른 글자와 이어진 경우(prefetch, important, evaluate 등)는 걸리지 않게 단어 경계를 쓴다.
const FORBIDDEN: { label: string; pattern: RegExp }[] = [
  { label: "fetch", pattern: /\bfetch\b/ },
  { label: "XMLHttpRequest", pattern: /\bXMLHttpRequest\b/ },
  { label: "WebSocket", pattern: /\bWebSocket\b/ },
  { label: "EventSource", pattern: /\bEventSource\b/ },
  { label: "navigator.sendBeacon", pattern: /\bsendBeacon\b/ },
  { label: "import", pattern: /\bimport\b/ },
  { label: "importScripts", pattern: /\bimportScripts\b/ },
  { label: "require", pattern: /\brequire\b/ },
  { label: "eval", pattern: /\beval\b/ },
  // Function( 뿐 아니라 Function (  /  AsyncFunction(  도 걸린다
  { label: "Function(", pattern: /Function\s*\(/ },
];

export type GuardFinding = { label: string; line: number }; // line은 1부터

export type GuardResult = { ok: true } | { ok: false; findings: GuardFinding[] };

/** 코드에 금지어가 있는지 검사한다. 단어마다 처음 나온 줄 번호를 알려 준다. */
export function checkForbidden(code: string): GuardResult {
  // 전각 글자(ｆｅｔｃｈ 등)로 위장한 단어도 잡기 위해 호환 정규화(NFKC)한 글자로 검사한다
  const lines = code.normalize("NFKC").split(/\r\n|\r|\n/);
  const findings: GuardFinding[] = [];

  for (const { label, pattern } of FORBIDDEN) {
    const index = lines.findIndex((line) => pattern.test(line));
    if (index >= 0) findings.push({ label, line: index + 1 });
  }

  return findings.length === 0 ? { ok: true } : { ok: false, findings };
}
