import { useState } from "react";
import { useRole } from "@/contexts/RoleContext";
import { RoleBadge } from "@/components/ui/RoleBadge";
import { 
  ShieldCheck, 
  Users, 
  Plug, 
  AlertTriangle, 
  BarChart3, 
  Wrench,
  ArrowLeft,
  Shield,
  UserPlus
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InviteUserModal } from "@/components/admin/InviteUserModal";

export default function Admin() {
  const { role, isSuperAdmin } = useRole();
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  const adminSections = [
    {
      id: "overview",
      title: "Overview",
      description: "System health and quick stats",
      icon: ShieldCheck,
      color: "bg-blue-500",
      available: true,
    },
    {
      id: "users",
      title: "Users",
      description: "Manage all users and roles",
      icon: Users,
      color: "bg-green-500",
      available: true,
    },
    {
      id: "connections",
      title: "API Connections",
      description: "Monitor all ECW connections",
      icon: Plug,
      color: "bg-purple-500",
      available: true,
    },
    {
      id: "errors",
      title: "Error Logs",
      description: "View and troubleshoot errors",
      icon: AlertTriangle,
      color: "bg-red-500",
      available: true,
    },
    {
      id: "analytics",
      title: "Analytics",
      description: "Usage trends and insights",
      icon: BarChart3,
      color: "bg-orange-500",
      available: true,
    },
    {
      id: "developer",
      title: "Developer Tools",
      description: "Database explorer & debug tools",
      icon: Wrench,
      color: "bg-gray-700",
      available: isSuperAdmin,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <Link to="/">
                  <Button variant="ghost" size="sm" className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Back to App
                  </Button>
                </Link>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <ShieldCheck className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">
                    Admin Center
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    System management and monitoring
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                onClick={() => setIsInviteModalOpen(true)}
                className="flex items-center gap-2"
              >
                <UserPlus className="h-4 w-4" />
                Invite User
              </Button>
              <RoleBadge role={role} size="lg" />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-6 py-8">
        {/* Section Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {adminSections
            .filter((section) => section.available)
            .map((section) => (
              <Card key={section.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${section.color}`}>
                      <section.icon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{section.title}</CardTitle>
                      <CardDescription>{section.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Coming in Phase 2...</span>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>

        {/* Super Admin Notice */}
        {isSuperAdmin && (
          <Card className="border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-900/20">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                <CardTitle className="text-purple-800 dark:text-purple-300">
                  Super Admin Access
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-purple-700 dark:text-purple-300">
                You have full access including Developer Tools. You can modify roles, 
                resolve errors, and access database tools.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Admin Notice (non-super) */}
        {role === "admin" && (
          <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <CardTitle className="text-blue-800 dark:text-blue-300">
                  Admin Access
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-blue-700 dark:text-blue-300">
                You have read access to all admin sections. Contact Jose (Super Admin) 
                for any changes or modifications.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Invite Modal */}
      <InviteUserModal 
        isOpen={isInviteModalOpen} 
        onClose={() => setIsInviteModalOpen(false)}
        onSuccess={() => {
          // Could refresh invites list here if we add one
        }}
      />
    </div>
  );
}
