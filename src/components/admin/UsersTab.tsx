import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/contexts/RoleContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RoleBadge } from "@/components/ui/RoleBadge";
import { 
  Users, 
  Mail, 
  Search, 
  MoreVertical, 
  Shield,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Loader2,
  Calendar
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getInvites, revokeInvite, resendInvite, Invite } from "@/lib/inviteService";
import { format, formatDistanceToNow } from "date-fns";

interface UserWithRole {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  role: "super_admin" | "admin" | "user";
}

export function UsersTab() {
  const { isSuperAdmin } = useRole();
  const { toast } = useToast();
  
  // State
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isLoadingInvites, setIsLoadingInvites] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [activeSubTab, setActiveSubTab] = useState("users");

  // Fetch users with roles
  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      // Get all user roles (which includes user info)
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("*")
        .order("created_at", { ascending: false });

      if (rolesError) throw rolesError;

      // Transform data
      const usersWithRoles: UserWithRole[] = (rolesData || []).map((r: any) => ({
        id: r.user_id,
        email: r.email,
        full_name: null,
        created_at: r.created_at,
        last_sign_in_at: null,
        role: r.role,
      }));

      setUsers(usersWithRoles);
    } catch (err) {
      console.error("Error fetching users:", err);
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive",
      });
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // Fetch pending invites
  const fetchInvites = async () => {
    setIsLoadingInvites(true);
    try {
      const data = await getInvites();
      setInvites(data);
    } catch (err) {
      console.error("Error fetching invites:", err);
    } finally {
      setIsLoadingInvites(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchInvites();
  }, []);

  // Filter users
  const filteredUsers = users.filter((user) => {
    const matchesSearch = 
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  // Filter invites
  const pendingInvites = invites.filter((i) => i.status === "pending");

  // Handle role change (super_admin only)
  const handleRoleChange = async (userId: string, newRole: "admin" | "user") => {
    if (!isSuperAdmin) {
      toast({
        title: "Permission Denied",
        description: "Only Super Admins can change roles",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("user_roles")
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq("user_id", userId);

      if (error) throw error;

      toast({
        title: "Role Updated",
        description: `User role changed to ${newRole}`,
      });

      fetchUsers();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to update role",
        variant: "destructive",
      });
    }
  };

  // Handle revoke invite
  const handleRevokeInvite = async (inviteId: string) => {
    const result = await revokeInvite(inviteId);
    
    if (result.success) {
      toast({
        title: "Invite Revoked",
        description: "The invitation has been cancelled",
      });
      fetchInvites();
    } else {
      toast({
        title: "Error",
        description: result.error || "Failed to revoke invite",
        variant: "destructive",
      });
    }
  };

  // Handle resend invite
  const handleResendInvite = async (inviteId: string) => {
    const result = await resendInvite(inviteId);
    
    if (result.success) {
      toast({
        title: "Invite Renewed",
        description: "The invitation expiry has been extended",
      });
      fetchInvites();
    } else {
      toast({
        title: "Error",
        description: result.error || "Failed to resend invite",
        variant: "destructive",
      });
    }
  };

  // Format date helper
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    try {
      return format(new Date(dateString), "MMM d, yyyy");
    } catch {
      return "Invalid date";
    }
  };

  const formatTimeAgo = (dateString: string | null) => {
    if (!dateString) return "Never";
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return "Unknown";
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-tabs for Users vs Invites */}
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              All Users ({users.length})
            </TabsTrigger>
            <TabsTrigger value="invites" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Pending Invites ({pendingInvites.length})
            </TabsTrigger>
          </TabsList>

          {activeSubTab === "users" && (
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>

              {/* Role Filter */}
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>

              {/* Refresh */}
              <Button variant="outline" size="icon" onClick={fetchUsers}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Users Tab Content */}
        <TabsContent value="users" className="mt-6">
          {isLoadingUsers ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Last Active</TableHead>
                    {isSuperAdmin && <TableHead className="w-[100px]">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isSuperAdmin ? 5 : 4} className="text-center py-8 text-muted-foreground">
                        No users found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{user.email}</span>
                            {user.full_name && (
                              <span className="text-sm text-muted-foreground">{user.full_name}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <RoleBadge role={user.role} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            {formatDate(user.created_at)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            {formatTimeAgo(user.last_sign_in_at)}
                          </div>
                        </TableCell>
                        {isSuperAdmin && (
                          <TableCell>
                            {user.role !== "super_admin" && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => handleRoleChange(
                                      user.id,
                                      user.role === "admin" ? "user" : "admin"
                                    )}
                                  >
                                    <Shield className="h-4 w-4 mr-2" />
                                    {user.role === "admin" 
                                      ? "Demote to User" 
                                      : "Promote to Admin"}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Invites Tab Content */}
        <TabsContent value="invites" className="mt-6">
          {isLoadingInvites ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : pendingInvites.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Mail className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">No pending invites</p>
              <p className="text-sm">
                Click "Invite User" to send invitations
              </p>
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Invited By</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Status</TableHead>
                    {isSuperAdmin && <TableHead className="w-[100px]">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingInvites.map((invite) => {
                    const isExpired = new Date(invite.expires_at) < new Date();
                    
                    return (
                      <TableRow key={invite.id}>
                        <TableCell className="font-medium">{invite.email}</TableCell>
                        <TableCell>
                          <RoleBadge role={invite.role} />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {invite.invited_by_email}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatTimeAgo(invite.created_at)}
                        </TableCell>
                        <TableCell>
                          <span className={isExpired ? "text-destructive" : "text-muted-foreground"}>
                            {isExpired ? "Expired" : formatTimeAgo(invite.expires_at)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {isExpired ? (
                            <span className="inline-flex items-center gap-1 text-sm text-destructive">
                              <XCircle className="h-4 w-4" />
                              Expired
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-sm text-amber-600 dark:text-amber-500">
                              <Clock className="h-4 w-4" />
                              Pending
                            </span>
                          )}
                        </TableCell>
                        {isSuperAdmin && (
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleResendInvite(invite.id)}>
                                  <RefreshCw className="h-4 w-4 mr-2" />
                                  Renew Invite
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleRevokeInvite(invite.id)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Revoke Invite
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default UsersTab;
