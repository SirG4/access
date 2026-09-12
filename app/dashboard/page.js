import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import UserDashboardClient from "./UserDashboardClient";

export const metadata = {
  title: "Dashboard — Access Supercomputer Portal",
};

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/signin");
  }

  return <UserDashboardClient session={session} />;
}
