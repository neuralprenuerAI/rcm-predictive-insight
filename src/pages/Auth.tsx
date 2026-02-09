import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { checkInvite } from "@/lib/inviteService";
import { Lock, CheckCircle2, Mail, AlertCircle } from "lucide-react";

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite");
  
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [activeTab, setActiveTab] = useState("signin");
  
  // Invite-related state
  const [hasInvite, setHasInvite] = useState(false);
  const [inviteChecked, setInviteChecked] = useState(false);
  const [checkingInvite, setCheckingInvite] = useState(false);
  const [inviteRole, setInviteRole] = useState<string | undefined>();

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate("/");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // If there's an invite token in URL, switch to signup tab
  useEffect(() => {
    if (inviteToken) {
      setHasInvite(true);
      setActiveTab("signup");
    }
    setInviteChecked(true);
  }, [inviteToken]);

  // Check if email has an invite
  const checkEmailInvite = async (emailToCheck: string) => {
    if (!emailToCheck || emailToCheck.length < 5) {
      setHasInvite(false);
      setInviteRole(undefined);
      return;
    }
    
    setCheckingInvite(true);
    try {
      const result = await checkInvite(emailToCheck);
      setHasInvite(result.isInvited);
      setInviteRole(result.role);
    } catch (err) {
      console.error("Error checking invite:", err);
    } finally {
      setCheckingInvite(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!hasInvite) {
      toast.error("You need an invitation to sign up. Please contact an administrator.");
      return;
    }
    
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${window.location.origin}/`
        }
      });

      if (error) throw error;

      toast.success("Account created successfully! Please check your email.");
      setEmail("");
      setPassword("");
      setFullName("");
    } catch (error: any) {
      toast.error(error.message || "Failed to create account");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast.success("Signed in successfully!");
    } catch (error: any) {
      console.error("Sign in error:", error);
      toast.error(error.message || "Failed to sign in. Please check your credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthLogin = async (provider: 'google' | 'github') => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });

      if (error) throw error;
    } catch (error: any) {
      console.error("OAuth error:", error);
      toast.error(error.message || `Failed to sign in with ${provider}`);
    }
  };

  const handleMagicLink = async () => {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });
      if (error) throw error;
      toast.success("Magic link sent! Check your email.");
    } catch (error: any) {
      console.error("Magic link error:", error);
      toast.error(error.message || "Failed to send magic link");
    }
  };

  const handlePasswordReset = async () => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/`,
      });
      if (error) throw error;
      toast.success("Password reset email sent. Check your inbox.");
    } catch (error: any) {
      console.error("Password reset error:", error);
      toast.error(error.message || "Failed to send reset email");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Healthcare RCM</CardTitle>
          <CardDescription>Sign in to manage your claims</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Signing in..." : "Sign In"}
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      Or continue with
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleOAuthLogin('google')}
                    disabled={isLoading}
                  >
                    Google
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleOAuthLogin('github')}
                    disabled={isLoading}
                  >
                    GitHub
                  </Button>
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={handleMagicLink}
                  disabled={!email || isLoading}
                >
                  Email magic link
                </Button>
                <Button
                  type="button"
                  variant="link"
                  className="w-full text-muted-foreground"
                  onClick={handlePasswordReset}
                  disabled={!email || isLoading}
                >
                  Forgot password? Send reset link
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              {/* If no invite, show Request Access message */}
              {!hasInvite && inviteChecked && (
                <div className="space-y-6 py-4">
                  <div className="text-center space-y-2">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900">
                      <Lock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                    </div>
                    <h3 className="text-lg font-semibold">Invitation Required</h3>
                    <p className="text-sm text-muted-foreground">
                      This application requires an invitation to sign up. 
                      Please contact an administrator to request access.
                    </p>
                  </div>
                  
                  <div className="border-t pt-4 space-y-3">
                    <p className="text-sm font-medium">Already have an invite?</p>
                    <p className="text-xs text-muted-foreground">
                      Check your email for the invite link, or enter your invited email below:
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="check-email">Check if you have an invite</Label>
                    <div className="flex gap-2">
                      <Input
                        id="check-email"
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          checkEmailInvite(e.target.value);
                        }}
                      />
                    </div>
                    {checkingInvite && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3 animate-pulse" />
                        Checking...
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                    <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      If you already have an account, use the Sign In tab.
                    </p>
                  </div>
                </div>
              )}

              {/* If has invite, show normal signup form */}
              {hasInvite && (
                <form onSubmit={handleSignUp} className="space-y-4">
                  {/* Invite confirmation badge */}
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-green-800 dark:text-green-300">
                        Invite Found!
                      </p>
                      <p className="text-xs text-green-600 dark:text-green-400">
                        You can create your account below.
                        {inviteRole && ` You'll be assigned the "${inviteRole}" role.`}
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        // Re-check invite when email changes
                        if (!inviteToken) {
                          checkEmailInvite(e.target.value);
                        }
                      }}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Creating account..." : "Sign Up"}
                  </Button>
                </form>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
