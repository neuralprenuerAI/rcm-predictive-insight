import { supabase } from "@/integrations/supabase/client";

export interface Invite {
  id: string;
  email: string;
  role: "super_admin" | "admin" | "user";
  invited_by: string;
  invited_by_email: string | null;
  invite_token: string;
  expires_at: string;
  accepted_at: string | null;
  status: "pending" | "accepted" | "expired" | "revoked";
  created_at: string;
}

export interface CreateInviteParams {
  email: string;
  role: "admin" | "user";
}

// Create a new invite
export async function createInvite({ email, role }: CreateInviteParams): Promise<{ success: boolean; error?: string; invite?: Invite }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Check if email already has an account
    const { data: existingRole } = await supabase
      .from("user_roles")
      .select("email")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    if (existingRole) {
      return { success: false, error: "This email already has an account" };
    }

    // Check if there's already a pending invite
    const { data: existingInvite } = await supabase
      .from("pending_invites")
      .select("*")
      .eq("email", email.toLowerCase())
      .eq("status", "pending")
      .maybeSingle();

    if (existingInvite) {
      return { success: false, error: "An invite is already pending for this email" };
    }

    // Create the invite
    const { data: invite, error } = await supabase
      .from("pending_invites")
      .insert({
        email: email.toLowerCase(),
        role,
        invited_by: user.id,
        invited_by_email: user.email,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating invite:", error);
      return { success: false, error: error.message };
    }

    return { success: true, invite: invite as Invite };
  } catch (err: any) {
    console.error("Error in createInvite:", err);
    return { success: false, error: err.message };
  }
}

// Get all invites (for admin view)
export async function getInvites(): Promise<Invite[]> {
  const { data, error } = await supabase
    .from("pending_invites")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching invites:", error);
    return [];
  }

  return (data || []) as Invite[];
}

// Check if an email has a valid invite
export async function checkInvite(email: string): Promise<{ isInvited: boolean; role?: string }> {
  const { data, error } = await supabase
    .from("pending_invites")
    .select("role")
    .eq("email", email.toLowerCase())
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error || !data) {
    return { isInvited: false };
  }

  return { isInvited: true, role: data.role };
}

// Revoke an invite (super_admin only)
export async function revokeInvite(inviteId: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("pending_invites")
    .update({ status: "revoked" })
    .eq("id", inviteId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

// Resend invite (update expiry)
export async function resendInvite(inviteId: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("pending_invites")
    .update({ 
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: "pending"
    })
    .eq("id", inviteId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

// Generate invite link
export function generateInviteLink(inviteToken: string): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/auth?invite=${inviteToken}`;
}
