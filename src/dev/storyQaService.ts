// No network writes are allowed from the isolated story QA workflow.
const denied = async () => { throw new Error('Simulated network failure. Your draft is preserved.'); };
export const storyService = new Proxy({}, { get: () => denied });
