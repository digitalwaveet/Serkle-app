import { createImagePreviewHandler } from './handler.ts';

Deno.serve(createImagePreviewHandler(name => Deno.env.get(name)));
