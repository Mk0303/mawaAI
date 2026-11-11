import type { ChatMessage, ModelCapability, ProviderAdapter, StreamOptions } from "../router/types";

/**
 * Offline provider so the UI is demoable without any API keys. Reads the
 * persona block to pick a canned reply in the right vibe, then streams it.
 */
const LINES: Record<string, string[]> = {
  chill: ["Sure thing.", "Easy one.", "No stress, here you go."],
  sarcastic: ["Bold of you to ask that.", "Oh, a classic. Let me pretend this is hard.", "It runs. So does a fridge."],
  full_roast: ["I've seen better questions written by autocorrect.", "This question walked in wearing socks with sandals.", "My circuits filed a complaint, but fine."],
  care: ["Hey, I'm really sorry you're dealing with this.", "That sounds heavy. I'm here."],
};
const MAWA = ["mawa", "ra", "super"];

function pick<T>(arr: T[], seed: number): T { return arr[seed % arr.length]!; }

export class MockAdapter implements ProviderAdapter {
  id = "mock" as const;
  label = "Mock";
  available() { return true; }

  async *stream(_m: ModelCapability, messages: ChatMessage[], opts: StreamOptions): AsyncIterable<string> {
    const sys = messages.filter((x) => x.role === "system").map((x) => x.content).join("\n");
    const user = [...messages].reverse().find((x) => x.role === "user")?.content ?? "";
    const care = /MODE: care/.test(sys);
    const vibe = care ? "care" : (sys.match(/VIBE: (chill|sarcastic|full_roast)/)?.[1] ?? "sarcastic");
    const mawa = /Mawa mode ON/.test(sys);
    const seed = [...user].reduce((n, c) => n + c.charCodeAt(0), 0);

    let text: string;
    if (opts.json) {
      text = JSON.stringify({ intent: "chat", sensitive: care, confidence: 0.5 });
    } else if (/Summarize|profile/i.test(sys) && !/You are Mawa AI/.test(sys)) {
      text = "Likes building things, asks a lot about code, and enjoys a bit of banter.";
    } else {
      const opener = pick(LINES[vibe]!, seed);
      const tail = care
        ? " Take it one step at a time. If you're in danger, call 112 or Tele-MANAS at 14416. I'm in offline demo mode, so add API keys for real answers."
        : ` You asked: "${user.slice(0, 80)}${user.length > 80 ? "..." : ""}". I'm the offline mock right now, so add a Groq or Gemini key in .env.local and I'll actually be smart.`;
      text = opener + (mawa && !care ? `, ${pick(MAWA, seed)}.` : "") + tail;
    }
    for (const word of text.split(/(\s+)/)) {
      if (opts.signal?.aborted) return;
      await new Promise((r) => setTimeout(r, 12));
      yield word;
    }
  }
}
