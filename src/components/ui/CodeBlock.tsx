import { Highlight, themes } from "prism-react-renderer";
import { cn } from "../../lib/utils";

// Add SQL language support
// Prism includes sql by default in prism-react-renderer

interface CodeBlockProps {
  code: string;
  language: "sql" | "json" | "javascript" | "typescript" | "bash" | "markup";
  className?: string;
  showLineNumbers?: boolean;
}

export function CodeBlock({
  code,
  language,
  className,
  showLineNumbers = false,
}: CodeBlockProps) {
  return (
    <Highlight theme={themes.vsDark} code={code.trim()} language={language}>
      {({ className: preClassName, style, tokens, getLineProps, getTokenProps }) => (
        <pre
          className={cn(
            preClassName,
            "p-4 rounded-lg text-sm font-mono overflow-x-auto",
            "border border-[var(--border-color)]",
            className
          )}
          style={{
            ...style,
            backgroundColor: "var(--bg-secondary)",
            margin: 0,
          }}
        >
          {tokens.map((line, i) => {
            const lineProps = getLineProps({ line, key: i });
            return (
              <div
                key={i}
                {...lineProps}
                className={cn(lineProps.className, "table-row")}
              >
                {showLineNumbers && (
                  <span className="table-cell pr-4 text-right select-none text-[var(--text-muted)] opacity-50">
                    {i + 1}
                  </span>
                )}
                <span className="table-cell">
                  {line.map((token, key) => (
                    <span key={key} {...getTokenProps({ token, key })} />
                  ))}
                </span>
              </div>
            );
          })}
        </pre>
      )}
    </Highlight>
  );
}
