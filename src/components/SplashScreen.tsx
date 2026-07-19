import { useEffect, useState } from "react";
import { motion } from "framer-motion";

import happyCashLogo from "@/assets/login/happycash.webp";
import { Progress } from "@/components/ui/progress";
import type { DesktopUpdateSplashSummary } from "@/lib/desktopUpdateSplash";
import { cn } from "@/lib/utils";

interface SplashScreenProps {
  progress: number;
  updateStatus?: DesktopUpdateSplashSummary | null;
}

const resolveStartupStatus = (progress: number) => {
  if (progress < 28) {
    return {
      eyebrow: "Iniciando",
      label: "Preparando o ambiente do HappyCash",
      detail: "Organizando interface, recursos principais e contexto inicial do sistema.",
    };
  }

  if (progress < 56) {
    return {
      eyebrow: "Validando acesso",
      label: "Conferindo sessão, licença e permissões",
      detail: "Verificando os pontos essenciais para abrir o sistema com segurança.",
    };
  }

  if (progress < 84) {
    return {
      eyebrow: "Preparando dados",
      label: "Ajustando recursos locais e suporte offline",
      detail: "Deixando o sistema pronto para continuar rápido e estável durante a operação.",
    };
  }

  return {
    eyebrow: "Carregando sistema",
    label: "Finalizando os últimos ajustes do HappyCash",
    detail: "Tudo quase pronto para abrir sua operação.",
  };
};

export function SplashScreen({
  progress,
  updateStatus = null,
}: SplashScreenProps) {
  const [ellipsisFrame, setEllipsisFrame] = useState(0);
  const safeProgress = Math.max(0, Math.min(progress, 100));
  const safeUpdateProgress = updateStatus?.progress == null
    ? null
    : Math.max(0, Math.min(updateStatus.progress, 100));
  const isPrimaryUpdateMode = Boolean(updateStatus?.primary);
  const displayProgress = isPrimaryUpdateMode
    ? safeUpdateProgress ?? 0
    : safeProgress;
  const startupStatus = resolveStartupStatus(displayProgress);
  const activeEyebrow = isPrimaryUpdateMode
    ? "Atualizando"
    : updateStatus?.label
      ? "Preparando ambiente"
      : startupStatus.eyebrow;
  const activeLabel = updateStatus?.label ?? startupStatus.label;
  const activeDetail = updateStatus?.detail ?? startupStatus.detail;
  const activeTone = updateStatus?.tone ?? "default";
  const ellipsis = updateStatus?.animateEllipsis
    ? ".".repeat((ellipsisFrame % 3) + 1)
    : "";

  useEffect(() => {
    if (!updateStatus?.animateEllipsis) {
      setEllipsisFrame(0);
      return;
    }

    const timerId = window.setInterval(() => {
      setEllipsisFrame((current) => (current + 1) % 3);
    }, 420);

    return () => window.clearInterval(timerId);
  }, [updateStatus?.animateEllipsis]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[linear-gradient(180deg,#5e79ff_0%,#5571f4_48%,#4d69e8_100%)] px-5 py-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.18),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(23,37,84,0.18),_transparent_40%)]" />
      <motion.div
        className="absolute left-[14%] top-[16%] h-72 w-72 rounded-full bg-white/14 blur-3xl"
        animate={{ x: [0, 28, 0], y: [0, 18, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[12%] right-[8%] h-80 w-80 rounded-full bg-[#183b8c]/24 blur-3xl"
        animate={{ x: [0, -22, 0], y: [0, -18, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute left-1/2 top-1/2 h-[30rem] w-[30rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/8 blur-[130px]"
        animate={{ opacity: [0.42, 0.68, 0.42], scale: [0.95, 1.04, 0.95] }}
        transition={{ duration: 7.5, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        className="relative z-10 w-full max-w-3xl text-center"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <motion.div
          className="relative mx-auto w-fit"
          animate={{ y: [0, -14, 0] }}
          transition={{ duration: 4.6, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="absolute inset-x-[8%] top-[48%] h-14 -translate-y-1/2 rounded-full bg-white/12 blur-2xl" />
          <img
            src={happyCashLogo}
            alt="HappyCash"
            className="relative mx-auto h-auto w-full max-w-[20rem] object-contain sm:max-w-[25rem] lg:max-w-[30rem]"
            loading="eager"
            fetchpriority="high"
            decoding="async"
          />
        </motion.div>

        <motion.p
          className="mx-auto mt-5 max-w-[23rem] text-[1.1rem] font-semibold leading-snug tracking-[-0.03em] text-white/92 sm:max-w-[28rem] sm:text-[1.45rem] lg:max-w-[34rem] lg:text-[1.85rem]"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.14 }}
        >
          Tecnologia simples para sua empresa.
        </motion.p>

        <motion.div
          className="mx-auto mt-10 w-full max-w-2xl rounded-[30px] border border-white/22 bg-white/10 p-5 shadow-[0_24px_80px_rgba(21,41,113,0.22)] backdrop-blur-2xl sm:p-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.28 }}
        >
          <div className="flex items-center justify-between gap-4">
            <span
              className={cn(
                "inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.26em] sm:text-xs",
                activeTone === "error" && "border-red-200/35 bg-red-500/10 text-red-50",
                activeTone === "warning" && "border-amber-100/30 bg-amber-200/12 text-amber-50",
                activeTone === "default" && "border-white/25 bg-white/12 text-white/88",
              )}
            >
              {activeEyebrow}
            </span>
            <span className="text-sm font-semibold text-white/88 sm:text-[15px]">
              {Math.round(displayProgress)}%
            </span>
          </div>

          <h2 className="mt-4 text-left text-[1.3rem] font-bold leading-tight tracking-[-0.04em] text-white sm:text-[1.6rem]">
            {activeLabel}
            {ellipsis}
          </h2>
          <p className="mt-2 text-left text-sm leading-6 text-white/76 sm:text-[15px]">
            {activeDetail}
          </p>

          <div className="relative mt-5 overflow-hidden rounded-full">
            <motion.div
              className="pointer-events-none absolute inset-y-0 left-[-20%] z-10 w-24 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.65),transparent)] opacity-70 blur-md"
              animate={{ x: ["0%", "520%"] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
            />
          <Progress
            value={displayProgress}
              className="h-2.5 bg-white/16 [&>div]:bg-[linear-gradient(90deg,#dbeafe_0%,#60a5fa_28%,#2563eb_68%,#1d4ed8_100%)]"
          />
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 text-[11px] font-medium text-white/60 sm:text-xs">
            <span>HappyCash Desktop</span>
            <span>Abertura segura e preparada para offline</span>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
