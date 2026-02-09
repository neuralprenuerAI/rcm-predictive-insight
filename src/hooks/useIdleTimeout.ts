import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const WARNING_MS = 14 * 60 * 1000; // 14 minutes - show warning

const ACTIVITY_EVENTS: (keyof DocumentEventMap)[] = [
  "mousedown",
  "mousemove",
  "keydown",
  "scroll",
  "touchstart",
  "click",
];

// Track active API calls globally so timeout doesn't fire during them
let activeApiCalls = 0;

export function registerApiCall() {
  activeApiCalls++;
}

export function unregisterApiCall() {
  activeApiCalls = Math.max(0, activeApiCalls - 1);
}

export function useIdleTimeout() {
  const [showWarning, setShowWarning] = useState(false);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const lastActivityRef = useRef(Date.now());

  const resetTimers = useCallback(() => {
    lastActivityRef.current = Date.now();
    setShowWarning(false);

    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);

    warningTimerRef.current = setTimeout(() => {
      // Don't show warning if API calls are active
      if (activeApiCalls > 0) {
        resetTimers();
        return;
      }
      setShowWarning(true);
    }, WARNING_MS);

    logoutTimerRef.current = setTimeout(() => {
      // Don't logout if API calls are active
      if (activeApiCalls > 0) {
        resetTimers();
        return;
      }
      performLogout();
    }, IDLE_TIMEOUT_MS);
  }, []);

  const performLogout = useCallback(async () => {
    setShowWarning(false);
    try {
      await supabase.auth.signOut({ scope: "local" } as any);
    } catch {
      // Force redirect even if signout fails
    }
    window.location.href = "/auth";
  }, []);

  const stayActive = useCallback(() => {
    resetTimers();
  }, [resetTimers]);

  useEffect(() => {
    // Only activate if user is authenticated
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      resetTimers();

      const handleActivity = () => {
        // Throttle: only reset if last activity was >30s ago
        if (Date.now() - lastActivityRef.current > 30_000) {
          resetTimers();
        }
      };

      ACTIVITY_EVENTS.forEach((event) => {
        document.addEventListener(event, handleActivity, { passive: true });
      });

      return () => {
        ACTIVITY_EVENTS.forEach((event) => {
          document.removeEventListener(event, handleActivity);
        });
        if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
        if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      };
    };

    const cleanup = checkAuth();
    return () => {
      cleanup.then((fn) => fn?.());
    };
  }, [resetTimers]);

  return { showWarning, stayActive, performLogout };
}
