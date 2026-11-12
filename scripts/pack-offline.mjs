// 폐쇄망 반출용 묶음 만들기. `npm run pack:offline`이 next build 다음에 이 파일을 실행한다.
// 결과: offline-dist/smart-bridge-offline/ (+ 가능하면 .zip). 이 폴더만 USB 등으로 옮기면 된다.
// 받는 PC에는 Node.js(20 이상)만 있으면 되고, npm install·인터넷은 필요 없다.
import { cpSync, existsSync, mkdirSync, renameSync, writeFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { basename, join } from "node:path";

const root = process.cwd();
const standalone = join(root, ".next", "standalone");
if (!existsSync(join(standalone, "server.js"))) {
  console.error("`.next/standalone/server.js`가 없습니다. 먼저 npm run build가 성공해야 합니다.");
  process.exit(1);
}

const outRoot = join(root, "offline-dist");
const outDir = join(outRoot, "smart-bridge-offline");
mkdirSync(outRoot, { recursive: true });

// 이전 묶음이 있으면 지우지 않고 trash-can으로 옮겨 둔다 (프로젝트 규칙)
if (existsSync(outDir)) {
  const trash = join(root, "trash-can");
  mkdirSync(trash, { recursive: true });
  const stamp = Date.now();
  renameSync(outDir, join(trash, `offline-dist-${stamp}`));
  const oldZip = join(outRoot, "smart-bridge-offline.zip");
  if (existsSync(oldZip)) renameSync(oldZip, join(trash, `offline-dist-${stamp}.zip`));
}
mkdirSync(outDir, { recursive: true });

// 1) 서버 본체 + 필요한 라이브러리만 추려진 standalone, 2) 정적 파일(.next/static), 3) public(Worker·exceljs 복사본)
// 비밀 정보 파일(.env*)은 절대 묶음에 넣지 않는다. (standalone 폴더에는 .env 사본이 따라 들어올 수 있다)
const skipSecrets = (src) => !basename(src).startsWith(".env");
cpSync(standalone, outDir, { recursive: true, filter: skipSecrets });
cpSync(join(root, ".next", "static"), join(outDir, ".next", "static"), { recursive: true });
cpSync(join(root, "public"), join(outDir, "public"), { recursive: true, filter: skipSecrets });

// 실행 파일: 윈도(start.bat)와 맥·리눅스(start.sh). 같은 망의 다른 PC에서도 접속되도록 0.0.0.0에서 받는다.
writeFileSync(
  join(outDir, "start.bat"),
  [
    "@echo off",
    "chcp 65001 >nul",
    "cd /d %~dp0",
    "where node >nul 2>nul || (echo Node.js 20 이상이 필요합니다. 설치 후 다시 실행하세요. & pause & exit /b 1)",
    "if \"%PORT%\"==\"\" set PORT=3000",
    "if \"%HOSTNAME%\"==\"\" set HOSTNAME=0.0.0.0",
    "echo 스마트 브릿지를 시작합니다: http://localhost:%PORT%  (끄려면 이 창을 닫으세요)",
    "node server.js",
    "pause",
    "",
  ].join("\r\n"),
);
writeFileSync(
  join(outDir, "start.sh"),
  [
    "#!/usr/bin/env bash",
    "cd \"$(dirname \"$0\")\"",
    "command -v node >/dev/null || { echo 'Node.js 20 이상이 필요합니다'; exit 1; }",
    "export PORT=\"${PORT:-3000}\" HOSTNAME=\"${HOSTNAME:-0.0.0.0}\"",
    "echo \"스마트 브릿지를 시작합니다: http://localhost:$PORT\"",
    "exec node server.js",
    "",
  ].join("\n"),
  { mode: 0o755 },
);

writeFileSync(
  join(outDir, "폐쇄망_설치_안내.md"),
  `# 스마트 브릿지 — 폐쇄망 설치 안내

인터넷이 없는 망에서 그대로 쓰는 묶음입니다. 화면·엑셀 처리·코드 실행이 모두 이 묶음과 사용자 PC 브라우저 안에서만 일어나며, 외부 사이트(웹 글꼴·CDN·API)를 부르지 않습니다.

## 준비물
- 서버로 쓸 PC 한 대에 **Node.js 20 이상** (\`node -v\`로 확인). \`npm install\`과 인터넷은 필요 없습니다.

## 실행
- 윈도: \`start.bat\` 더블클릭
- 맥·리눅스: \`./start.sh\`
- 접속: 같은 PC는 \`http://localhost:3000\`, 같은 망의 다른 PC는 \`http://서버IP:3000\`
- 포트를 바꾸려면 \`PORT=8080\`을 먼저 지정하고 실행합니다. 방화벽에서 해당 포트(TCP) 허용이 필요할 수 있습니다.

## 꼭 알아 둘 것
- **복사 버튼과 HTTPS:** 브라우저는 \`http://서버IP\`(보안 연결이 아닌 주소)에서 "클립보드 복사" 기능을 막습니다. 이 경우 프롬프트 칸의 글자를 직접 선택해 복사하라는 안내가 뜹니다(기능은 그대로 사용 가능). 복사 버튼까지 쓰려면 사내 HTTPS(리버스 프록시: nginx·IIS 등)를 앞에 두거나 서버 PC에서 \`localhost\`로 접속하세요.
- **보안 헤더:** 외부 통신 차단 정책(CSP)과 보안 헤더는 이 서버(\`server.js\`)가 붙입니다. 앞에 프록시를 둘 때 응답 헤더를 지우지 않도록 하세요.
- **데이터:** 엑셀은 접속한 PC의 브라우저 안에서만 처리되고 서버로 전송·저장되지 않습니다. 서버에는 로그 외에 데이터가 남지 않습니다.
- **결과 파일:** 결과 엑셀은 가리지 않은 원본 데이터를 담습니다. 원본과 같은 수준으로 다루세요.
- **시연:** 처음에는 앱의 [더미 엑셀 생성] 버튼으로 가짜 데이터를 만들어 확인하세요.

## 갱신
새 버전은 인터넷이 되는 PC에서 \`npm run pack:offline\`으로 다시 묶어 이 폴더를 교체합니다.
`,
);

console.log(`묶음 완료: ${outDir}`);
console.log("포함:", readdirSync(outDir).join(", "));

// zip은 있으면 만든다 (맥·리눅스). 없으면 폴더째 옮기면 된다.
try {
  execFileSync("zip", ["-rq", "smart-bridge-offline.zip", "smart-bridge-offline"], { cwd: outRoot });
  console.log(`압축 파일: ${join(outRoot, "smart-bridge-offline.zip")}`);
} catch {
  console.log("zip 명령이 없어 압축은 건너뜁니다. 폴더째 옮기세요.");
}
