// Design Ref: §6.3 — Worker가 읽을 exceljs 브라우저용 파일을 public/vendor/로 복사한다.
// npm run dev / build 직전에 자동으로 돌아서, 항상 설치된 exceljs 버전과 같은 파일이 쓰인다.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "node_modules/exceljs/dist/exceljs.min.js");
const targetDir = resolve(root, "public/vendor");

if (!existsSync(source)) {
  console.error("exceljs가 설치되어 있지 않습니다. 먼저 npm install을 실행하세요.");
  process.exit(1);
}

mkdirSync(targetDir, { recursive: true });
copyFileSync(source, resolve(targetDir, "exceljs.min.js"));
console.log("복사 완료: public/vendor/exceljs.min.js");
