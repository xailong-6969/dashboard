"use client";

import { ReactNode, useRef, useEffect } from "react";
import { motion, useInView } from "framer-motion";

interface ScrollSectionProps {
    children: ReactNode;
    className?: string;
    id?: string;
    fullHeight?: boolean;
}

export function ScrollSection({
    children,
    className = "",
    id,
    fullHeight = true
}: ScrollSectionProps) {
    const ref = useRef<HTMLElement>(null);
    const isInView = useInView(ref, { once: false, amount: 0.3 });

    return (
        <section
            ref={ref}
            id={id}
            className={`
        ${fullHeight ? "min-h-screen" : ""} 
        w-full 
        flex flex-col 
        justify-center 
        snap-start 
        snap-always
        relative
        ${className}
      `}
        >
            <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="w-full"
            >
                {children}
            </motion.div>
        </section>
    );
}

interface ScrollContainerProps {
    children: ReactNode;
}

export function ScrollContainer({ children }: ScrollContainerProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // Smooth scroll behavior for section navigation
        const handleWheel = (e: WheelEvent) => {
            // Let natural scroll happen, CSS snap will handle the rest
        };

        container.addEventListener("wheel", handleWheel, { passive: true });
        return () => container.removeEventListener("wheel", handleWheel);
    }, []);

    return (
        <div
            ref={containerRef}
            data-scroll-container
            className="
        h-screen 
        overflow-y-auto 
        overflow-x-hidden
        scroll-smooth
        snap-y 
        snap-mandatory
        scrollbar-thin
        scrollbar-track-transparent
        scrollbar-thumb-zinc-700
        hover:scrollbar-thumb-zinc-600
      "
        >
            {children}
        </div>
    );
}

// Section navigation dots
interface SectionDotsProps {
    sections: { id: string; label: string }[];
    activeSection: string;
}

export function SectionDots({ sections, activeSection }: SectionDotsProps) {
    const scrollToSection = (id: string) => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    };

    return (
        <div className="fixed right-6 top-1/2 -translate-y-1/2 z-50 hidden lg:flex flex-col gap-3">
            {sections.map((section) => (
                <button
                    key={section.id}
                    onClick={() => scrollToSection(section.id)}
                    className={`
            group relative w-3 h-3 rounded-full transition-all duration-300
            ${activeSection === section.id
                            ? "bg-violet-500 scale-125"
                            : "bg-zinc-600 hover:bg-zinc-500"
                        }
          `}
                    aria-label={section.label}
                >
                    <span className="
            absolute right-6 top-1/2 -translate-y-1/2
            px-2 py-1 rounded bg-zinc-800 text-xs text-white
            opacity-0 group-hover:opacity-100 transition-opacity
            whitespace-nowrap pointer-events-none
          ">
                        {section.label}
                    </span>
                </button>
            ))}
        </div>
    );
}
