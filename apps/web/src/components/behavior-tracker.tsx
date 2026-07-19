'use client';

import { useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { 
  navigation, 
  engagement, 
  ui 
} from '@/lib/posthog-events';

interface BehaviorState {
  pageLoadTime: number;
  maxScrollDepth: number;
  interactionsCount: number;
  lastInteractionTime: number;
  lastInteractionType: string;
  scrollMilestones: Set<number>;
  isIdle: boolean;
  idleStartTime: number | null;
  clickTimes: number[];
  sessionStartTime: number;
  pagesViewed: number;
  previousPath: string | null;
  previousPageTime: number;
  previousScrollDepth: number;
}

const IDLE_THRESHOLD_MS = 30000; // 30 seconds
const HEARTBEAT_INTERVAL_MS = 60000; // 1 minute
const RAGE_CLICK_THRESHOLD = 3;
const RAGE_CLICK_WINDOW_MS = 1000;

export function BehaviorTracker({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const stateRef = useRef<BehaviorState>({
    pageLoadTime: Date.now(),
    maxScrollDepth: 0,
    interactionsCount: 0,
    lastInteractionTime: Date.now(),
    lastInteractionType: 'pageload',
    scrollMilestones: new Set(),
    isIdle: false,
    idleStartTime: null,
    clickTimes: [],
    sessionStartTime: Date.now(),
    pagesViewed: 1,
    previousPath: null,
    previousPageTime: 0,
    previousScrollDepth: 0,
  });

  // Track scroll depth
  const handleScroll = useCallback(() => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPercent = docHeight > 0 ? Math.round((scrollTop / docHeight) * 100) : 0;
    
    const state = stateRef.current;
    state.maxScrollDepth = Math.max(state.maxScrollDepth, scrollPercent);
    state.lastInteractionTime = Date.now();
    state.lastInteractionType = 'scroll';
    state.interactionsCount++;

    // Track scroll milestones
    const milestones = [25, 50, 75, 90, 100] as const;
    milestones.forEach((milestone) => {
      if (scrollPercent >= milestone && !state.scrollMilestones.has(milestone)) {
        state.scrollMilestones.add(milestone);
        engagement.scrollMilestone({
          page_path: pathname,
          depth_percent: milestone,
          time_to_reach_ms: Date.now() - state.pageLoadTime,
        });
      }
    });

    // Check if returning from idle
    if (state.isIdle && state.idleStartTime) {
      engagement.userReturned({
        page_path: pathname,
        idle_duration_sec: Math.round((Date.now() - state.idleStartTime) / 1000),
        return_interaction_type: 'scroll',
      });
      state.isIdle = false;
      state.idleStartTime = null;
    }
  }, [pathname]);

  // Track clicks for rage click detection
  const handleClick = useCallback((e: MouseEvent) => {
    const state = stateRef.current;
    const now = Date.now();
    
    state.lastInteractionTime = now;
    state.lastInteractionType = 'click';
    state.interactionsCount++;
    
    // Add click time and remove old ones
    state.clickTimes.push(now);
    state.clickTimes = state.clickTimes.filter(t => now - t < RAGE_CLICK_WINDOW_MS);
    
    // Detect rage clicks
    if (state.clickTimes.length >= RAGE_CLICK_THRESHOLD) {
      const target = e.target as HTMLElement;
      engagement.rageClick({
        page_path: pathname,
        element_selector: target.tagName.toLowerCase() + (target.id ? `#${target.id}` : ''),
        click_count: state.clickTimes.length,
        time_window_ms: RAGE_CLICK_WINDOW_MS,
      });
      state.clickTimes = []; // Reset after detecting
    }

    // Check if returning from idle
    if (state.isIdle && state.idleStartTime) {
      engagement.userReturned({
        page_path: pathname,
        idle_duration_sec: Math.round((now - state.idleStartTime) / 1000),
        return_interaction_type: 'click',
      });
      state.isIdle = false;
      state.idleStartTime = null;
    }
  }, [pathname]);

  // Track keyboard activity
  const handleKeydown = useCallback(() => {
    const state = stateRef.current;
    state.lastInteractionTime = Date.now();
    state.lastInteractionType = 'keydown';
    state.interactionsCount++;

    if (state.isIdle && state.idleStartTime) {
      engagement.userReturned({
        page_path: pathname,
        idle_duration_sec: Math.round((Date.now() - state.idleStartTime) / 1000),
        return_interaction_type: 'keydown',
      });
      state.isIdle = false;
      state.idleStartTime = null;
    }
  }, [pathname]);

  // Track mouse movement (throttled)
  const lastMouseMove = useRef(0);
  const handleMouseMove = useCallback(() => {
    const now = Date.now();
    if (now - lastMouseMove.current < 1000) return; // Throttle to 1s
    lastMouseMove.current = now;
    
    const state = stateRef.current;
    state.lastInteractionTime = now;
    state.lastInteractionType = 'mousemove';

    if (state.isIdle && state.idleStartTime) {
      engagement.userReturned({
        page_path: pathname,
        idle_duration_sec: Math.round((now - state.idleStartTime) / 1000),
        return_interaction_type: 'mousemove',
      });
      state.isIdle = false;
      state.idleStartTime = null;
    }
  }, [pathname]);

  // Track tab visibility
  const handleVisibilityChange = useCallback(() => {
    const state = stateRef.current;
    const isVisible = document.visibilityState === 'visible';
    
    if (isVisible && state.idleStartTime) {
      engagement.tabVisibilityChanged({
        page_path: pathname,
        is_visible: true,
        hidden_duration_sec: Math.round((Date.now() - state.idleStartTime) / 1000),
      });
      state.idleStartTime = null;
    } else if (!isVisible) {
      engagement.tabVisibilityChanged({
        page_path: pathname,
        is_visible: false,
      });
      state.idleStartTime = Date.now();
    }
  }, [pathname]);

  // Check for idle state periodically
  useEffect(() => {
    const idleChecker = setInterval(() => {
      const state = stateRef.current;
      const timeSinceInteraction = Date.now() - state.lastInteractionTime;
      
      if (timeSinceInteraction >= IDLE_THRESHOLD_MS && !state.isIdle) {
        state.isIdle = true;
        state.idleStartTime = state.lastInteractionTime;
        engagement.userIdle({
          page_path: pathname,
          idle_duration_sec: Math.round(timeSinceInteraction / 1000),
          last_interaction_type: state.lastInteractionType,
        });
      }
    }, 5000);

    return () => clearInterval(idleChecker);
  }, [pathname]);

  // Session heartbeat
  useEffect(() => {
    const heartbeat = setInterval(() => {
      const state = stateRef.current;
      engagement.sessionHeartbeat({
        page_path: pathname,
        session_duration_sec: Math.round((Date.now() - state.sessionStartTime) / 1000),
        pages_viewed: state.pagesViewed,
        interactions_count: state.interactionsCount,
        is_active: !state.isIdle,
      });
    }, HEARTBEAT_INTERVAL_MS);

    return () => clearInterval(heartbeat);
  }, [pathname]);

  // Track page navigation
  useEffect(() => {
    const state = stateRef.current;
    const now = Date.now();

    // Track page left for previous page
    if (state.previousPath && state.previousPath !== pathname) {
      navigation.pageLeft({
        page_path: state.previousPath,
        time_on_page_ms: now - state.pageLoadTime,
        scroll_depth_max: state.maxScrollDepth,
        interactions_count: state.interactionsCount,
        exit_type: 'navigation',
      });
    }

    // Track new page view
    navigation.pageViewed({
      page_path: pathname,
      page_title: typeof document !== 'undefined' ? document.title : undefined,
      referrer: typeof document !== 'undefined' ? document.referrer : undefined,
      time_on_previous_page_ms: state.previousPath ? now - state.pageLoadTime : undefined,
      scroll_depth_previous: state.previousPath ? state.maxScrollDepth : undefined,
      entry_type: state.previousPath ? 'internal' : 'direct',
    });

    // Store previous page data and reset for new page
    state.previousPath = pathname;
    state.previousPageTime = now - state.pageLoadTime;
    state.previousScrollDepth = state.maxScrollDepth;
    state.pageLoadTime = now;
    state.maxScrollDepth = 0;
    state.interactionsCount = 0;
    state.scrollMilestones = new Set();
    state.pagesViewed++;
  }, [pathname]);

  // Setup event listeners
  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('click', handleClick);
    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Track page exit on unload
    const handleBeforeUnload = () => {
      const state = stateRef.current;
      navigation.pageLeft({
        page_path: pathname,
        time_on_page_ms: Date.now() - state.pageLoadTime,
        scroll_depth_max: state.maxScrollDepth,
        interactions_count: state.interactionsCount,
        exit_type: 'close',
      });
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleKeydown);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [pathname, handleScroll, handleClick, handleKeydown, handleMouseMove, handleVisibilityChange]);

  return <>{children}</>;
}

export default BehaviorTracker;
