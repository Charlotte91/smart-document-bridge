// Design Ref: §4 ⑮ — 브라우저 메모리의 데이터를 서버를 거치지 않고 바로 파일로 내려받게 한다.

export const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Byte 수를 읽기 쉬운 글자로 바꾼다. 1KB = 1024 Byte (Design §5 경량화 배지 기준) */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Byte`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** 글자가 실제로 몇 Byte인지 센다 (한글은 UTF-8로 한 글자에 3 Byte). */
export function countBytes(text: string): number {
  return new TextEncoder().encode(text).length;
}

/**
 * 감소율(%)을 소수 첫째 자리에서 **내림**해 돌려준다. (Design §5 경량화 배지)
 * 99.96% → 99.9%: 반올림하면 100%로 과장되기 때문이다. 프롬프트가 원본 이상이면 0.
 */
export function calcReductionPercent(originalBytes: number, promptBytes: number): number {
  if (originalBytes <= 0 || promptBytes >= originalBytes) return 0;
  return Math.floor(((originalBytes - promptBytes) * 1000) / originalBytes) / 10;
}

/** 데이터를 Blob으로 만들어 `<a download>`를 눌러 내려받는다. 파일명은 NFC로 정리한다. */
export function downloadBlob(
  data: ArrayBuffer,
  fileName: string,
  mimeType: string = XLSX_MIME,
): void {
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName.normalize("NFC");
  document.body.appendChild(link);
  link.click();
  link.remove();
  // 클릭 직후 바로 지우면 일부 브라우저에서 다운로드가 끊길 수 있어 잠시 뒤에 지운다
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
