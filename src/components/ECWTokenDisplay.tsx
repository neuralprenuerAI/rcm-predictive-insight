import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Copy, Check, Key } from "lucide-react";
import { toast } from "sonner";

interface ECWTokenDisplayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tokenData: {
    access_token: string;
    token_type: string;
    expires_in: number;
    scope: string;
  } | null;
}

export default function ECWTokenDisplay({ open, onOpenChange, tokenData }: ECWTokenDisplayProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  if (!tokenData) return null;

  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            eClinicalWorks Access Token
          </DialogTitle>
          <DialogDescription>
            Use this token to authenticate FHIR API requests
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Token Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium mb-1">Token Type</p>
                <p className="text-sm text-muted-foreground font-mono">{tokenData.token_type}</p>
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Scope</p>
                <p className="text-sm text-muted-foreground font-mono">{tokenData.scope}</p>
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Expires In</p>
                <p className="text-sm text-muted-foreground">
                  {tokenData.expires_in} seconds ({expiresAt.toLocaleTimeString()})
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Access Token</CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(tokenData.access_token)}
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
              <CardDescription>
                Include this in the Authorization header as "Bearer [token]"
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-muted p-3 rounded-md">
                <code className="text-xs break-all">{tokenData.access_token}</code>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Usage Example</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-muted p-3 rounded-md">
                <pre className="text-xs overflow-x-auto">
{`curl -X GET \\
  'https://fhir.eclinicalworks.com/...' \\
  -H 'Authorization: Bearer ${tokenData.access_token.substring(0, 20)}...'`}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
