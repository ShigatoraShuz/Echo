"use client";
import { useId, useState } from "react";

interface ChangePasswordFormProps {
  onChangePassword: (currentPassword: string, newPassword: string, confirmPassword: string) => Promise<void>;
  isChanging: boolean;
  successMessage?: string | null;
}

export function ChangePasswordForm({ onChangePassword, isChanging, successMessage }: ChangePasswordFormProps) {
  const formId = useId();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!currentPassword) { setError("Current password is required"); return; }
    if (newPassword.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (newPassword !== confirmPassword) { setError("Passwords do not match"); return; }
    try {
      await onChangePassword(currentPassword, newPassword, confirmPassword);
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (changeError) {
      setError(changeError instanceof Error ? changeError.message : "Password could not be changed.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor={`${formId}-current-password`} className="text-sm font-medium text-foreground">Current password</label>
        <input id={`${formId}-current-password`} type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
      </div>
      <div>
        <label htmlFor={`${formId}-new-password`} className="text-sm font-medium text-foreground">New password</label>
        <input id={`${formId}-new-password`} type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
      </div>
      <div>
        <label htmlFor={`${formId}-confirm-password`} className="text-sm font-medium text-foreground">Confirm new password</label>
        <input id={`${formId}-confirm-password`} type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      {successMessage && !error && <p className="text-sm font-medium text-primary">{successMessage}</p>}
      <button type="submit" disabled={isChanging} className="rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{isChanging ? "Changing..." : "Change password"}</button>
    </form>
  );
}
