import { Shield, ShieldCheck, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface RoleBadgeProps {
  role: "super_admin" | "admin" | "user";
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

export function RoleBadge({ role, showLabel = true, size = "md" }: RoleBadgeProps) {
  const config = {
    super_admin: {
      label: "Super Admin",
      icon: ShieldCheck,
      className: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800",
      iconClassName: "text-purple-600 dark:text-purple-400",
    },
    admin: {
      label: "Admin",
      icon: Shield,
      className: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
      iconClassName: "text-blue-600 dark:text-blue-400",
    },
    user: {
      label: "User",
      icon: User,
      className: "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
      iconClassName: "text-gray-600 dark:text-gray-400",
    },
  };

  const { label, icon: Icon, className, iconClassName } = config[role];

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5",
    md: "text-sm px-2 py-1",
    lg: "text-base px-3 py-1.5",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium",
        className,
        sizeClasses[size]
      )}
    >
      <Icon className={cn(iconSizes[size], iconClassName)} />
      {showLabel && label}
    </span>
  );
}

export default RoleBadge;
