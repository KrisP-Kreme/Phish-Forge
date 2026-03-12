"use client";

import { cn } from "@/lib/utils";
import { Globe, Mail, Send } from "lucide-react";
import { motion } from "framer-motion";
import type React from "react";

interface HowItWorksProps extends React.HTMLAttributes<HTMLElement> {}

interface RoadmapCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  benefits: string[];
  stepNumber: string;
  index: number;
  rotation: string;
}

// Animated investigation strings connecting the 3 roadmap cards — matches Team section aesthetic
const RoadmapStrings = () => (
  <svg
    className="absolute inset-0 w-full h-full pointer-events-none hidden md:block"
    style={{ zIndex: 0 }}
    viewBox="0 0 100 100"
    preserveAspectRatio="none"
  >
    <defs>
      <filter id="roadmap-blur">
        <feGaussianBlur in="SourceGraphic" stdDeviation="0.5" />
      </filter>
    </defs>

    {/* Left card → center card */}
    <motion.path
      initial={{ d: "M 16.66 6 Q 33.33 13 50 6" }}
      animate={{
        d: [
          "M 16.66 6 Q 33.33 13 50 6",
          "M 16.66 6 Q 34 16 50 6",
          "M 16.66 6 Q 32.5 14 50 6",
          "M 16.66 6 Q 33.33 13 50 6",
        ],
      }}
      stroke="#c44536"
      strokeWidth="0.3"
      strokeDasharray="0.8,0.8"
      opacity="0.7"
      fill="none"
      filter="url(#roadmap-blur)"
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
    />

    {/* Center card → right card */}
    <motion.path
      initial={{ d: "M 50 6 Q 66.66 13 83.33 6" }}
      animate={{
        d: [
          "M 50 6 Q 66.66 13 83.33 6",
          "M 50 6 Q 66 16 83.33 6",
          "M 50 6 Q 67.5 14 83.33 6",
          "M 50 6 Q 66.66 13 83.33 6",
        ],
      }}
      stroke="#c44536"
      strokeWidth="0.3"
      strokeDasharray="0.8,0.8"
      opacity="0.7"
      fill="none"
      filter="url(#roadmap-blur)"
      transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 0.7 }}
    />

    {/* Pushpin anchor dots */}
    <circle cx="16.66" cy="6" r="0.5" fill="#c44536" />
    <circle cx="50" cy="6" r="0.5" fill="#c44536" />
    <circle cx="83.33" cy="6" r="0.5" fill="#c44536" />
  </svg>
);

const RoadmapCard: React.FC<RoadmapCardProps> = ({
  icon,
  title,
  description,
  benefits,
  stepNumber,
  index,
  rotation,
}) => (
  <motion.div
    className="relative"
    style={{ zIndex: 1 }}
    initial={{ opacity: 0, y: 40 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.55, delay: 0.2 + index * 0.18 }}
    whileHover={{ y: -8, rotate: 0 }}
  >
    {/* Red pushpin — matches Team section exactly */}
    <div
      className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full flex items-center justify-center z-10"
      style={{ backgroundColor: "#c44536" }}
    >
      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "#8b2e23" }} />
    </div>

    {/* Pinned paper card */}
    <div
      className="bg-card border border-border pt-6 px-5 pb-5 shadow-xl transition-shadow duration-300"
      style={{ transform: rotation, borderColor: "hsl(var(--border))" }}
    >
      {/* Ghost step number watermark */}
      <div
        className="absolute bottom-2 right-3 text-[4.5rem] font-black leading-none select-none pointer-events-none"
        style={{ color: "hsl(var(--foreground) / 0.05)" }}
      >
        {stepNumber}
      </div>

      {/* Icon + step label */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className="flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0"
          style={{ backgroundColor: "hsl(var(--primary) / 0.1)", color: "hsl(var(--primary))" }}
        >
          {icon}
        </div>
        <div>
          <div
            className="text-[9px] font-mono uppercase tracking-[0.2em] mb-0.5"
            style={{ color: "hsl(var(--primary))" }}
          >
            Step {stepNumber}
          </div>
          <h3 className="text-lg font-bold leading-tight" style={{ color: "hsl(var(--foreground))" }}>
            {title}
          </h3>
        </div>
      </div>

      <p className="text-sm md:text-base leading-relaxed mb-3" style={{ color: "hsl(var(--muted-foreground))" }}>
        {description}
      </p>

      <div className="h-px mb-3" style={{ backgroundColor: "hsl(var(--border))" }} />

      <ul className="space-y-1.5">
        {benefits.map((benefit, i) => (
          <li key={i} className="flex items-center gap-2 text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
            <div
              className="flex-shrink-0 w-1 h-1 rounded-full"
              style={{ backgroundColor: "hsl(var(--primary))" }}
            />
            {benefit}
          </li>
        ))}
      </ul>
    </div>
  </motion.div>
);

export const HowItWorks: React.FC<HowItWorksProps> = ({ className, ...props }) => {
  const stepsData = [
    {
      stepNumber: "01",
      rotation: "rotate(-1.5deg)",
      icon: <Globe className="h-4 w-4" />,
      title: "Choose Target",
      description:
        "Select your target domain and let AI discover the perfect partners to simulate realistic attacks.",
      benefits: [
        "AI-powered partner discovery",
        "Automated domain analysis",
        "Intelligent target identification",
      ],
    },
    {
      stepNumber: "02",
      rotation: "rotate(0.8deg)",
      icon: <Mail className="h-4 w-4" />,
      title: "Craft Email",
      description:
        "AI generates authentic-looking phishing emails with extracted design elements from real websites.",
      benefits: [
        "Real-time HTML/CSS extraction",
        "Brand-matched styling",
        "Custom phishing scenarios",
      ],
    },
    {
      stepNumber: "03",
      rotation: "rotate(-0.5deg)",
      icon: <Send className="h-4 w-4" />,
      title: "Deploy Campaign",
      description:
        "Launch your security awareness testing campaign to selected targets and track engagement.",
      benefits: [
        "Scheduled campaign deployment",
        "Real-time click tracking",
        "Automated user notifications",
      ],
    },
  ];

  return (
    <section className={cn("w-full", className)} {...props}>
      <div className="container mx-auto px-4 max-w-5xl">

        {/* Section header */}
        <motion.div
          className="mb-10 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h2
            className="text-4xl md:text-6xl lg:text-[5rem] font-bold leading-[1.1] tracking-tight"
            style={{ color: "hsl(var(--foreground))" }}
          >
            How It Works
          </h2>
          <p
            className="mt-3 text-base md:text-lg max-w-xl mx-auto leading-relaxed"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            Three steps to launch your security awareness campaign and strengthen your organisation's defences.
          </p>
        </motion.div>

        {/* Roadmap: pinned cards connected by investigation strings */}
        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8 pt-4">
          <RoadmapStrings />
          {stepsData.map((step, index) => (
            <RoadmapCard key={index} {...step} index={index} />
          ))}
        </div>

      </div>
    </section>
  );
};
