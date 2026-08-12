"use client";
import { motion } from 'framer-motion';
import { FaInstagram, FaFacebook, FaWhatsapp } from "react-icons/fa";
import { portfolioData } from "@/data/portfolio";
import { cn } from "@/lib/utils";
import { Bot } from "lucide-react";

interface SocialCornerProps {
    className?: string;
    delay?: number;
}

const iconMap: Record<string, any> = {
    instagram: FaInstagram,
    facebook: FaFacebook,
    whatsapp: FaWhatsapp,
};

export const SocialCorner = ({ className, delay = 0.5 }: SocialCornerProps) => {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay }}
            className={cn("hidden md:flex flex-col items-center gap-6", className)}
        >
            <div className="flex flex-col items-center gap-6">
                {portfolioData.personal.socialLinks.map((social) => {
                    const Icon = iconMap[social.icon] || FaWhatsapp;
                    return (
                        <a 
                            key={social.platform}
                            href={social.url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="p-3 rounded-full bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 transition-all hover:scale-110 group"
                            aria-label={social.platform}
                        >
                            <Icon className="w-5 h-5 text-foreground/60 group-hover:text-foreground" />
                        </a>
                    );
                })}

                <motion.button
                    onClick={() => window.dispatchEvent(new CustomEvent('portfolio:toggle-chatbot'))}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    className="p-3 rounded-full bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 transition-all hover:scale-110 group relative"
                    aria-label="Open AI Assistant"
                >
                    <Bot className="w-5 h-5 text-foreground/60 group-hover:text-foreground" />
                </motion.button>
            </div>
            <div className="w-px h-32 md:h-48 bg-foreground/10" />
        </motion.div>
    );
};
