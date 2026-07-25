"use client";
import { Shield, ShieldCheck, ExternalLink } from "lucide-react";

interface TwoFactorStatusProps {
  isEnabled: boolean;
  onSetup?: () => void;
}

export function TwoFactorStatus({ isEnabled, onSetup }: TwoFactorStatusProps) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        {isEnabled ? (
          <ShieldCheck className="h-5 w-5 text-success" />
        ) : (
          <Shield className="h-5 w-5 text-muted-foreground" />
        )}
        <div>
          <p className="text-sm font-medium text-foreground">Two-factor authentication</p>
          <p className="text-xs text-muted-foreground">{isEnabled ? "Active" : "Not configured"}</p>
        </div>
      </div>
      {!isEnabled && onSetup && (
        <button type="button" onClick={onSetup} className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:text-primary/80">
          Setup <ExternalLink className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
