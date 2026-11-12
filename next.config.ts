import type { NextConfig } from "next";

// Design Ref: §7 — 외부 통신 차단(CSP). 경로별로 두 가지 정책을 나눠 건다.
const isDev = process.env.NODE_ENV === "development";

// 정책을 한 줄 글자로 합친다
const policy = (directives: string[]) => directives.join("; ");

// 페이지용: 앱 주소 밖으로는 어떤 통신도 나가지 못하게 한다. 'unsafe-eval'은 주지 않는다.
// 개발 모드(npm run dev)만 React 개발 도구와 화면 자동 새로고침(HMR)을 위해 일부를 더한다.
const pageCsp = policy([
  "default-src 'self'",
  `connect-src 'self'${isDev ? " ws://localhost:* http://localhost:*" : ""}`,
  // Next.js가 페이지에 넣는 작은 내장 스크립트 때문에 'unsafe-inline'이 필요하다
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "worker-src 'self'",
  "img-src 'self' data: blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
]);

// Worker 파일용: 어디와도 통신할 수 없고, 같은 주소의 스크립트와 코드 실행('unsafe-eval')만 허용한다.
// AI 코드를 AsyncFunction으로 실행하려면 'unsafe-eval'이 필요한데, 화면(페이지)에는 주지 않고 Worker에만 준다.
const workerCsp = policy([
  "default-src 'none'",
  "connect-src 'none'",
  "script-src 'self' 'unsafe-eval'",
]);

// 두 정책 묶음에 공통으로 붙는 보안 헤더
const commonHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" }, // 파일 종류를 브라우저가 멋대로 추측하지 못하게
  { key: "Referrer-Policy", value: "no-referrer" }, // 다른 주소로 이동할 때 이 주소를 알리지 않음
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }, // 쓰지 않는 기기 기능 차단
  { key: "X-Frame-Options", value: "DENY" }, // 오래된 브라우저용: 다른 사이트가 이 화면을 액자처럼 넣지 못하게
];

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        // Worker 파일과 그 안에서 읽는 ExcelJS 사본 → Worker용 정책
        source: "/:path(run-code\\.worker\\.js|vendor/.*)",
        headers: [{ key: "Content-Security-Policy", value: workerCsp }, ...commonHeaders],
      },
      {
        // 그 밖의 모든 경로 → 페이지용 정책
        source: "/((?!run-code\\.worker\\.js|vendor/).*)",
        headers: [{ key: "Content-Security-Policy", value: pageCsp }, ...commonHeaders],
      },
    ];
  },
};

export default nextConfig;
