import { useState } from "react";
import { useRole } from "@/contexts/RoleContext";
import { RoleBadge } from "@/components/ui/RoleBadge";
import { UsersTab } from "@/components/admin/UsersTab";
import { OverviewTab } from "@/components/admin/OverviewTab";
import { ConnectionsTab } from "@/components/admin/ConnectionsTab";
import { ErrorsTab } from "@/components/admin/ErrorsTab";
import { AnalyticsTab } from "@/components/admin/AnalyticsTab";
import { DevToolsTab } from "@/components/admin/DevToolsTab";
import { DocumentsTab } from "@/components/admin/DocumentsTab";
import { SecurityAuditTab } from "@/components/admin/SecurityAuditTab";
import { InviteUserModal } from "@/components/admin/InviteUserModal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { 
  ShieldCheck, 
  Shield,
  Users, 
  Plug, 
  AlertTriangle, 
  BarChart3, 
  Wrench,
  ArrowLeft,
  UserPlus,
  LayoutDashboard,
  FileText
} from "lucide-react";
import { Link } from "react-router-dom";

export default function Admin() {
  const { role, isSuperAdmin } = useRole();
  const [activeTab, setActiveTab] = useState("overview");
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

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

      {/* Tabs Navigation */}
      <div className="container mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-7 lg:grid-cols-8 h-auto p-1">
            <TabsTrigger value="overview" className="flex items-center gap-2 py-2">
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2 py-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Users</span>
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex items-center gap-2 py-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Documents</span>
            </TabsTrigger>
            <TabsTrigger value="connections" className="flex items-center gap-2 py-2">
              <Plug className="h-4 w-4" />
              <span className="hidden sm:inline">Connections</span>
            </TabsTrigger>
            <TabsTrigger value="errors" className="flex items-center gap-2 py-2">
              <AlertTriangle className="h-4 w-4" />
              <span className="hidden sm:inline">Errors</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2 py-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
            {isSuperAdmin && (
              <TabsTrigger value="security" className="flex items-center gap-2 py-2">
                <Shield className="h-4 w-4" />
                <span className="hidden sm:inline">Security</span>
              </TabsTrigger>
            )}
            {isSuperAdmin && (
              <TabsTrigger value="devtools" className="flex items-center gap-2 py-2">
                <Wrench className="h-4 w-4" />
                <span className="hidden sm:inline">Dev Tools</span>
              </TabsTrigger>
            )}
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-6">
            <OverviewTab />
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <UsersTab />
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="mt-6">
            <DocumentsTab />
          </TabsContent>

          {/* Connections Tab */}
          <TabsContent value="connections" className="mt-6">
            <ConnectionsTab />
          </TabsContent>

          {/* Errors Tab */}
          <TabsContent value="errors" className="mt-6">
            <ErrorsTab />
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="mt-6">
            <AnalyticsTab />
          </TabsContent>

          {/* Security Tab - Super Admin Only */}
          {isSuperAdmin && (
            <TabsContent value="security" className="mt-6">
              <SecurityAuditTab />
            </TabsContent>
          )}

          {/* Dev Tools Tab - Super Admin Only */}
          {isSuperAdmin && (
            <TabsContent value="devtools" className="mt-6">
              <DevToolsTab />
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Invite Modal */}
      <InviteUserModal 
        isOpen={isInviteModalOpen} 
        onClose={() => setIsInviteModalOpen(false)}
        onSuccess={() => {
          // Refresh will happen when switching to users tab
        }}
      />
    </div>
  );
}
