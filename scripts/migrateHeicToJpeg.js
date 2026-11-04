import { createClient } from '@supabase/supabase-js';
import convert from 'heic-convert';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: Please provide VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env file.');
  console.error('The Service Role key is required for Admin Storage operations (delete/upload).');
  // Don't exit immediately if we want to show the specific missing key
  if (!SUPABASE_URL) console.error('- Missing: VITE_SUPABASE_URL');
  if (!SUPABASE_SERVICE_ROLE_KEY) console.error('- Missing: SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const BUCKET = 'post-media';
const BATCH_SIZE = 5;
const DELAY_MS = 500;
const DRY_RUN = process.argv.includes('--dry-run');

async function listAllHeicFiles(prefix = '') {
  const allFiles = [];
  
  async function recurse(pathPrefix) {
    const { data, error } = await supabase.storage.from(BUCKET).list(pathPrefix);
    
    if (error) {
      console.error(`Error listing files in ${pathPrefix}:`, error.message);
      return;
    }

    for (const item of data) {
      const fullPath = pathPrefix ? `${pathPrefix}/${item.name}` : item.name;
      
      if (!item.id) {
        // It's a folder (Supabase storage returns no id or specific metadata for directories)
        await recurse(fullPath);
      } else if (item.name.toLowerCase().endsWith('.heic') || item.name.toLowerCase().endsWith('.heif')) {
        allFiles.push(fullPath);
      }
    }
  }

  await recurse(prefix);
  return allFiles;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function migrateFile(filePath) {
  const newPath = filePath.replace(/\.(heic|heif)$/i, '.jpg');

  if (DRY_RUN) {
    console.log(`[DRY RUN] Would migrate: ${filePath} -> ${newPath}`);
    return { success: true, dryRun: true };
  }

  try {
    console.log(`[Processing] ${filePath}...`);

    // 1. Download
    const { data: blob, error: downloadError } = await supabase.storage.from(BUCKET).download(filePath);
    if (downloadError) throw new Error(`Download failed: ${downloadError.message}`);

    // 2. Convert
    const buffer = Buffer.from(await blob.arrayBuffer());
    const outputBuffer = await convert({
      buffer: buffer,
      format: 'JPEG',
      quality: 0.88
    });

    // 3. Upload new JPEG
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(newPath, outputBuffer, {
      contentType: 'image/jpeg',
      upsert: true
    });
    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    // 4. Update Database
    const oldUrlSearch = filePath;
    
    // a. Update media_url and media_urls
    const { data: directPosts, error: directError } = await supabase
      .from('posts')
      .select('id, media_url, media_urls')
      .or(`media_url.ilike.%${oldUrlSearch}%,media_urls.cs.{"${oldUrlSearch}"}`);
    
    if (directError) console.warn(`Warning: Could not search database for ${filePath}:`, directError.message);

    if (directPosts && directPosts.length > 0) {
      for (const post of directPosts) {
        let updatedData = {};
        
        if (post.media_url && post.media_url.includes(oldUrlSearch)) {
          updatedData.media_url = post.media_url.replace(filePath, newPath);
        }

        if (post.media_urls && Array.isArray(post.media_urls)) {
          updatedData.media_urls = post.media_urls.map(url => 
            url.includes(oldUrlSearch) ? url.replace(filePath, newPath) : url
          );
        }

        if (Object.keys(updatedData).length > 0) {
          const { error: updateError } = await supabase
            .from('posts')
            .update(updatedData)
            .eq('id', post.id);
          
          if (updateError) console.error(`Failed to update post ${post.id}:`, updateError.message);
        }
      }
    }

    // 5. Delete original
    const { error: removeError } = await supabase.storage.from(BUCKET).remove([filePath]);
    if (removeError) console.warn(`Warning: Could not remove old file ${filePath}:`, removeError.message);

    return { success: true };
  } catch (err) {
    console.error(`[Error] Failed to migrate ${filePath}:`, err.message);
    return { success: false, error: err.message };
  }
}

async function main() {
  console.log('--- HEIC to JPEG Migration Script ---');
  if (DRY_RUN) console.log('Mode: DRY RUN (No changes will be made)');
  
  console.log('Scanning for HEIC/HEIF files...');
  const files = await listAllHeicFiles();
  
  console.log(`Found ${files.length} files to migrate.`);
  
  if (files.length === 0) {
    console.log('Nothing to do. Exiting.');
    return;
  }

  const results = {
    total: files.length,
    success: 0,
    failed: 0,
    skipped: 0
  };

  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    console.log(`\nProcessing batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} files)...`);
    
    const batchResults = await Promise.allSettled(batch.map(f => migrateFile(f)));
    
    batchResults.forEach(r => {
      if (r.status === 'fulfilled' && r.value?.success) {
        results.success++;
      } else {
        results.failed++;
      }
    });

    if (i + BATCH_SIZE < files.length) {
      await sleep(DELAY_MS);
    }
  }

  console.log('\n--- Migration Summary ---');
  console.log(`Total Found: ${results.total}`);
  console.log(`Succeeded:   ${results.success}`);
  console.log(`Failed:      ${results.failed}`);
  if (DRY_RUN) console.log('Note: This was a DRY RUN. No files were actually modified.');
  console.log('---------------------------');
}

main().catch(err => {
  console.error('Fatal error in migration script:', err);
  process.exit(1);
});
