// Design Ref: §4 ⑪⑫, §7 ②③ — 코드를 Web Worker에서 실행하고, 10초 제한과 종료를 맡는다.
// 실행마다 Worker를 새로 만들고 끝나면 없앤다. 이전 실행의 흔적이 다음 실행에 남지 않는다.

export const RUN_TIME_LIMIT_MS = 10_000; // 코드 실행 시간 제한 (엑셀 읽기와 결과 파일 쓰기 시간은 포함하지 않음)
export const PREPARE_TIME_LIMIT_MS = 30_000; // 준비 단계(ExcelJS 로드·원본 읽기)의 별도 상한
export const WRITE_TIME_LIMIT_MS = 30_000; // 결과 파일을 만드는 단계의 별도 상한

export const RESULT_MAX_BYTES = 50 * 1024 * 1024; // 결과 파일 크기 상한 (브라우저 메모리·화면 멈춤 방지)
export const MESSAGE_RESULT_TOO_LARGE = "결과 파일이 너무 큽니다(최대 50MB). 결과에 담는 데이터 양을 줄여 다시 요청하세요";
export const MESSAGE_TIMEOUT = "코드 실행 시간이 너무 깁니다";
export const MESSAGE_WRITE_TIMEOUT = "결과 파일을 만드는 시간이 너무 깁니다";
export const MESSAGE_PREPARE_TIMEOUT = "엑셀을 읽고 실행을 준비하는 시간이 너무 깁니다. 새로고침한 뒤 다시 시도하세요";
export const MESSAGE_PREPARE_FAILED = "엑셀을 읽고 실행을 준비하는 중 문제가 생겼습니다. 새로고침한 뒤 다시 시도하세요";
export const MESSAGE_WRITE_FAILED = "결과 파일을 만드는 중 오류가 났습니다";
export const MESSAGE_SYNTAX_HINT = "코드 블록만 붙여 넣었는지 확인하세요";
export const MESSAGE_ORIGINAL_SAFE = "원본은 그대로이니 코드를 고쳐 다시 실행하세요";
export const MESSAGE_ORIGINAL_CHANGED = "원본 시트가 변경되었습니다";

export type RunOutcome =
  | { ok: true; buffer: ArrayBuffer }
  | { ok: false; kind: "timeout" | "error" | "worker"; message: string; isSyntax?: boolean };

export type RunPhase = "preparing" | "running" | "writing";

export type RunHandle = {
  promise: Promise<RunOutcome>;
  cancel: () => void; // 화면을 떠날 때 등 결과가 필요 없어졌을 때 Worker를 바로 종료한다
};

// Worker가 보내는 메시지. token은 이번 실행에서 화면이 정해 Worker에 알려 준 값이라, 맞지 않는 메시지는 무시한다.
type FromWorker = { token?: string } & (
  | { type: "ready" }
  | { type: "writing" }
  | { type: "done"; buffer: ArrayBuffer }
  | { type: "error"; message: string; isSyntax: boolean; phase?: "prepare" | "run" | "write" }
);

// 이번 실행 전용 확인 값. AI 코드는 이 값을 알 수 없다(Worker 안 지역 변수로만 들어간다).
function makeToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * originalBuffer의 사본을 Worker에 넘겨 코드를 실행한다. 원본 ArrayBuffer는 그대로 남는다.
 * @param onPhase 준비 → 실행 단계가 바뀔 때 알려 준다 (화면의 진행 표시용)
 */
export function runInWorker(
  originalBuffer: ArrayBuffer,
  code: string,
  onPhase?: (phase: RunPhase) => void,
): RunHandle {
  const worker = new Worker("/run-code.worker.js");
  const token = makeToken();
  // 단계는 preparing → running → writing 순서로 한 번씩만 넘어간다. 거꾸로 가거나 반복하는 메시지는 무시한다.
  let stage: RunPhase = "preparing";
  let timer: ReturnType<typeof setTimeout> | null = null;
  let finish: (outcome: RunOutcome) => void = () => {};

  const promise = new Promise<RunOutcome>((resolve) => {
    let finished = false;
    finish = (outcome) => {
      if (finished) return;
      finished = true;
      if (timer) clearTimeout(timer);
      worker.terminate(); // 어떤 경우에도 Worker는 끝나면 없앤다 (무한 반복하던 코드도 여기서 멈춘다)
      resolve(outcome);
    };

    timer = setTimeout(
      // 준비 단계 초과는 코드 탓이 아니므로 코드 실행 시간 초과와 다른 문구·종류(worker)로 알린다
      () => finish({ ok: false, kind: "worker", message: MESSAGE_PREPARE_TIMEOUT }),
      PREPARE_TIME_LIMIT_MS,
    );

    worker.onmessage = (event: MessageEvent<FromWorker>) => {
      const message = event.data;
      if (!message || message.token !== token) return; // 확인 값이 맞지 않으면 Worker가 보낸 정식 메시지가 아니다
      if (message.type === "ready" && stage === "preparing") {
        // 엑셀 읽기를 마쳤다. 이제부터 코드 실행 10초를 잰다. (ready는 한 번만 받는다)
        stage = "running";
        if (timer) clearTimeout(timer);
        timer = setTimeout(
          () => finish({ ok: false, kind: "timeout", message: MESSAGE_TIMEOUT }),
          RUN_TIME_LIMIT_MS,
        );
        onPhase?.("running");
      } else if (message.type === "writing" && stage === "running") {
        // 코드 실행이 끝났다. 결과 파일 쓰기는 10초에 넣지 않고 별도 상한으로 잰다.
        stage = "writing";
        if (timer) clearTimeout(timer);
        timer = setTimeout(
          () => finish({ ok: false, kind: "timeout", message: MESSAGE_WRITE_TIMEOUT }),
          WRITE_TIME_LIMIT_MS,
        );
        onPhase?.("writing");
      } else if (message.type === "done" && stage === "writing") {
        if (message.buffer.byteLength > RESULT_MAX_BYTES) {
          finish({ ok: false, kind: "error", message: MESSAGE_RESULT_TOO_LARGE });
        } else {
          finish({ ok: true, buffer: message.buffer });
        }
      } else if (message.type === "error") {
        if (message.phase === "prepare") {
          // 코드 실행 전에 난 오류(ExcelJS 로드 실패 등)는 코드 탓이 아니다
          finish({ ok: false, kind: "worker", message: `${MESSAGE_PREPARE_FAILED} (${message.message})` });
        } else if (message.phase === "write") {
          finish({ ok: false, kind: "error", message: `${MESSAGE_WRITE_FAILED} (${message.message})` });
        } else {
          finish({ ok: false, kind: "error", message: message.message, isSyntax: message.isSyntax });
        }
      }
    };
    worker.onerror = (event) => {
      event.preventDefault();
      finish({ ok: false, kind: "worker", message: event.message || "작업 공간(Worker)에서 오류가 났습니다" });
    };
    worker.onmessageerror = () =>
      finish({ ok: false, kind: "worker", message: "작업 공간에서 받은 데이터를 읽을 수 없습니다" });

    onPhase?.("preparing");
    // 사본을 만들어 transfer로 넘긴다 → 화면 쪽 원본 ArrayBuffer는 그대로 유지된다
    const copy = originalBuffer.slice(0);
    worker.postMessage({ type: "run", buffer: copy, code, token }, [copy]);
  });

  return {
    promise,
    cancel: () => finish({ ok: false, kind: "worker", message: "실행이 취소되었습니다" }),
  };
}
