import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

type Role = "super_admin" | "admin" | "user";

interface RoleContextType {
  role: Role;
  isLoading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  user: User | null;
  refetchRole: () => Promise<void>;
}

const RoleContext = createContext<RoleContextType>({
  role: "user",
  isLoading: true,
  isAdmin: false,
  isSuperAdmin: false,
  user: null,
  refetchRole: async () => {},
});

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>("user");
  const [isLoading, setIsLoading] = useState(true);

  const fetchRole = async (userId?: string) => {
    const targetUserId = userId || user?.id;
    
    if (!targetUserId) {
      setRole("user");
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", targetUserId)
        .single();

      if (error) {
        console.log("No role found, defaulting to user:", error.message);
        setRole("user");
      } else {
        setRole((data?.role as Role) || "user");
      }
    } catch (err) {
      console.error("Error fetching role:", err);
      setRole("user");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        await fetchRole(session.user.id);
      } else {
        setIsLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user);
          await fetchRole(session.user.id);
        } else {
          setUser(null);
          setRole("user");
          setIsLoading(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const value: RoleContextType = {
    role,
    isLoading,
    isAdmin: role === "admin" || role === "super_admin",
    isSuperAdmin: role === "super_admin",
    user,
    refetchRole: () => fetchRole(),
  };

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error("useRole must be used within a RoleProvider");
  }
  return context;
}

// Convenience hooks
export function useIsAdmin() {
  const { isAdmin, isLoading } = useRole();
  return { isAdmin, isLoading };
}

export function useIsSuperAdmin() {
  const { isSuperAdmin, isLoading } = useRole();
  return { isSuperAdmin, isLoading };
}

export default RoleContext;
