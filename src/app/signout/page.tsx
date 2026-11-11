import { signOut } from "@/auth";

export default function SignOut() {
  async function out() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-6 text-center">
      <h1 className="font-serif text-3xl">Leaving already?</h1>
      <p className="mt-2 text-sm text-white/55">I&apos;ll pretend I&apos;m not hurt.</p>
      <form action={out} className="mt-8 w-full"><button className="w-full t-chip border border-white/15 py-3">Sign out</button></form>
    </main>
  );
}
