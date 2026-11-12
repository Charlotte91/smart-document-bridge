import type { MaskedSheet } from "@/lib/excel/mask";

type Props = {
  sheets: MaskedSheet[];
};

// Design Ref: §3 ③ — 시트별 컬럼명 + 개인정보를 가린 샘플 3줄. 가려진 칸은 회색 글씨로 보여 준다.
export default function StructurePreview({ sheets }: Props) {
  return (
    <div className="mt-4 flex flex-col gap-3">
      <h3 className="text-sm font-bold text-navy">
        파일 구조 · 가린 샘플{" "}
        <span className="font-normal text-navy/60">(사내 AI에는 이 내용만 갑니다)</span>
      </h3>
      {sheets.map((sheet) => {
        const renamed = sheet.columns.filter((column) => column.note);
        return (
          <details
            key={sheet.name}
            open
            className="rounded-2xl border border-navy/15 bg-white px-4 py-3"
          >
            <summary className="cursor-pointer text-sm font-semibold text-navy">
              <span className="break-all">{sheet.name}</span>{" "}
              {sheet.hidden && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900">
                  숨김 시트 — 샘플이 사내 AI에 전달됩니다
                </span>
              )}{" "}
              <span className="font-normal text-navy/60">
                {sheet.columns.length === 0
                  ? "(빈 시트)"
                  : `· 컬럼 ${sheet.columns.length}개 · 샘플 ${sheet.sampleRows.length}줄`}
              </span>
            </summary>

            {sheet.columns.length > 0 && (
              <div className="mt-2 overflow-x-auto">
                <table className="min-w-full text-left text-xs text-navy">
                  <thead>
                    <tr className="bg-navy text-white">
                      {sheet.columns.map((column) => (
                        <th key={column.letter} className="whitespace-nowrap px-2 py-1 font-semibold">
                          <span className="mr-1 font-mono text-white/60">{column.letter}</span>
                          {column.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sheet.sampleRows.map((row, rowIndex) => (
                      <tr key={rowIndex} className="border-b border-navy/10">
                        {row.map((text, colIndex) => (
                          <td
                            key={colIndex}
                            title={text}
                            className={`max-w-[12rem] truncate whitespace-nowrap px-2 py-1 ${
                              sheet.maskedCells[rowIndex][colIndex]
                                ? "text-gray-500 underline decoration-dotted"
                                : ""
                            }`}
                          >
                            {sheet.maskedCells[rowIndex][colIndex] && (
                              <span className="sr-only">(가려진 값) </span>
                            )}
                            {text}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {sheet.sampleRows.length === 0 && (
                      <tr>
                        <td
                          colSpan={sheet.columns.length}
                          className="px-2 py-2 text-navy/50"
                        >
                          (컬럼명 아래에 데이터 행이 없습니다)
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {renamed.length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-xs text-navy/60">
                {renamed.map((column) => (
                  <li key={column.letter}>
                    {column.letter}열 &apos;{column.name}&apos;: {column.note}
                  </li>
                ))}
              </ul>
            )}
          </details>
        );
      })}
      <p className="text-xs text-navy/60">
        가림은 정해진 패턴으로 찾는 방식이라 놓치는 경우가 있을 수 있습니다. 특히 이름은 이름
        관련 열(이름·성명·담당자·고객명)에서만 가리므로, 다른 열(예: 비고)에 적힌 이름은 가려지지
        않습니다. 복사하기 전에 꼭 확인하세요.
      </p>
    </div>
  );
}
