import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Copy, Key } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const KeyPairGenerator = () => {
  const [publicKey, setPublicKey] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [jwk, setJwk] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const formatAsPem = (key: string, type: 'PUBLIC' | 'PRIVATE'): string => {
    const keyType = type === 'PUBLIC' ? 'PUBLIC KEY' : 'PRIVATE KEY';
    const pemKey = key.match(/.{1,64}/g)?.join('\n') || key;
    return `-----BEGIN ${keyType}-----\n${pemKey}\n-----END ${keyType}-----`;
  };

  const generateKeyPair = async () => {
    setIsGenerating(true);
    try {
      const keyPair = await window.crypto.subtle.generateKey(
        {
          name: 'RSASSA-PKCS1-v1_5',
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: 'SHA-384',
        },
        true,
        ['sign', 'verify']
      );

      // Export public key as JWK for ECW
      const exportedJwk = await window.crypto.subtle.exportKey('jwk', keyPair.publicKey);
      
      // Generate a random kid (key ID)
      const kid = crypto.randomUUID();

      // Format JWK according to ECW requirements
      const jwkSet = {
        keys: [
          {
            kty: exportedJwk.kty,
            alg: "RS384",
            n: exportedJwk.n,
            e: exportedJwk.e,
            use: "sig",
            key_ops: ["verify"],
            ext: true,
            kid: kid
          }
        ]
      };

      setJwk(JSON.stringify(jwkSet, null, 2));

      // Export keys as PEM
      const publicKeyData = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
      const privateKeyData = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

      const publicKeyBase64 = arrayBufferToBase64(publicKeyData);
      const privateKeyBase64 = arrayBufferToBase64(privateKeyData);

      const publicKeyPem = formatAsPem(publicKeyBase64, 'PUBLIC');
      const privateKeyPem = formatAsPem(privateKeyBase64, 'PRIVATE');

      setPublicKey(publicKeyPem);
      setPrivateKey(privateKeyPem);

      toast({
        title: 'Keys Generated',
        description: 'RSA key pair and JWK generated successfully. Copy and save them securely.',
      });
    } catch (error) {
      console.error('Error generating keys:', error);
      toast({
        title: 'Generation Failed',
        description: 'Failed to generate RSA key pair. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: 'Copied!',
        description: `${label} copied to clipboard.`,
      });
    } catch (error) {
      toast({
        title: 'Copy Failed',
        description: 'Failed to copy to clipboard.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          RSA Key Pair Generator
        </CardTitle>
        <CardDescription>
          Generate a 2048-bit RSA key pair for eClinicalWorks API authentication. 
          Register the public key with ECW and use the private key in your API connection settings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={generateKeyPair} 
          disabled={isGenerating}
          className="w-full"
        >
          {isGenerating ? 'Generating...' : 'Generate New Key Pair'}
        </Button>

        {jwk && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>JWK (Provide to ECW)</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(jwk, 'JWK')}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
            </div>
            <Textarea
              value={jwk}
              readOnly
              className="font-mono text-xs"
              rows={14}
            />
            <p className="text-xs text-muted-foreground">
              📋 Provide this JWK to ECW so they can verify your JWT signatures.
            </p>
          </div>
        )}

        {publicKey && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Public Key (PEM format)</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(publicKey, 'Public key')}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
            </div>
            <Textarea
              value={publicKey}
              readOnly
              className="font-mono text-xs"
              rows={8}
            />
          </div>
        )}

        {privateKey && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Private Key (Use in API Connection)</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(privateKey, 'Private key')}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
            </div>
            <Textarea
              value={privateKey}
              readOnly
              className="font-mono text-xs"
              rows={12}
            />
            <p className="text-xs text-muted-foreground">
              ⚠️ Warning: Never share your private key. Store it securely and use it in your ECW API connection settings.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
