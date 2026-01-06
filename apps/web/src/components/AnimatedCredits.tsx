"use client";

import { useEffect, useState, useRef } from "react";
import { Zap, TrendingUp, TrendingDown } from "lucide-react";
import Link from "next/link";

interface AnimatedCreditsProps {
  initialCredits: number;
}

export function AnimatedCredits({ initialCredits }: AnimatedCreditsProps) {
  const [credits, setCredits] = useState(initialCredits);
  const [previousCredits, setPreviousCredits] = useState(initialCredits);
  const [isAnimating, setIsAnimating] = useState(false);
  const [changeType, setChangeType] = useState<"increase" | "decrease" | null>(null);
  const [changeAmount, setChangeAmount] = useState(0);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Poll for credit changes every 30 seconds (reduced from 3s to avoid excessive requests)
  useEffect(() => {
    const fetchCredits = async () => {
      try {
        const res = await fetch("/api/credits");
        if (res.ok) {
          const data = await res.json();
          const newCredits = data.credits ?? data.balance ?? initialCredits;
          
          if (newCredits !== credits) {
            const diff = newCredits - credits;
            setPreviousCredits(credits);
            setCredits(newCredits);
            setChangeAmount(Math.abs(diff));
            setChangeType(diff > 0 ? "increase" : "decrease");
            setIsAnimating(true);
            
            // Reset animation after 3 seconds
            setTimeout(() => {
              setIsAnimating(false);
              setChangeType(null);
            }, 3000);
          }
        }
      } catch (error) {
        // Silently fail - credits will update on next poll
      }
    };

    // Initial fetch
    fetchCredits();

    // Poll every 30 seconds (was 3s - reduced to avoid excessive requests)
    pollIntervalRef.current = setInterval(fetchCredits, 30000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [initialCredits]); // Removed 'credits' from deps to prevent re-creating interval on every update

  return (
    <Link 
      href="/app/credits" 
      className="relative block p-3 rounded-lg bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 mb-4 hover:from-indigo-500/20 hover:to-purple-500/20 transition-all duration-300"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-indigo-400 text-sm font-medium mb-1">
          <Zap className={`w-4 h-4 ${isAnimating ? "animate-pulse" : ""}`} />
          Credits Available
        </div>
        
        {/* Change indicator badge */}
        {isAnimating && changeType && (
          <div 
            className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
              changeType === "increase" 
                ? "bg-green-500/20 text-green-400 animate-bounce" 
                : "bg-red-500/20 text-red-400 animate-pulse"
            }`}
          >
            {changeType === "increase" ? (
              <>
                <TrendingUp className="w-3 h-3" />
                +{changeAmount}
              </>
            ) : (
              <>
                <TrendingDown className="w-3 h-3" />
                -{changeAmount}
              </>
            )}
          </div>
        )}
      </div>
      
      {/* Credits number - only this changes color */}
      <div className={`text-2xl font-bold transition-all duration-500 ${
        isAnimating && changeType === "decrease"
          ? "text-red-400"
          : isAnimating && changeType === "increase"
            ? "text-green-400"
            : "text-white"
      }`}>
        {credits}
      </div>
    </Link>
  );
}
