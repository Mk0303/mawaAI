import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { MawaApp } from "@/components/MawaApp";
import { getEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return <MawaApp userName={session.user.name ?? "mawa"} devMode={getEnv().devLogin} />;
}
