// Vercel bundles extensionless TypeScript imports. Node's native ESM resolver
// does not, so the strip-types test runner uses this tiny test-only fallback.
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    const local = specifier.startsWith('.') || specifier.startsWith('/');
    const alreadyHasExtension = /\.[cm]?[jt]sx?(?:[?#]|$)/i.test(specifier);
    if (local && !alreadyHasExtension) {
      for (const extension of ['.ts', '.tsx']) {
        try {
          return await nextResolve(specifier + extension, context);
        } catch {
          // Try the next TypeScript extension before returning the original error.
        }
      }
    }
    throw error;
  }
}
