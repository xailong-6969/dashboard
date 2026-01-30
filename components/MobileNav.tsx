"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

const navLinks = [
    { href: "/", label: "Home", icon: "🏠" },
    { href: "/markets", label: "Markets", icon: "📊" },
    { href: "/leaderboard", label: "Leaderboard", icon: "🏆" },
];

interface MobileNavProps {
    onSearch?: (address: string) => void;
}

export default function MobileNav({ onSearch }: MobileNavProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchValue, setSearchValue] = useState("");

    // Close menu on escape
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setIsOpen(false);
                setSearchOpen(false);
            }
        };
        window.addEventListener("keydown", handleEscape);
        return () => window.removeEventListener("keydown", handleEscape);
    }, []);

    // Prevent body scroll when menu is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchValue.trim() && onSearch) {
            onSearch(searchValue.trim());
            setSearchOpen(false);
            setSearchValue("");
        } else if (searchValue.trim()) {
            window.location.href = `/address/${searchValue.trim()}`;
        }
    };

    return (
        <>
            {/* Hamburger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="lg:hidden fixed top-4 right-4 z-[60] w-12 h-12 rounded-xl bg-zinc-800/90 backdrop-blur-sm border border-zinc-700 flex items-center justify-center"
                aria-label="Toggle menu"
            >
                <div className="w-5 h-4 flex flex-col justify-between">
                    <motion.span
                        animate={isOpen ? { rotate: 45, y: 6 } : { rotate: 0, y: 0 }}
                        className="w-full h-0.5 bg-white rounded-full origin-center"
                    />
                    <motion.span
                        animate={isOpen ? { opacity: 0, x: -10 } : { opacity: 1, x: 0 }}
                        className="w-full h-0.5 bg-white rounded-full"
                    />
                    <motion.span
                        animate={isOpen ? { rotate: -45, y: -6 } : { rotate: 0, y: 0 }}
                        className="w-full h-0.5 bg-white rounded-full origin-center"
                    />
                </div>
            </button>

            {/* Mobile Menu Overlay */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsOpen(false)}
                            className="lg:hidden fixed inset-0 bg-black/80 backdrop-blur-sm z-[55]"
                        />

                        {/* Menu Panel */}
                        <motion.div
                            initial={{ x: "100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="lg:hidden fixed right-0 top-0 bottom-0 w-[280px] bg-zinc-900/95 backdrop-blur-xl border-l border-zinc-800 z-[58] flex flex-col"
                        >
                            {/* Menu Header */}
                            <div className="p-6 border-b border-zinc-800">
                                <h2 className="text-xl font-bold gradient-text">Delphi Analytics</h2>
                                <p className="text-xs text-zinc-500 mt-1">Gensyn Testnet</p>
                            </div>

                            {/* Navigation Links */}
                            <nav className="flex-1 p-4">
                                <ul className="space-y-2">
                                    {navLinks.map((link, idx) => (
                                        <motion.li
                                            key={link.href}
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: idx * 0.1 }}
                                        >
                                            <Link
                                                href={link.href}
                                                onClick={() => setIsOpen(false)}
                                                className="flex items-center gap-4 px-4 py-3 rounded-xl text-zinc-300 hover:text-white hover:bg-zinc-800/50 transition-colors"
                                            >
                                                <span className="text-xl">{link.icon}</span>
                                                <span className="font-medium">{link.label}</span>
                                            </Link>
                                        </motion.li>
                                    ))}
                                </ul>

                                {/* Search */}
                                <div className="mt-6 pt-6 border-t border-zinc-800">
                                    <form onSubmit={handleSearch}>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={searchValue}
                                                onChange={(e) => setSearchValue(e.target.value)}
                                                placeholder="Search wallet (0x...)"
                                                className="w-full px-4 py-3 pl-11 rounded-xl bg-zinc-800/50 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 transition-colors text-sm"
                                            />
                                            <svg
                                                className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                                />
                                            </svg>
                                        </div>
                                    </form>
                                </div>
                            </nav>

                            {/* Footer */}
                            <div className="p-4 border-t border-zinc-800">
                                <a
                                    href="https://delphi.gensyn.ai"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium transition-colors"
                                >
                                    <span>Trade on Delphi</span>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                </a>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
