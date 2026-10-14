type ErrorLike = {
  message?: string;
  name?: string;
  code?: string;
  status?: number;
};

const asErrorLike = (error: unknown): ErrorLike =>
  typeof error === "object" && error !== null ? error as ErrorLike : {};

export const authErrorMessage = (error: unknown): string => {
  const value = asErrorLike(error);
  const message = (value.message ?? "").toLowerCase();
  const code = (value.code ?? value.name ?? "").toLowerCase();

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return "You are offline. Reconnect to the internet and try again.";
  }
  if (code.includes("email_not_confirmed") || message.includes("email not confirmed")) {
    return "Your email isn't confirmed yet. Check your inbox for the confirmation link, or resend it below.";
  }
  if (message.includes("invalid login") || message.includes("invalid credentials")) {
    return "The email or password is incorrect.";
  }
  if (message.includes("user already registered") || message.includes("already registered")) {
    return "An account with this email already exists. Try signing in instead.";
  }
  if (code.includes("over_email_send_rate_limit") || value.status === 429 || message.includes("rate limit")) {
    return "Too many attempts. Please wait a few minutes and try again.";
  }
  if (message.includes("password") && message.includes("weak")) {
    return "Password is too weak. Please use at least 4 characters.";
  }
  if (
    code.includes("functionsfetcherror") ||
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("load failed")
  ) {
    return "The sign-in service cannot be reached right now. Please try again shortly. If it continues, the service may be paused.";
  }
  if (value.status === 404 || code.includes("functionsrelayerror")) {
    return "Phone sign-in is not available right now. Please sign in with your email or try again later.";
  }
  if (value.status !== undefined && value.status >= 500) {
    return "The sign-in service is temporarily unavailable. Please try again shortly.";
  }
  return value.message || "Sign-in failed. Please try again.";
};

export const readFunctionError = async (error: unknown): Promise<string> => {
  const value = error as { context?: Response } | null;
  const response = value?.context;
  if (response instanceof Response) {
    try {
      const payload = await response.clone().json() as { error?: unknown };
      if (typeof payload.error === "string" && payload.error.trim()) return payload.error;
    } catch {
      // The shared mapper below handles non-JSON and unreachable responses.
    }
  }
  return authErrorMessage(error);
};