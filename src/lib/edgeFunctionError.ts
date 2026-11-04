/** Supabase puts a rejected function's response on error.context. Preserve the
 * original response while reading its public error message for the wallet UI. */
export async function edgeFunctionErrorMessage(error: unknown): Promise<string> {
  const details = error as { message?: unknown; context?: unknown } | null;
  if (details?.context instanceof Response) {
    try {
      const body = await details.context.clone().json();
      for (const message of [body?.error, body?.message, body?.msg]) {
        if (typeof message === 'string' && message.trim()) return message.trim();
      }
    } catch {
      // Network/gateway responses may have no JSON body or an already-used body.
    }
  }
  return typeof details?.message === 'string' && details.message.trim()
    ? details.message.trim()
    : 'Request failed. Please try again.';
}
