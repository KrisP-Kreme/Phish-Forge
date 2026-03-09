// components/ui/animated-nav-framer.tsx
"use client";

import * as React from "react";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";

export interface NavItem {
  id: string;
  label: string;
}

interface AnimatedNavFramerProps {
  navItems: NavItem[];
  activeSection: number;
  onNavClick: (index: number) => void;
}

const EXPAND_SCROLL_THRESHOLD = 80;

const containerVariants = {
  expanded: {
    y: 0,
    opacity: 1,
    width: "auto",
    transition: {
      y: { type: "spring" as const, damping: 18, stiffness: 250 },
      opacity: { duration: 0.3 },
      type: "spring" as const,
      damping: 20,
      stiffness: 300,
      staggerChildren: 0.07,
      delayChildren: 0.2,
    },
  },
  collapsed: {
    y: 0,
    opacity: 1,
    width: "3rem",
    transition: {
      type: "spring" as const,
      damping: 20,
      stiffness: 300,
      when: "afterChildren" as const,
      staggerChildren: 0.05,
      staggerDirection: -1,
    },
  },
};

const logoVariants = {
  expanded: { opacity: 1, x: 0, rotate: 0, transition: { type: "spring" as const, damping: 15 } },
  collapsed: { opacity: 0, x: -25, rotate: -180, transition: { duration: 0.3 } },
};

const itemVariants = {
  expanded: { opacity: 1, x: 0, scale: 1, transition: { type: "spring" as const, damping: 15 } },
  collapsed: { opacity: 0, x: -20, scale: 0.95, transition: { duration: 0.2 } },
};

const collapsedIconVariants = {
    expanded: { opacity: 0, scale: 0.8, transition: { duration: 0.2 } },
    collapsed: { 
      opacity: 1, 
      scale: 1,
      transition: {
        type: "spring" as const,
        damping: 15,
        stiffness: 300,
        delay: 0.15,
      }
    },
}

export function AnimatedNavFramer({ navItems, activeSection, onNavClick }: AnimatedNavFramerProps) {
  const [isExpanded, setExpanded] = React.useState(true);
  
  const { scrollY } = useScroll();
  const lastScrollY = React.useRef(0);
  const scrollPositionOnCollapse = React.useRef(0);

  useMotionValueEvent(scrollY, "change", (latest) => {
    const previous = lastScrollY.current;
    
    if (isExpanded && latest > previous && latest > 150) {
      setExpanded(false);
      scrollPositionOnCollapse.current = latest; 
    } 
    else if (!isExpanded && latest < previous && (scrollPositionOnCollapse.current - latest > EXPAND_SCROLL_THRESHOLD)) {
      setExpanded(true);
    }
    
    lastScrollY.current = latest;
  });

  const handleContainerClick = (e: React.MouseEvent) => {
    if (!isExpanded) {
      e.preventDefault();
      setExpanded(true);
    }
  };

  const handleLogoClick = () => {
    onNavClick(0);
  };


  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50">
      <motion.nav
        initial={{ y: -80, opacity: 0 }}
        animate={isExpanded ? "expanded" : "collapsed"}
        variants={containerVariants}
        whileHover={!isExpanded ? { scale: 1.1 } : {}}
        whileTap={!isExpanded ? { scale: 0.95 } : {}}
        onClick={handleContainerClick}
        className={cn(
          "flex items-center overflow-hidden rounded-full border bg-background/80 shadow-lg backdrop-blur-sm h-12",
          !isExpanded && "cursor-pointer justify-center"
        )}
        style={{ 
          borderColor: 'hsl(var(--border))' 
        }}
      >
        <motion.button
          variants={logoVariants}
          onClick={(e) => {
            e.stopPropagation();
            handleLogoClick();
          }}
          className="flex-shrink-0 flex items-center font-semibold pl-3 pr-2 gap-2 hover:opacity-80 transition-opacity"
        >
          <Image 
            src="/phishforgelogot.png" 
            alt="PhishForge Logo"
            width={24}
            height={24}
            className="h-6 w-6 object-contain"
          />
          <span className="text-sm font-bold whitespace-nowrap" style={{ color: 'hsl(var(--foreground))' }}>
            phishforge.
          </span>
        </motion.button>
        
        <motion.div
          className={cn(
            "flex items-center gap-3 sm:gap-4.5 md:gap-6 pr-5",
            !isExpanded && "pointer-events-none"
          )}
        >
          {navItems.map((item, index) => (
            <motion.button
              key={item.id}
              variants={itemVariants}
              onClick={(e) => {
                e.stopPropagation();
                onNavClick(index);
              }}
              className="text-xs sm:text-sm font-medium transition-all hover:scale-105 px-3 py-1 whitespace-nowrap"
              style={{ 
                color: index === activeSection 
                  ? 'hsl(var(--primary))' 
                  : 'hsl(var(--muted-foreground))',
              }}
            >
              {item.label}
            </motion.button>
          ))}
        </motion.div>
        
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <motion.div
            variants={collapsedIconVariants}
            animate={isExpanded ? "expanded" : "collapsed"}
          >
            <Menu className="h-6 w-6" style={{ color: 'hsl(var(--foreground))' }} />
          </motion.div>
        </div>
      </motion.nav>
    </div>
  );
}
