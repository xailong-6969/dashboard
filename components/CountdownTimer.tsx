"use client";

import { useState, useEffect } from "react";

interface TimeLeft {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isExpired: boolean;
}

function calculateTimeLeft(endTimestamp: string): TimeLeft {
    const now = new Date().getTime();
    const end = new Date(endTimestamp).getTime();
    const difference = end - now;

    if (difference <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
    }

    return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / (1000 * 60)) % 60),
        seconds: Math.floor((difference / 1000) % 60),
        isExpired: false,
    };
}

export default function CountdownTimer({
    endTimestamp,
    label = "Ends in",
}: {
    endTimestamp: string;
    label?: string;
}) {
    const [timeLeft, setTimeLeft] = useState<TimeLeft>({
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        isExpired: false,
    });
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const timer = setInterval(() => {
            setTimeLeft(calculateTimeLeft(endTimestamp));
        }, 1000);
        setTimeLeft(calculateTimeLeft(endTimestamp));
        return () => clearInterval(timer);
    }, [endTimestamp]);

    if (!mounted) {
        return <span className="text-zinc-400">Loading...</span>;
    }

    if (timeLeft.isExpired) {
        return <span className="text-red-400">Market Ended</span>;
    }

    return (
        <div className="flex items-center gap-2">
            <span className="text-zinc-400">{label}:</span>
            <span className="text-emerald-400 font-mono font-bold">
                {timeLeft.days > 0 && `${timeLeft.days}d `}
                {String(timeLeft.hours).padStart(2, "0")}h{" "}
                {String(timeLeft.minutes).padStart(2, "0")}m{" "}
                {String(timeLeft.seconds).padStart(2, "0")}s
            </span>
        </div>
    );
}
