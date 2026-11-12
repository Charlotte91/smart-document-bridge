import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    // 폐쇄망 반출 묶음·휴지통 폴더에는 빌드 결과물 사본이 들어 있어 검사하지 않는다
    "offline-dist/**",
    "trash-can/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 복사해 온 외부 라이브러리(exceljs 압축본)는 우리 코드가 아니므로 검사하지 않는다
    "public/vendor/**",
  ]),
]);

export default eslintConfig;
