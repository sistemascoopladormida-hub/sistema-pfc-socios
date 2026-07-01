"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { ROLES } from "@/lib/roles";
import { useUser } from "@/lib/user-context";

export default function OrtopediaPage() {
  const router = useRouter();
  const { role } = useUser();

  useEffect(() => {
    router.replace(role === ROLES.ORTOPEDIA_ADMIN ? "/ortopedia/dashboard" : "/ortopedia/gestion");
  }, [router, role]);

  return null;
}
