import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { RekognitionClient, CreateCollectionCommand, DeleteFacesCommand, IndexFacesCommand, SearchFacesCommand } from 'npm:@aws-sdk/client-rekognition@3';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const maxBytes = 5 * 1024 * 1024;
const MATCH_THRESHOLD = 92;
const MATCH_MARGIN = 5;
const mime = new Set(['image/jpeg', 'image/png']);
const failure = (step: string, error: unknown) => console.error(`[photo-recognition] ${step}`, error);

async function imageBytes(file: File): Promise<Uint8Array> {
  if (!mime.has(file.type) || file.size === 0 || file.size > maxBytes) throw new Error('Use JPG or PNG photos under 5 MB each');
  return new Uint8Array(await file.arrayBuffer());
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  let step = 'initialization';
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const accessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID');
    const secretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY');
    const region = Deno.env.get('AWS_REGION');
    if (!url || !key) { failure(step, 'Backend service configuration missing'); return json({ available: false, code: 'BACKEND_NOT_CONFIGURED', error: 'Recognition storage is not configured. Review photos and mark members manually.' }); }
    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim();
    if (!token) return json({ error: 'Sign in to use face recognition' }, 401);
    step = 'session validation';
    const admin = createClient(url, key, { auth: { persistSession: false } });
    const { data: auth, error: authError } = await admin.auth.getUser(token);
    const uid = auth.user?.id;
    if (authError || !uid) { failure(step, authError ?? 'No authenticated user'); return json({ error: 'Invalid session' }, 401); }
    step = 'workspace role lookup';
    const { data: role, error: roleError } = await admin.from('user_roles').select('role,owner_id').eq('user_id', uid).maybeSingle();
    if (roleError || !role) { failure(step, roleError ?? 'Role not found'); return json({ error: 'Not authorized' }, 403); }
    const ownerId = role.role === 'owner' ? uid : role.owner_id;
    if (!ownerId) return json({ error: 'Not authorized' }, 403);
    const { data: perms } = role.role === 'staff'
      ? await admin.from('staff_permissions').select('is_active,can_customers,can_attendance').eq('staff_user_id', uid).eq('owner_id', ownerId).maybeSingle()
      : { data: null };
    if (role.role === 'staff' && !perms?.is_active) return json({ error: 'Not authorized' }, 403);
    console.info('[photo-recognition] Authenticated request', { role: role.role });
    const form = await req.formData();
    const action = form.get('action');
    if (action === 'enroll' && role.role !== 'owner' && !perms?.can_customers) return json({ error: 'Member editing permission required' }, 403);
    if (action === 'recognize' && role.role !== 'owner' && !perms?.can_attendance) return json({ error: 'Attendance permission required' }, 403);
    if (!accessKeyId || !secretAccessKey || !region) {
      failure('provider initialization', { code: 'AWS_CONFIGURATION_MISSING', missing: [!accessKeyId && 'AWS_ACCESS_KEY_ID', !secretAccessKey && 'AWS_SECRET_ACCESS_KEY', !region && 'AWS_REGION'].filter(Boolean) });
      return json({ available: false, code: 'AWS_CONFIGURATION_MISSING', error: 'Face recognition is not connected. Review photos and mark members manually.' });
    }
    console.info('[photo-recognition] Provider configuration present; initializing Amazon Rekognition', { region });
    const batchId = form.get('batchId');
    if (typeof batchId !== 'string' || !uuid.test(batchId)) return json({ error: 'Invalid batch' }, 400);
    step = 'batch authorization';
    const { data: batch, error: batchError } = await admin.from('batches').select('id').eq('id', batchId).eq('user_id', ownerId).maybeSingle();
    if (batchError || !batch) return json({ error: 'Batch not found' }, 404);
    const client = new RekognitionClient({ region, credentials: { accessKeyId, secretAccessKey } });
    // One private collection per workspace; no face identifiers or embeddings reach the browser.
    const collection = `trinetra-${ownerId}`;
    const ensureCollection = async () => {
      step = 'Rekognition collection initialization';
      console.info('[photo-recognition] Ensuring private collection');
      try { await client.send(new CreateCollectionCommand({ CollectionId: collection })); }
      catch (error) { if ((error as { name?: string }).name !== 'ResourceAlreadyExistsException') throw error; }
      console.info('[photo-recognition] Private collection ready');
    };
    if (action === 'enroll') {
      step = 'member authorization';
      const memberId = form.get('memberId');
      const path = form.get('photoPath');
      if (typeof memberId !== 'string' || !uuid.test(memberId) || typeof path !== 'string') return json({ error: 'Invalid member photo' }, 400);
      const { data: member, error } = await admin.from('students').select('id,photo_path,batch_id,assigned_staff_id').eq('id', memberId).eq('user_id', ownerId).eq('batch_id', batchId).maybeSingle();
      if (error || !member || member.photo_path !== path || !path.startsWith(`${ownerId}/${memberId}/`)) return json({ error: 'Member photo not found' }, 404);
      if (role.role === 'staff' && member.assigned_staff_id !== uid) return json({ error: 'Member not assigned to you' }, 403);
      step = 'private photo download';
      const { data: blob, error: downloadError } = await admin.storage.from('member-photos').download(path);
      if (downloadError || !blob) { failure(step, downloadError ?? 'No downloaded photo'); return json({ code: 'PHOTO_DOWNLOAD_FAILED', error: 'Could not read private member photo' }, 422); }
      console.info('[photo-recognition] Private member photo downloaded', { memberId, bytes: blob.size });
      const bytes = await imageBytes(new File([blob], 'reference', { type: blob.type }));
      await ensureCollection();
      step = 'reference face indexing';
      const indexed = await client.send(new IndexFacesCommand({ CollectionId: collection, Image: { Bytes: bytes }, ExternalImageId: memberId, MaxFaces: 2, QualityFilter: 'AUTO', DetectionAttributes: [] }));
      const faces = indexed.FaceRecords?.map((r) => r.Face?.FaceId).filter((id): id is string => !!id) ?? [];
      console.info('[photo-recognition] Reference face indexing complete', { memberId, faces: faces.length, rejected: indexed.UnindexedFaces?.length ?? 0 });
      if (faces.length !== 1 || (indexed.UnindexedFaces?.length ?? 0) > 0) {
        if (faces.length) await client.send(new DeleteFacesCommand({ CollectionId: collection, FaceIds: faces }));
        return json({ error: faces.length > 1 ? 'Multiple faces detected. Use a photo of only this member.' : 'No clear face detected. Please retake the member photo.' }, 422);
      }
      const faceId = faces[0];
      step = 'face enrollment lookup';
      const { data: old, error: oldError } = await admin.from('member_face_enrollments').select('provider_face_id').eq('student_id', memberId).maybeSingle();
      if (oldError) { await client.send(new DeleteFacesCommand({ CollectionId: collection, FaceIds: [faceId] })); throw oldError; }
      step = 'face enrollment save';
      const { error: saveError } = await admin.from('member_face_enrollments').upsert({ student_id: memberId, owner_id: ownerId, batch_id: batchId, photo_path: path, provider_face_id: faceId });
      if (saveError) { await client.send(new DeleteFacesCommand({ CollectionId: collection, FaceIds: [faceId] })); throw saveError; }
      console.info('[photo-recognition] Face identifier stored against member', { memberId, batchId });
      if (old?.provider_face_id && old.provider_face_id !== faceId) {
        try { await client.send(new DeleteFacesCommand({ CollectionId: collection, FaceIds: [old.provider_face_id] })); }
        catch (cleanupError) { console.error('Old face cleanup failed', cleanupError); }
      }
      return json({ enrolled: true });
    }
    if (action !== 'recognize') return json({ error: 'Invalid action' }, 400);
    const date = form.get('date');
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) return json({ error: 'Invalid date' }, 400);
    const photos = form.getAll('photos');
    if (!photos.length || photos.length > 10 || photos.some((p) => !(p instanceof File))) return json({ error: 'Add 1–10 photos' }, 400);
    const files = photos as File[];
    if (files.some((f) => !mime.has(f.type) || !f.size || f.size > maxBytes)) return json({ error: 'Use JPG or PNG photos under 5 MB each' }, 400);
    step = 'selected batch roster load';
    const { data: members, error: membersError } = await admin.from('students').select('id,photo_path,assigned_staff_id,batch_id').eq('user_id', ownerId).eq('batch_id', batchId);
    if (membersError) throw membersError;
    const eligible = (members ?? []).filter((m) => role.role === 'owner' || m.assigned_staff_id === uid);
    const ids = eligible.map((m) => m.id);
    if (!ids.length) return json({ error: 'No accessible members in this batch' }, 403);
    step = 'selected batch face enrollment load';
    const { data: enrolled, error: enrollmentError } = await admin.from('member_face_enrollments').select('student_id,photo_path,provider_face_id').eq('owner_id', ownerId).eq('batch_id', batchId).in('student_id', ids);
    if (enrollmentError) throw enrollmentError;
    const validFaces = new Map((enrolled ?? []).filter((e) => eligible.some((m) => m.id === e.student_id && m.photo_path === e.photo_path && m.batch_id === batchId)).map((e) => [e.provider_face_id, e.student_id]));
    console.info('[photo-recognition] Authorized reference faces loaded', { batchId, eligibleMembers: ids.length, enrolledFaces: validFaces.size });
    if (!validFaces.size) return json({ error: 'No enrolled face photos in this batch. Save member photos first.' }, 422);
    await ensureCollection();
    const candidates: { memberId: string; similarity: number }[] = [];
    let unknownFaces = 0;
    for (const file of files) {
      const temporary: string[] = [];
      try {
        step = 'group photo face detection';
        const indexed = await client.send(new IndexFacesCommand({ CollectionId: collection, Image: { Bytes: await imageBytes(file) }, ExternalImageId: crypto.randomUUID(), MaxFaces: 100, QualityFilter: 'AUTO', DetectionAttributes: [] }));
        console.info('[photo-recognition] Group photo detection complete', { faces: indexed.FaceRecords?.length ?? 0, rejected: indexed.UnindexedFaces?.length ?? 0 });
        unknownFaces += indexed.UnindexedFaces?.length ?? 0;
        for (const record of indexed.FaceRecords ?? []) {
          const faceId = record.Face?.FaceId;
          if (faceId) temporary.push(faceId);
        }
        for (const faceId of temporary) {
          step = 'selected batch face comparison';
          const searched = await client.send(new SearchFacesCommand({ CollectionId: collection, FaceId: faceId, FaceMatchThreshold: MATCH_THRESHOLD, MaxFaces: 100 }));
          const matches = (searched.FaceMatches ?? []).map((m) => ({ memberId: validFaces.get(m.Face?.FaceId ?? ''), similarity: m.Similarity ?? 0 })).filter((m): m is { memberId: string; similarity: number } => !!m.memberId).sort((a, b) => b.similarity - a.similarity);
          if (!matches.length || (matches[1] && matches[0].similarity - matches[1].similarity < MATCH_MARGIN)) unknownFaces++;
          else candidates.push(matches[0]);
        }
      } finally {
        if (temporary.length) {
          try { await client.send(new DeleteFacesCommand({ CollectionId: collection, FaceIds: temporary })); }
          catch (cleanupError) { failure('temporary face cleanup', cleanupError); throw cleanupError; }
        }
      }
    }
    const best = new Map<string, number>();
    for (const match of candidates) best.set(match.memberId, Math.max(best.get(match.memberId) ?? 0, match.similarity));
    console.info('[photo-recognition] Selected batch matching complete', { matchedMembers: best.size, unknownFaces });
    return json({ matches: [...best].map(([memberId, similarity]) => ({ memberId, similarity: Math.round(similarity * 10) / 10 })), unknownFaces });
  } catch (error) {
    failure(step, error);
    return json({ code: 'RECOGNITION_STEP_FAILED', error: `Face recognition failed during ${step}. Review photos and mark members manually.` }, 503);
  }
});
