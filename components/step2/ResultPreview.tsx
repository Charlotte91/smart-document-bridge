"use client";

import { useId, useMemo, useState, type KeyboardEvent } from "react";
import type { Workbook } from "exceljs";
import { buildSheetPreview, listSheetNames, PREVIEW_MAX_ROWS } from "@/lib/excel/preview";

type Props = {
  workbook: Workbook; // 코드 실행 결과 workbook
  originalSheetNames: string[]; // 원본 파일에 있던 시트 이름 (새로 만들어진 시트를 먼저 보여 주기 위해)
};

// Design Ref: §3 ⑨ — 결과 workbook의 모든 시트를 탭 버튼으로 보여 주고, 고른 시트의 상단 15줄을 칸 배경색까지 반영해 표로 보여 준다.
export default function ResultPreview({ workbook, originalSheetNames }: Props) {
  const sheetNames = useMemo(() => listSheetNames(workbook), [workbook]);

  // 처음에는 코드가 새로 만든 시트(원본에 없던 시트)를 먼저 보여 준다. 없으면 첫 시트.
  const [selected, setSelected] = useState(
    () => sheetNames.find((name) => !originalSheetNames.includes(name)) ?? sheetNames[0] ?? "",
  );
  const baseId = useId();

  // 탭 키보드 조작: 좌우 화살표·Home·End로 시트를 옮긴다
  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % sheetNames.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + sheetNames.length) % sheetNames.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = sheetNames.length - 1;
    else return;
    event.preventDefault();
    setSelected(sheetNames[next]);
    document.getElementById(`${baseId}-tab-${next}`)?.focus();
  }

  const selectedIndex = Math.max(0, sheetNames.indexOf(selected));
  const preview = useMemo(() => buildSheetPreview(workbook, selected), [workbook, selected]);

  return (
    <section aria-label="결과 미리보기" className="mt-4 flex flex-col gap-2">
      <h3 className="text-sm font-bold text-navy">
        결과 미리보기{" "}
        <span className="font-normal text-navy/60">(시트별 상단 {PREVIEW_MAX_ROWS}줄)</span>
      </h3>

      <div role="tablist" aria-label="결과 시트" className="flex flex-wrap gap-1.5">
        {sheetNames.map((name, index) => {
          const isNew = !originalSheetNames.includes(name);
          const active = name === selected;
          return (
            <button
              key={name}
              type="button"
              role="tab"
              id={`${baseId}-tab-${index}`}
              aria-selected={active}
              aria-controls={`${baseId}-panel`}
              tabIndex={active ? 0 : -1}
              onKeyDown={(event) => handleTabKey(event, index)}
              onClick={() => setSelected(name)}
              className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
                active
                  ? "border-navy bg-navy text-white"
                  : "border-navy/30 bg-white text-navy hover:bg-navy/5"
              }`}
            >
              {name}
              {isNew && (
                <span className={`ml-1.5 font-normal ${active ? "text-white/70" : "text-accent"}`}>
                  새 시트
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`${baseId}-panel`}
        aria-labelledby={`${baseId}-tab-${selectedIndex}`}
        className="flex flex-col gap-2"
      >
      {preview && preview.columnCount > 0 ? (
        <>
          <div className="overflow-x-auto rounded-2xl border border-navy/15 bg-white">
            <table className="min-w-full border-collapse text-left text-xs text-navy">
              <tbody>
                {preview.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, colIndex) => (
                      <td
                        key={colIndex}
                        title={cell.text}
                        style={{
                          backgroundColor: cell.background ?? undefined,
                          color: cell.color ?? undefined,
                          fontWeight: cell.bold ? 700 : undefined,
                        }}
                        className="max-w-[12rem] truncate whitespace-nowrap border border-navy/10 px-2 py-1"
                      >
                        {cell.text}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-navy/60">
            전체 {preview.totalRows.toLocaleString("ko-KR")}줄 중 앞 {preview.rows.length}줄
            {preview.totalColumns > preview.columnCount &&
              ` · 열 ${preview.totalColumns}개 중 앞 ${preview.columnCount}개`}
            만 보여 줍니다.
          </p>
        </>
      ) : (
        <p className="rounded-2xl border border-navy/15 bg-white px-4 py-6 text-center text-sm text-navy/60">
          (빈 시트)
        </p>
      )}
      </div>

      <p className="text-xs text-navy/60">
        결과 파일은 가리지 않은 원본 데이터를 담고 있습니다. 원본 파일과 같은 수준으로 다루세요.
      </p>
    </section>
  );
}
