// Design Ref: §5 코드 정리 — 사내 AI 답변에서 ```javascript 표시와 설명 문장을 걷어내고 코드만 남긴다.
// 규칙: ``` 로 감싼 블록이 있으면 첫 블록 안쪽만, 없으면 전체를 코드로 본다.

export type CleanResult = {
  code: string; // 정리된 코드
  extracted: boolean; // ``` 블록을 찾아 그 안쪽만 꺼냈는지 (앞뒤 표시·설명을 지웠는지)
};

// 줄바꿈이 있는 일반 형태:  ```javascript\n코드\n```   (언어 이름은 있어도 없어도 된다)
const FENCED_BLOCK = /```[^\n`]*\n([\s\S]*?)```/;
// AI 답변이 중간에 끊겨 닫는 ```가 없는 경우:  ```javascript\n코드...
const UNCLOSED_BLOCK = /```[^\n`]*\n([\s\S]*)$/;
// 한 줄로 붙은 경우:  ```const a = 1;```
const INLINE_BLOCK = /```(?:javascript|js)?[ \t]*([^\n`][\s\S]*?)```/i;

export function cleanCode(input: string): CleanResult {
  const text = input.replace(/\r\n?/g, "\n");

  const match = FENCED_BLOCK.exec(text) ?? UNCLOSED_BLOCK.exec(text) ?? INLINE_BLOCK.exec(text);
  if (match) return { code: match[1].trim(), extracted: true };

  // ``` 블록이 없으면 설명 문장을 가려낼 방법이 없으므로 그대로 둔다 (실행 시 문법 오류로 알려 준다)
  return { code: text.trim(), extracted: false };
}
