"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import type { SectionProps } from "../types"

export default function Section({ id, title, subtitle, content, isActive, showButton, buttonText }: SectionProps) {
  return (
    <section id={id} className="relative h-screen w-full snap-start flex flex-col justify-center p-8 md:p-16 lg:p-24">
      <div className="flex items-center justify-between gap-12">
        <div className="flex-1">
          {subtitle && (
            <motion.div
              className="mb-12"
              initial={{ opacity: 0, y: 20 }}
              animate={isActive ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
            >
              {subtitle}
            </motion.div>
          )}
          <div className="flex items-center justify-between gap-8 max-w-5xl">
            <motion.h2
              className="text-4xl md:text-6xl lg:text-[5rem] xl:text-[6rem] font-bold leading-[1.1] tracking-tight"
              initial={{ opacity: 0, y: 50 }}
              animate={isActive ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
            >
              {title}
            </motion.h2>
            {id === 'home' && (
              <motion.img
                src="/weldfish.png"
                alt="weldfish"
                className="w-56 md:w-72 lg:w-96 h-auto flex-shrink-0"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={isActive ? { opacity: 1, scale: 1 } : {}}
                transition={{ duration: 0.5 }}
              />
            )}
          </div>
          {content && (
            typeof content === 'string' || typeof content === 'number' ? (
              <motion.p
                className="text-lg md:text-xl lg:text-2xl max-w-2xl mt-6 text-neutral-400"
                initial={{ opacity: 0, y: 50 }}
                animate={isActive ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                {content}
              </motion.p>
            ) : (
              <motion.div
                className="mt-6 w-full"
                initial={{ opacity: 0, y: 50 }}
                animate={isActive ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                {content}
              </motion.div>
            )
          )}
          {showButton && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isActive ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="mt-8"
            >
              <Button
                variant="outline"
                size="lg"
                className="text-primary bg-transparent border border-primary hover:bg-primary hover:text-foreground transition-colors"
              >
                {buttonText}
              </Button>
            </motion.div>
          )}
        </div>
      </div>
    </section>
  )
}