import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  rememberSession: z.boolean().default(false),
});

export const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().min(1, "Email is required").email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
  termsAccepted: z.boolean().refine((val) => val === true, "You must accept the terms of use"),
  privacyAcknowledged: z.boolean().refine((val) => val === true, "You must acknowledge the privacy policy"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export const forgotPasswordSchema = z.object({
  email: z.string().min(1, "Email is required").email("Please enter a valid email address"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export function validateLoginInput(input: Record<string, unknown>) {
  const result = loginSchema.safeParse(input);
  if (result.success) return { valid: true, errors: {} as Record<string, string[]> };
  const errors: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const field = issue.path.join(".");
    if (!errors[field]) errors[field] = [];
    errors[field].push(issue.message);
  }
  return { valid: false, errors };
}

export function validateSignupInput(input: Record<string, unknown>) {
  const result = signupSchema.safeParse(input);
  if (result.success) return { valid: true, errors: {} as Record<string, string[]> };
  const errors: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const field = issue.path.join(".");
    if (!errors[field]) errors[field] = [];
    errors[field].push(issue.message);
  }
  return { valid: false, errors };
}

export function validateForgotPasswordInput(input: Record<string, unknown>) {
  const result = forgotPasswordSchema.safeParse(input);
  if (result.success) return { valid: true, errors: {} as Record<string, string[]> };
  const errors: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const field = issue.path.join(".");
    if (!errors[field]) errors[field] = [];
    errors[field].push(issue.message);
  }
  return { valid: false, errors };
}

export function validateResetPasswordInput(input: Record<string, unknown>) {
  const result = resetPasswordSchema.safeParse(input);
  if (result.success) return { valid: true, errors: {} as Record<string, string[]> };
  const errors: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const field = issue.path.join(".");
    if (!errors[field]) errors[field] = [];
    errors[field].push(issue.message);
  }
  return { valid: false, errors };
}
