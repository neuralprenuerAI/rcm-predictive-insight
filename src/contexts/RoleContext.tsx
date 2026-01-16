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
  const [roleLoading, setRoleLoading] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  // 1) Track auth state (independent from role)
  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      setUser(session?.user ?? null);
      setAuthChecked(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!isMounted) return;
        setUser(session?.user ?? null);
        setAuthChecked(true);
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // 2) Fetch role (never blocks forever)
  const fetchRole = async () => {
    if (!user?.id) {
      setRole("user");
      setRoleLoading(false);
      return;
    }

    setRoleLoading(true);

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Role fetch timeout")), 5000)
    );

    try {
      const query = supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      const { data, error } = await Promise.race([query, timeout]);

      if (error) {
        console.log("Error fetching role, defaulting to user:", error.message);
        setRole("user");
      } else {
        setRole((data?.role as Role) || "user");
      }
    } catch (err) {
      console.error("Error fetching role:", err);
      setRole("user");
    } finally {
      setRoleLoading(false);
    }
  };

  // 3) When auth is known, fetch role once per user
  useEffect(() => {
    if (!authChecked) return;

    if (!user) {
      setRole("user");
      setRoleLoading(false);
      return;
    }

    fetchRole();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, user?.id]);

  const value: RoleContextType = {
    role,
    isLoading: !authChecked || roleLoading,
    isAdmin: role === "admin" || role === "super_admin",
    isSuperAdmin: role === "super_admin",
    user,
    refetchRole: fetchRole,
  };

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const context = useContext(RoleContext);
  if (!context) throw new Error("useRole must be used within a RoleProvider");
  return context;
}

export function useIsAdmin() {
  const { isAdmin, isLoading } = useRole();
  return { isAdmin, isLoading };
}

export function useIsSuperAdmin() {
  const { isSuperAdmin, isLoading } = useRole();
  return { isSuperAdmin, isLoading };
}

export default RoleContext;
