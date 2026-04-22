"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function OrtopediaPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/ortopedia/gestion");
  }, [router]);

  return null;
}

