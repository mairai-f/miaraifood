import { motion } from "framer-motion";

import happyCashLogo from "@/assets/happycash-logo.png";
import { Progress } from "@/components/ui/progress";

interface SplashScreenProps {
  progress: number;
}

export function SplashScreen({ progress }: SplashScreenProps) {
  const safeProgress = Math.max(0, Math.min(progress, 100));

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
      </motion.div>
    </div>
  );
}
