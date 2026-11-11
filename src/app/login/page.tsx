import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { auth, signIn } from "@/auth";
import { getEnv } from "@/lib/env";
import { Avatar } from "@/components/Avatar";

export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await auth();
  if (session?.user?.id) redirect("/");
  const env = getEnv();
  const { error } = await searchParams;

  async function google() {
    "use server";
    await signIn("google", { redirectTo: "/" });
  }
  async function dev(form: FormData) {
    "use server";
    if (!getEnv().devLogin) return;
    try {
      await signIn("dev", { name: String(form.get("name") ?? "").slice(0, 40), redirectTo: "/" });
    } catch (e) {
      if (e instanceof AuthError) redirect("/login?error=dev");
      throw e;
    }
  }

  return (
    <main className="safe-top safe-bottom mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-6 text-center">
      <Avatar mood="smug" size={140} />
      <h1 className="mt-6 font-serif text-4xl">Mawa AI</h1>
      <p className="mt-2 text-sm text-white/55">Smart answers. Questionable manners.</p>
      {error ? <p className="mt-4 t-btn border border-roast/40 bg-roast/10 px-3 py-2 text-sm text-orange-200">{error === "AccessDenied" ? "This app is invite-only. Ask Mani to add your email." : "Couldn't sign you in. Try again."}</p> : null}

      {env.google ? (
        <form action={google} className="mt-8 w-full">
          <button className="flex w-full items-center justify-center gap-3 t-chip bg-white py-3.5 font-medium text-black active:scale-[0.98]">
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
            Continue with Google
          </button>
        </form>
      ) : (
        <p className="mt-8 text-xs text-white/40">Google sign-in isn&apos;t set up yet (needs AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET).</p>
      )}

      {env.devLogin ? (
        <form action={dev} className="mt-6 w-full t-chip border border-dashed border-gold/50 bg-gold/5 p-4 text-left">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gold">Local dev mode · not available in production</p>
          <label className="mt-3 block text-xs text-white/60" htmlFor="name">Your name</label>
          <input id="name" name="name" required maxLength={40} defaultValue="Mani" className="mt-1 w-full t-btn border border-white/10 bg-black/40 px-3 py-2.5 text-[16px] outline-none focus:border-gold/60" />
          <button className="mt-3 w-full t-btn border border-gold/50 py-2.5 text-sm text-gold active:scale-[0.98]">Dev login</button>
        </form>
      ) : null}
    </main>
  );
}
