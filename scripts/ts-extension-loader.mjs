// Vercel compiles NodeNext TypeScript imports with emitted .js specifiers (and
// bundled code may use extensionless imports). Node's native ESM strip-types
// test runner uses this tiny test-only resolver to map those back to .ts/.tsx.
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    const local = specifier.startsWith('.') || specifier.startsWith('/');
    if (local && specifier.endsWith('.js')) {
      const source = specifier.slice(0, -3);
      for (const extension of ['.ts', '.tsx']) {
        try {
          return await nextResolve(source + extension, context);
        } catch {
          // Try the next TypeScript source extension.
        }
      }
    }
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
