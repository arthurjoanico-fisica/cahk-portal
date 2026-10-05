import { createHandler } from './handler.js';
Deno.serve(createHandler({
  url: Deno.env.get('SUPABASE_URL') || '',
  serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
  origins: (Deno.env.get('CAHK_COMPLAINT_ORIGINS') || 'https://cahk.app,https://www.cahk.app').split(',').map(s => s.trim()).filter(Boolean),
}));
