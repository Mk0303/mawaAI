import yauzl from "yauzl";
import { IMPORT_LIMITS as L, ImportError, type ParsedExport } from "./types";
import { looksLikeChatGPT, parseChatGPT } from "./chatgpt";
import { groupGeminiPairs, looksLikeGeminiHtml, looksLikeGeminiJson, pairsFromHtml, pairsFromJson } from "./gemini";

const NOT_RECOGNISED = new ImportError(
  "unrecognised",
  "Hmm, I couldn't find any chats in that file. Upload the zip exactly as ChatGPT or Google emailed it, no changes needed.",
);

/** Files we read out of an export zip. Everything else (images, audio) is skipped unread. */
const WANTED = [
  /(^|\/)conversations(-\d{1,4})?\.json$/i,                    // ChatGPT
  /(^|\/)(Gemini Apps|Gemini|Bard)\/My ?Activity\.(html|json)$/i, // Takeout (English folder names)
  /(^|\/)My ?Activity\.(html|json)$/i,                          // Takeout (other languages), verified by content
];

function safeEntryName(name: string): boolean {
  if (name.length > 300 || name.includes("\0") || name.includes("\\")) return false;
  if (name.startsWith("/") || /^[a-z]:/i.test(name)) return false;
  return !name.split("/").some((seg) => seg === "..");
}

/** Extract only the wanted files, in memory (nothing touches disk), with zip-bomb limits. */
export function readWantedFromZip(buf: Buffer): Promise<{ name: string; data: Buffer }[]> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buf, { lazyEntries: true, validateEntrySizes: true, strictFileNames: false }, (err, zip) => {
      if (err || !zip) return reject(new ImportError("bad_zip", "That zip looks damaged. Try downloading it again from the email link."));
      const out: { name: string; data: Buffer }[] = [];
      let entries = 0;
      let total = 0;
      const fail = (e: ImportError) => { zip.close(); reject(e); };
      zip.on("error", () => fail(new ImportError("bad_zip", "That zip looks damaged. Try downloading it again from the email link.")));
      zip.on("end", () => resolve(out));
      zip.on("entry", (entry: yauzl.Entry) => {
        if (++entries > L.maxZipEntries) return fail(new ImportError("too_many_files", "That zip has way too many files in it. Is it the right export?"));
        const name = entry.fileName;
        if (/\/$/.test(name) || !WANTED.some((re) => re.test(name))) return zip.readEntry();
        if (!safeEntryName(name)) return fail(new ImportError("unsafe_zip", "That zip has something odd inside, so I skipped it for safety."));
        if (entry.uncompressedSize > L.maxEntryBytes || total + entry.uncompressedSize > L.maxTotalExtractBytes)
          return fail(new ImportError("too_big", "Your chat history is huge, mawa. Files over about 120 MB aren't supported yet."));
        if (entry.compressedSize > 0 && entry.uncompressedSize / entry.compressedSize > L.maxRatio)
          return fail(new ImportError("unsafe_zip", "That zip has something odd inside, so I skipped it for safety."));
        zip.openReadStream(entry, (e2, stream) => {
          if (e2 || !stream) return fail(new ImportError("bad_zip", "That zip looks damaged. Try downloading it again from the email link."));
          const chunks: Buffer[] = [];
          let got = 0;
          stream.on("data", (c: Buffer) => {
            got += c.length;
            if (got > L.maxEntryBytes || total + got > L.maxTotalExtractBytes) {
              stream.destroy();
              fail(new ImportError("too_big", "Your chat history is huge, mawa. Files over about 120 MB aren't supported yet."));
              return;
            }
            chunks.push(c);
          });
          stream.on("error", () => fail(new ImportError("bad_zip", "That zip looks damaged. Try downloading it again from the email link.")));
          stream.on("end", () => { total += got; out.push({ name, data: Buffer.concat(chunks) }); zip.readEntry(); });
        });
      });
      zip.readEntry();
    });
  });
}

function parseJsonSafe(text: string): unknown {
  try { return JSON.parse(text); } catch { return undefined; }
}

/** Detect ChatGPT vs Gemini from the content of one file. */
export function parseExportFile(name: string, text: string): ParsedExport | null {
  const trimmed = text.trimStart();
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    const data = parseJsonSafe(text);
    if (looksLikeChatGPT(data)) { const r = parseChatGPT(data); return { source: "chatgpt", ...r }; }
    if (looksLikeGeminiJson(data)) return { source: "gemini", conversations: groupGeminiPairs(pairsFromJson(data)), skipped: 0 };
    return null;
  }
  if (/^<(!doctype|html)/i.test(trimmed) && looksLikeGeminiHtml(text)) {
    return { source: "gemini", conversations: groupGeminiPairs(pairsFromHtml(text)), skipped: 0 };
  }
  void name;
  return null;
}

/** Entry point: accepts the export zip as-is, or the inner conversations.json / MyActivity file. */
export async function parseExport(fileName: string, buf: Buffer): Promise<ParsedExport> {
  if (buf.length === 0) throw new ImportError("empty", "That file is empty. Pick the zip from the export email.");
  if (buf.length > L.maxUploadBytes) throw new ImportError("too_big", "That file is over 200 MB, a bit much for me right now.");
  const isZip = buf[0] === 0x50 && buf[1] === 0x4b && (buf[2] === 0x03 || buf[2] === 0x05);
  const files = isZip ? await readWantedFromZip(buf) : [{ name: fileName, data: buf }];
  if (!isZip && buf.length > L.maxEntryBytes) throw new ImportError("too_big", "Your chat history is huge, mawa. Files over about 120 MB aren't supported yet.");

  const merged: ParsedExport[] = [];
  for (const f of files) {
    const r = parseExportFile(f.name, f.data.toString("utf8"));
    if (r && r.conversations.length) merged.push(r);
  }
  if (!merged.length) throw NOT_RECOGNISED;
  // One export = one source. Prefer the one with more chats if a zip somehow had both.
  merged.sort((a, b) => b.conversations.length - a.conversations.length);
  const source = merged[0]!.source;
  const same = merged.filter((m) => m.source === source);
  return {
    source,
    conversations: same.flatMap((m) => m.conversations).slice(0, L.maxConversations),
    skipped: same.reduce((n, m) => n + m.skipped, 0),
  };
}
