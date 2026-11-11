import "server-only";
import { extractText, getDocumentProxy } from "unpdf";

export const PDF_LIMITS = { maxBytes: 20 * 1024 * 1024, maxPages: 300, maxChars: 1_500_000 } as const;

export function isPdf(buf: Buffer) { return buf.subarray(0, 5).toString("ascii") === "%PDF-"; }

export class PdfError extends Error { constructor(public friendly: string) { super("pdf_error"); } }

/** Extract plain text (no JS execution, no rendering). */
export async function extractPdf(buf: Buffer): Promise<{ text: string; pages: number }> {
  if (!isPdf(buf)) throw new PdfError("That doesn't look like a PDF.");
  let doc;
  try {
    doc = await getDocumentProxy(new Uint8Array(buf), { isEvalSupported: false, disableFontFace: true, useSystemFonts: false } as Parameters<typeof getDocumentProxy>[1]);
  } catch {
    throw new PdfError("I couldn't open that PDF. Is it password-protected or damaged?");
  }
  if (doc.numPages > PDF_LIMITS.maxPages) throw new PdfError(`That PDF has ${doc.numPages} pages. I can handle up to ${PDF_LIMITS.maxPages} for now.`);
  const { text } = await extractText(doc, { mergePages: false });
  const pages = (text as string[]).map((t, i) => `[Page ${i + 1}]\n${t.replace(/[ \t]+/g, " ").trim()}`);
  const joined = pages.join("\n\n").slice(0, PDF_LIMITS.maxChars);
  if (joined.replace(/\[Page \d+\]/g, "").trim().length < 20) throw new PdfError("That PDF has no readable text (maybe it's scanned images). Send a photo of the page instead.");
  return { text: joined, pages: doc.numPages };
}
