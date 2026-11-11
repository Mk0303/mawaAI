/** Renders model text safely: plain text + fenced code blocks. No HTML injection. */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/```/);
  return (
    <>
      {parts.map((p, i) => {
        if (i % 2 === 1) {
          const nl = p.indexOf("\n");
          const code = nl >= 0 ? p.slice(nl + 1) : p;
          return (
            <pre key={i} className="my-2 overflow-x-auto rounded-xl border border-line bg-black/50 p-3 font-mono text-[12.5px] leading-relaxed text-cyan-100">
              <code>{code.replace(/\n$/, "")}</code>
            </pre>
          );
        }
        return <span key={i} className="whitespace-pre-wrap">{p.replace(/\*\*(.+?)\*\*/g, "$1")}</span>;
      })}
    </>
  );
}
