"use client";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

/**
 * LLM text mixes LaTeX ($3x + 4x$) with prices ($0.40 on beans). remark-math would treat the price's
 * `$` as a math delimiter and swallow the sentence, so escape dollars that look like currency:
 * `$` + amount, followed by a word, punctuation + space, or end of line.
 */
const CURRENCY = /(^|[\s(\[{"'“—–-])\$(\d[\d,]*(?:\.\d+)?)(?=\s+[A-Za-z(]|[,.;:!?)]?(?:\s|$))/gm;
export function escapeCurrency(md: string): string {
  return md.replace(CURRENCY, (_m, pre: string, amt: string) => `${pre}\\$${amt}`);
}

export function Md({ children, className = "" }: { children: string; className?: string }) {
  return (
    <div className={`md ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: "ignore" }]]}>
        {escapeCurrency(children)}
      </ReactMarkdown>
    </div>
  );
}
