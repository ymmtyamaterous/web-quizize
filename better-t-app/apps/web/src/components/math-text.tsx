import { InlineMath, BlockMath } from "react-katex";

interface MathTextProps {
  text: string;
}

type TextPart =
  | { type: "text"; value: string }
  | { type: "inline"; value: string }
  | { type: "block"; value: string };

/**
 * テキスト中の TeX 数式 ($...$ / $$...$$) を KaTeX でレンダリングするコンポーネント。
 * 数式以外の部分はそのまま表示する。
 */
export function MathText({ text }: MathTextProps) {
  const parts = parseMathText(text);

  return (
    <>
      {parts.map((part, i) => {
        if (part.type === "block") {
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: static rendering
            <BlockMath key={i} math={part.value} />
          );
        }
        if (part.type === "inline") {
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: static rendering
            <InlineMath key={i} math={part.value} />
          );
        }
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: static rendering
          <span key={i}>{part.value}</span>
        );
      })}
    </>
  );
}

function parseMathText(text: string): TextPart[] {
  const parts: TextPart[] = [];
  // $$...$$ を先にマッチ（インライン $...$ より優先）
  const pattern = /(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex loop
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    const raw = match[0];
    if (raw.startsWith("$$")) {
      parts.push({ type: "block", value: raw.slice(2, -2) });
    } else {
      parts.push({ type: "inline", value: raw.slice(1, -1) });
    }
    lastIndex = match.index + raw.length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: "text", value: text.slice(lastIndex) });
  }

  return parts;
}
