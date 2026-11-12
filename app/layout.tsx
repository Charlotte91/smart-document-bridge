import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "스마트 문서/데이터 경량화 브릿지",
  description:
    "대용량 엑셀을 내 PC 브라우저 안에서만 처리해 사내 AI용 프롬프트를 만들고, AI가 준 가공 코드를 안전하게 실행합니다.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
