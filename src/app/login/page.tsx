"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { Lock, LogIn, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useUser } from "@/lib/user-context";
import { ROLE_PASSWORDS, ROLE_USERS, ROLES } from "@/lib/roles";
import type { UserRole } from "@/types/roles";

type LoginRole = UserRole;

export default function LoginPage() {
  const { setRole: setUserRole } = useUser();
  const router = useRouter();
  const [role, setRole] = useState<LoginRole>(ROLES.ADMIN);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin() {
    const expected = ROLE_PASSWORDS[role];
    if (password !== expected) {
      toast.error("Contraseña incorrecta");
      return;
    }

    try {
      setSubmitting(true);
      const usuario = ROLE_USERS[role];
      localStorage.setItem("rol", role);
      localStorage.setItem("usuario", usuario);
      document.cookie = `rol=${role}; path=/; SameSite=Lax`;
      document.cookie = `usuario=${encodeURIComponent(usuario)}; path=/; SameSite=Lax`;
      setUserRole(role);
      window.dispatchEvent(new Event("roles:changed"));
      toast.success(`Bienvenido/a ${usuario}`);
      router.replace(role === ROLES.ORTOPEDIA_ADMIN ? "/ortopedia" : "/dashboard");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-pfc-50 to-pfc-100 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <Card className="rounded-2xl shadow-xl backdrop-blur bg-white/90">
          <CardContent className="space-y-6 p-8">

            {/* Logo + Title */}
            <div className="flex flex-col items-center text-center space-y-2">
              <Image
                src="/logocooptransparente.png"
                alt="Cooperativa"
                width={80}
                height={80}
                priority
                className="drop-shadow-md"
              />
              <h1 className="text-2xl font-semibold text-pfcText-primary">
                Sistema PFC
              </h1>
              <p className="text-sm text-pfcText-secondary">
                Acceso al sistema interno
              </p>
            </div>

            {/* Role Selector */}
            <div className="space-y-1">
              <label className="text-sm text-pfcText-secondary">Rol</label>
              <div className="relative">
                <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <select
                  className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-3 text-sm shadow-sm focus:border-pfc-500 focus:ring-2 focus:ring-pfc-200 outline-none"
                  value={role}
                  onChange={(event) => setRole(event.target.value as LoginRole)}
                >
                  <option value={ROLES.ADMIN}>Marianela Farias (Administrador)</option>
                  <option value={ROLES.ADMIN_VANESA}>Vanesa Caminos (Administradora)</option>
                  <option value={ROLES.ORTOPEDIA_ADMIN}>Guadalupe Saavedra (Ortopedia)</option>
                </select>
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1">
              <label className="text-sm text-pfcText-secondary">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void handleLogin();
                  }}
                  className="h-11 pl-10 rounded-xl border-gray-200 focus:ring-2 focus:ring-pfc-200"
                  placeholder="Ingresa tu contraseña"
                />
              </div>
            </div>

            {/* Button */}
            <Button
              className="h-11 w-full rounded-xl bg-pfc-600 text-white hover:bg-pfc-700 transition-all duration-200 shadow-md"
              onClick={() => void handleLogin()}
              disabled={submitting}
            >
              <LogIn className="mr-2 h-4 w-4" />
              {submitting ? "Ingresando..." : "Ingresar"}
            </Button>

            {/* Extra UX */}
            <p className="text-xs text-center text-gray-400">
              Acceso restringido · Cooperativa
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}