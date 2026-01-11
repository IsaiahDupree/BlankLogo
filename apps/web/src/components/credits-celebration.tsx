'use client';

import { useState, useEffect, createContext, useContext, useCallback, ReactNode } from 'react';
import { Gift, Sparkles, X, PartyPopper } from 'lucide-react';

interface CreditsCelebrationProps {
  credits: number;
  reason?: string;
  onClose?: () => void;
}

export function CreditsCelebration({ credits, reason = 'Welcome bonus', onClose }: CreditsCelebrationProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isAnimating, setIsAnimating] = useState(true);

  useEffect(() => {
    // Stop confetti animation after 3 seconds
    const timer = setTimeout(() => setIsAnimating(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    onClose?.();
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      {/* Confetti particles */}
      {isAnimating && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
              }}
            >
              <Sparkles 
                className="w-4 h-4" 
                style={{ 
                  color: ['#FFD700', '#FF6B6B', '#4ECDC4', '#A855F7', '#3B82F6'][Math.floor(Math.random() * 5)] 
                }} 
              />
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <div className="relative bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-900 rounded-2xl p-8 max-w-md mx-4 text-center shadow-2xl border border-purple-500/30 animate-scale-in">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-1 rounded-full hover:bg-white/10 transition text-white/60 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon */}
        <div className="relative mx-auto mb-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center animate-bounce-slow">
            <Gift className="w-10 h-10 text-white" />
          </div>
          <div className="absolute -top-2 -right-2">
            <PartyPopper className="w-8 h-8 text-yellow-400 animate-wiggle" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-white mb-2">
          🎉 Congratulations!
        </h2>

        {/* Credits amount */}
        <div className="my-6">
          <div className="text-6xl font-bold bg-gradient-to-r from-yellow-400 via-orange-400 to-pink-500 bg-clip-text text-transparent animate-pulse">
            +{credits}
          </div>
          <div className="text-lg text-purple-200 mt-1">
            Free Credits
          </div>
        </div>

        {/* Reason */}
        <p className="text-gray-300 mb-6">
          {reason === 'promo_signup' && "Thanks for signing up through our special link!"}
          {reason === 'welcome_bonus' && "Welcome to BlankLogo! Here's a gift to get you started."}
          {reason !== 'promo_signup' && reason !== 'welcome_bonus' && reason}
        </p>

        {/* CTA */}
        <button
          onClick={handleClose}
          className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-white font-semibold transition transform hover:scale-105"
        >
          Start Removing Watermarks →
        </button>

        {/* Subtle note */}
        <p className="text-xs text-gray-400 mt-4">
          Each watermark removal uses 2 credits
        </p>
      </div>
    </div>
  );
}

// Hook for managing celebration state

interface CelebrationContextType {
  showCelebration: (credits: number, reason?: string) => void;
}

const CelebrationContext = createContext<CelebrationContextType | null>(null);

export function useCelebration() {
  const context = useContext(CelebrationContext);
  if (!context) {
    // Return a no-op if not in provider (for server-side)
    return { showCelebration: () => {} };
  }
  return context;
}

export function CelebrationProvider({ children }: { children: ReactNode }) {
  const [celebration, setCelebration] = useState<{ credits: number; reason?: string } | null>(null);

  const showCelebration = useCallback((credits: number, reason?: string) => {
    setCelebration({ credits, reason });
  }, []);

  const hideCelebration = useCallback(() => {
    setCelebration(null);
  }, []);

  return (
    <CelebrationContext.Provider value={{ showCelebration }}>
      {children}
      {celebration && (
        <CreditsCelebration
          credits={celebration.credits}
          reason={celebration.reason}
          onClose={hideCelebration}
        />
      )}
    </CelebrationContext.Provider>
  );
}
