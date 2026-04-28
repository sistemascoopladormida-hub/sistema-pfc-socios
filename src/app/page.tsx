import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default function Home() {
  const role = cookies().get("rol")?.value;
  if (role === "ortopedia_admin") {
    redirect("/ortopedia");
  }
  if (role === "admin" || role === "admin_vanesa" || role === "developer" || role === "directivo") {
    redirect("/dashboard");
  }
  redirect("/login");
}
