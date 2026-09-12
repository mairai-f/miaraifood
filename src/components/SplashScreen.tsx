import { motion } from "framer-motion";
import { miarLogoWhite } from '@/lib/brandAssets';

export function SplashScreen() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0f1115]">
      {/* Background Orbs and Trails */}
      <div className="absolute inset-0 z-0">
        <motion.div
          className="absolute left-[-10%] top-[20%] h-96 w-96 rounded-full bg-cyan-600/10 blur-[100px]"
          animate={{ x: [0, 50, 0], y: [0, 30, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-[-10%] right-[-10%] h-[30rem] w-[30rem] rounded-full bg-blue-600/10 blur-[120px]"
          animate={{ x: [0, -60, 0], y: [0, -40, 0], scale: [1, 1.15, 1] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        />
        
        {/* Animated glowing grid/lines effect */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
      </div>

      <motion.div
        className="relative z-10 w-full max-w-sm text-center"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <div className="relative mx-auto flex flex-col items-center justify-center rounded-[2.5rem] border border-white/5 bg-white/[0.02] p-10 shadow-[0_0_80px_rgba(0,150,255,0.08)] backdrop-blur-3xl">
          {/* Subtle central glow behind logo */}
          <motion.div 
            className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/20 blur-[50px]"
            animate={{ opacity: [0.5, 0.8, 0.5], scale: [0.9, 1.1, 0.9] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />
          
          <img
            src={miarLogoWhite}
            alt="MIAR AI/FOOD Logo"
            className="relative z-10 h-28 w-auto max-w-[15rem] object-contain drop-shadow-[0_0_15px_rgba(0,200,255,0.3)]"
          />
          
          <h1 className="relative z-10 mt-6 text-3xl font-extrabold tracking-tight text-white">
            MIAR AI/FOOD
          </h1>
          <p className="relative z-10 mt-2 text-sm font-medium tracking-wide text-cyan-100/60">
            Da mesa à entrega, toda a operação conectada.
          </p>

          {/* Scanner Line Indicator */}
          <div className="relative mt-12 h-[2px] w-full overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="absolute inset-y-0 left-[-30%] w-[30%] rounded-full bg-[linear-gradient(90deg,transparent,rgba(0,255,255,0.8),rgba(0,150,255,1),rgba(0,255,255,0.8),transparent)] shadow-[0_0_10px_rgba(0,255,255,0.8)]"
              animate={{ x: ["0%", "500%"] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
