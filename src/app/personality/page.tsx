import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PersonalityScreen } from "@/components/PersonalityScreen";

export const dynamic = "force-dynamic";
export default async function Page() {
  const s = await auth();
  if (!s?.user?.id) redirect("/login");
  return <PersonalityScreen />;
}
