import { motion } from "framer-motion";

import happyCashLogo from "@/assets/happycash-logo.webp";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { DesktopUpdateSplashSummary } from "@/lib/desktopUpdateSplash";

interface SplashScreenProps {
  progress: number;
  updateStatus?: DesktopUpdateSplashSummary | null;
  updateActionLabel?: string | null;
  onUpdateAction?: (() => void) | null;
  updateActionDisabled?: boolean;
}

const splashToneClasses: Record<NonNullable<SplashScreenProps["updateStatus"]>["tone"], string> = {
  default: "border-yellow-400/15 bg-white/5 text-yellow-50",
  warning: "border-amber-300/20 bg-amber-200/10 text-amber-50",
  error: "border-red-300/20 bg-red-200/10 text-red-50",
};

export function SplashScreen({
  progress,
  updateStatus = null,
  updateActionLabel = null,
  onUpdateAction = null,
  updateActionDisabled = false,
}: SplashScreenProps) {
  const safeProgress = Math.max(0, Math.min(progress, 100));
  const safeUpdateProgress = updateStatus?.progress == null
    ? null
    : Math.max(0, Math.min(updateStatus.progress, 100));

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050505] px-5 py-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(250,204,21,0.24),_transparent_38%),radial-gradient(circle_at_bottom,_rgba(245,158,11,0.18),_transparent_42%)]" />
      <motion.div
        className="absolute left-1/2 top-1/2 h-64 w-64 rounded-full bg-yellow-400/10 blur-3xl"
        animate={{ x: ["-55%", "-48%", "-55%"], y: ["-56%", "-45%", "-56%"] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        className="relative z-10 w-full max-w-md text-center"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        <motion.div
          animate={{ y: [0, -14, 0] }}
          transition={{ duration: 4.6, repeat: Infinity, ease: "easeInOut" }}
        >
          <img
            src={happyCashLogo}
            alt="HappyCash"
            className="mx-auto h-auto w-full max-w-[300px] object-contain sm:max-w-[340px]"
            width={768}
            height={512}
            loading="eager"
            fetchpriority="high"
            decoding="async"
          />
        </motion.div>

        <motion.p
          className="mt-4 text-xs font-semibold uppercase tracking-[0.38em] text-yellow-200/85 sm:text-sm"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          Sistema PDV • Vendas • Controle • Gestão
        </motion.p>

        <motion.div
          className="mt-9 rounded-[28px] border border-yellow-400/15 bg-white/5 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-md"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.28 }}
        >
          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.32em] text-yellow-100/70 sm:text-xs">
            <span>Carregando</span>
            <span>{Math.round(safeProgress)}%</span>
          </div>
          <Progress
            value={safeProgress}
            className="mt-3 h-2.5 bg-white/10 [&>div]:bg-gradient-to-r [&>div]:from-[#facc15] [&>div]:via-[#f59e0b] [&>div]:to-[#fde68a]"
          />
        </motion.div>

        {updateStatus && (
          <motion.div
            className={`mt-4 rounded-[24px] border p-4 text-left shadow-[0_18px_60px_rgba(0,0,0,0.28)] backdrop-blur-md ${splashToneClasses[updateStatus.tone]}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.34 }}
          >
            <div className="flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-current/75 sm:text-xs">
              <span>Atualização do desktop</span>
              {safeUpdateProgress != null && <span>{Math.round(safeUpdateProgress)}%</span>}
            </div>
            <p className="mt-3 text-sm font-semibold text-current sm:text-[15px]">
              {updateStatus.label}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-current/80 sm:text-sm">
              {updateStatus.detail}
            </p>
            {safeUpdateProgress != null && (
              <Progress
                value={safeUpdateProgress}
                className="mt-3 h-2 bg-white/10 [&>div]:bg-gradient-to-r [&>div]:from-[#facc15] [&>div]:via-[#f59e0b] [&>div]:to-[#fde68a]"
              />
            )}
            {updateActionLabel && onUpdateAction && (
              <Button
                type="button"
                onClick={onUpdateAction}
                disabled={updateActionDisabled}
                className="mt-4 h-11 w-full bg-yellow-300 text-zinc-950 hover:bg-yellow-200 disabled:bg-yellow-300/70 disabled:text-zinc-950/70"
              >
                {updateActionLabel}
              </Button>
            )}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
