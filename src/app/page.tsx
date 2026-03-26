import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default function Home() {
  const role = cookies().get("rol")?.value;
  if (role === "admin" || role === "directivo") {
    redirect("/dashboard");
  }
  redirect("/login");
}
