// Design Ref: §4 ⑪, §7 — AI 코드를 격리해서 실행하는 Web Worker. 번들러를 거치지 않는 고정 경로의 일반 파일이다.
// 이 파일에는 Worker용 CSP(next.config.ts)가 붙는다: 어디와도 통신할 수 없고, 코드 실행('unsafe-eval')만 허용된다.
//
// 받는 메시지: { type: 'run', buffer: ArrayBuffer(원본 파일 사본), code: string(정리·검사를 마친 코드), token: string }
// 보내는 메시지(모두 token을 함께 보낸다. 화면 쪽은 token이 맞는 메시지만 믿는다):
//   { type: 'ready' }    엑셀 읽기를 마치고 코드 실행 직전  (이때부터 화면 쪽이 코드 실행 10초를 잰다)
//   { type: 'writing' }  코드 실행이 끝나고 결과 파일을 만들기 직전 (결과 쓰기는 10초에 포함하지 않고 따로 잰다)
//   { type: 'done', buffer: ArrayBuffer }  결과 엑셀 파일 데이터
//   { type: 'error', message: string, isSyntax: boolean, phase: 'prepare'|'run'|'write' }
//
// token은 이 함수 안의 지역 변수에만 있어서 AI 코드(전역 범위에서 실행)가 읽을 수 없다.
// 그래서 AI 코드가 self.postMessage로 ready·writing·done을 흉내 내 시간 제한을 피하거나 결과를 위조할 수 없다.
// post는 AI 코드가 실행되기 전에 원래 postMessage를 붙잡아 둔 것이라, 코드가 self.postMessage를 바꿔 치워도 token이 새지 않는다.
const post = self.postMessage.bind(self);

// 보조 장치 ⓐ: 코드 실행 직전에 통신·Worker 생성 함수를 지운다 (금지어 검사를 빠져나간 코드를 위한 두 번째 막이).
// 자기 자신뿐 아니라 부모(프로토타입)에 있는 것도 지워서 Object.getPrototypeOf(self).fetch 같은 우회도 막는다.
const COMMUNICATION_NAMES = [
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
  "WebTransport",
  "importScripts",
  "Worker",
  "SharedWorker",
  "sendBeacon",
  // 브라우저 저장소: 같은 주소의 저장소에 데이터를 남기거나 다른 탭과 주고받는 통로를 없앤다
  "indexedDB",
  "caches",
  "BroadcastChannel",
  "storage", // navigator.storage: 브라우저 안 파일 공간(OPFS) 접근 통로
];

function removeCommunication() {
  const targets = [self];
  for (let o = Object.getPrototypeOf(self); o; o = Object.getPrototypeOf(o)) targets.push(o);
  if (typeof navigator !== "undefined") {
    targets.push(navigator);
    for (let o = Object.getPrototypeOf(navigator); o; o = Object.getPrototypeOf(o)) targets.push(o);
  }
  for (const target of targets) {
    for (const name of COMMUNICATION_NAMES) {
      if (!Object.prototype.hasOwnProperty.call(target, name)) continue;
      try {
        Object.defineProperty(target, name, { value: undefined, writable: false, configurable: false });
      } catch {
        // 지울 수 없으면(드문 경우) 값을 비우는 것만 시도한다
        try {
          target[name] = undefined;
        } catch {
          /* 무시: 마지막 방어선은 CSP(connect-src 'none')다 */
        }
      }
    }
  }
}

// 보조 장치 ⓓ: AI 코드가 도는 동안만 동적 코드 실행 통로를 막는다 (금지어 검사를 빠져나간 코드를 위한 막).
// eval, Function, (async()=>{}).constructor 같은 방법과 setTimeout("글자") 방식이 모두 막힌다.
// 코드 실행이 끝나면 되돌려서, 결과 파일을 쓰는 ExcelJS가 영향을 받지 않게 한다.
function blockDynamicCode() {
  const saved = [];
  const thrower = function () {
    throw new Error("eval·Function 같은 동적 코드 실행은 사용할 수 없습니다");
  };
  const findOwner = (target, name) => {
    for (let o = target; o; o = Object.getPrototypeOf(o)) {
      if (Object.prototype.hasOwnProperty.call(o, name)) return o;
    }
    return null;
  };
  const replace = (target, name, value) => {
    const owner = findOwner(target, name);
    if (!owner) return;
    const descriptor = Object.getOwnPropertyDescriptor(owner, name);
    if (!descriptor || !descriptor.configurable || !("value" in descriptor)) return;
    saved.push([owner, name, descriptor]);
    Object.defineProperty(owner, name, { ...descriptor, value });
  };

  replace(self, "eval", thrower);
  replace(self, "Function", thrower);
  for (const sample of [function () {}, async function () {}, function* () {}, async function* () {}]) {
    replace(Object.getPrototypeOf(sample), "constructor", thrower);
  }
  for (const name of ["setTimeout", "setInterval"]) {
    const original = self[name];
    if (typeof original !== "function") continue;
    replace(self, name, function (handler, ...rest) {
      if (typeof handler === "string") thrower(); // 글자로 준 코드는 eval과 같다
      return original.call(self, handler, ...rest);
    });
  }

  return () => {
    for (const [owner, name, descriptor] of saved.reverse()) {
      try {
        Object.defineProperty(owner, name, descriptor);
      } catch {
        /* 무시 */
      }
    }
  };
}

// 결과 파일의 한글이 깨져 보이지 않게, 코드가 새로 만든 시트의 글꼴을 한글 글꼴로 맞춘다.
// 글꼴 이름이 없거나 영문 전용 글꼴(Calibri·Arial 등)이면 한글이 없는 글꼴이라, 일부 프로그램이 한글을
// 중국어 글꼴 등으로 대신 그려 깨져 보인다. 그래서 '맑은 고딕' + 한글 문자 집합(charset 129)을 지정한다.
// 원본 시트는 한 칸도 건드리지 않고(원본 보존 검사), 이미 한글 글꼴을 지정한 칸도 그대로 둔다.
const KOREAN_FONT = "맑은 고딕";
const LATIN_ONLY_FONTS = new Set([
  "calibri", "calibri light", "arial", "helvetica", "times new roman", "cambria",
  "verdana", "tahoma", "segoe ui", "consolas", "courier new", "georgia",
]);

function applyKoreanFont(workbook, originalSheetIds) {
  try {
    workbook.eachSheet((sheet) => {
      if (originalSheetIds.has(sheet.id)) return;
      sheet.eachRow({ includeEmpty: false }, (row) => {
        row.eachCell({ includeEmpty: false }, (cell) => {
          const font = cell.font || {};
          const name = font.name ? String(font.name).toLowerCase() : "";
          if (name === "" || LATIN_ONLY_FONTS.has(name)) {
            cell.font = { ...font, name: KOREAN_FONT, charset: 129, family: 3, size: font.size || 11 };
          }
        });
      });
    });
  } catch {
    /* 글꼴 맞춤에 실패해도 결과 파일 만들기는 계속한다 */
  }
}

let started = false; // 실행마다 Worker를 새로 만들지만, 혹시 모를 중복 실행을 막는다

self.onmessage = async (event) => {
  const data = event.data;
  if (!data || data.type !== "run" || started) return;
  started = true;
  const token = data.token;
  let phase = "prepare"; // 오류가 어느 단계에서 났는지 화면 쪽에 알려 주기 위한 표시 (prepare → run → write)

  try {
    // ExcelJS를 같은 주소(/vendor)에서 읽는다. 외부 주소는 CSP가 막는다.
    importScripts("/vendor/exceljs.min.js");

    // 원본 파일 사본으로 workbook을 만든다 (화면 쪽 원본 데이터는 건드리지 않는다)
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(data.buffer);

    const originalSheetIds = new Set(workbook.worksheets.map((sheet) => sheet.id));

    post({ type: "ready", token });
    phase = "run";

    removeCommunication();

    // 사내 AI가 준 코드를 AsyncFunction('workbook', 코드)로 실행한다
    const AsyncFunction = (async () => {}).constructor;
    const userFunction = new AsyncFunction("workbook", data.code);
    const restoreDynamicCode = blockDynamicCode();
    try {
      await userFunction(workbook);
    } finally {
      restoreDynamicCode();
    }

    // 코드 실행이 끝났다. 이제부터는 결과 파일을 만드는 시간이라 10초 제한과 따로 잰다.
    post({ type: "writing", token });
    phase = "write";
    applyKoreanFont(workbook, originalSheetIds);

    // 결과 파일 데이터만 화면 쪽으로 돌려준다
    const written = await workbook.xlsx.writeBuffer();
    const buffer = written.buffer.slice(written.byteOffset, written.byteOffset + written.byteLength);
    post({ type: "done", buffer, token }, [buffer]);
  } catch (error) {
    const message = error && error.message ? String(error.message) : String(error);
    post({ type: "error", message, isSyntax: error instanceof SyntaxError, phase, token });
  }
};
