// Supabase equivalent of server/src/routes/assets.js. Admin-only, same as tasks.js.
import { supabase } from '../supabaseClient.js';
import { getUser } from '../auth.js';
import { logAudit } from './audit.js';

export const STATUSES = ['in_service', 'under_repair', 'in_storage', 'retired'];

export async function listAssets({ q, status } = {}) {
  let query = supabase
    .from('assets')
    .select('id,asset_tag,type,brand,model,serial_number,status,created_at,department:department_id(name)')
    .order('created_at', { ascending: false })
    .limit(500);
  if (STATUSES.includes(status)) query = query.eq('status', status);
  if (q) query = query.or(`asset_tag.ilike.%${q}%,brand.ilike.%${q}%,model.ilike.%${q}%,serial_number.ilike.%${q}%,type.ilike.%${q}%`);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

// No server-side sequence to draw from anymore, so a blank tag gets a short
// unique code instead of a strictly sequential one — good enough for a device tag.
function generateTag() {
  return `KMA-${Date.now().toString(36).toUpperCase()}`;
}

export async function createAsset(fields) {
  const type = (fields.type || '').trim();
  if (!type) throw new Error('Device type is required');
  const status = STATUSES.includes(fields.status) ? fields.status : 'in_service';
  const asset_tag = (fields.asset_tag || '').trim() || generateTag();

  const { data: a, error } = await supabase
    .from('assets')
    .insert({
      asset_tag, type,
      brand: fields.brand || null,
      model: fields.model || null,
      serial_number: fields.serial_number || null,
      department_id: fields.department_id || null,
      status,
      brought_in_by: fields.brought_in_by || null,
      notes: fields.notes || null,
    })
    .select()
    .single();
  if (error) throw new Error(error.code === '23505' ? 'That asset tag already exists' : error.message);

  await supabase.from('asset_history').insert({
    asset_id: a.id, event: 'Registered',
    notes: fields.brought_in_by ? `Brought in by ${fields.brought_in_by}` : null,
    performed_by: getUser().id,
  });
  await logAudit('create', 'asset', a.id, { asset_tag });
  return a;
}

export async function getAssetDetail(id) {
  const { data: asset, error } = await supabase
    .from('assets')
    .select('*, department:department_id(name)')
    .eq('id', id)
    .single();
  if (error) throw new Error(error.code === 'PGRST116' ? 'Asset not found' : error.message);

  const { data: history } = await supabase
    .from('asset_history')
    .select('id,event,notes,created_at,performer:performed_by(full_name)')
    .eq('asset_id', id)
    .order('created_at', { ascending: false });

  return { asset, history: history || [] };
}

export async function updateAsset(asset, patch) {
  if (patch.status && !STATUSES.includes(patch.status)) throw new Error('Invalid status');
  const { data: a, error } = await supabase.from('assets').update(patch).eq('id', asset.id).select().single();
  if (error) throw new Error(error.message);

  if (patch.status && patch.status !== asset.status) {
    await supabase.from('asset_history').insert({
      asset_id: a.id,
      event: `Status: ${asset.status.replace('_', ' ')} to ${a.status.replace('_', ' ')}`,
      performed_by: getUser().id,
    });
  }
  await logAudit('update', 'asset', a.id);
  return a;
}

export async function addHistory(assetId, { event, notes, status }) {
  event = (event || '').trim();
  if (!event) throw new Error('Describe the event');
  if (status && !STATUSES.includes(status)) throw new Error('Invalid status');

  const { data: h, error } = await supabase
    .from('asset_history')
    .insert({ asset_id: assetId, event, notes: notes || null, performed_by: getUser().id })
    .select('id,event,notes,created_at,performer:performed_by(full_name)')
    .single();
  if (error) throw new Error(error.message);

  if (status) await supabase.from('assets').update({ status }).eq('id', assetId);
  await logAudit('history', 'asset', assetId, { event });
  return h;
}
