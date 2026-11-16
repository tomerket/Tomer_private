import express, { Router } from 'express';
import { memberOf, requireCaller } from '../auth.js';
import { db, PHOTO_BUCKET } from '../supabase.js';
import { handle, HttpError, parseBirthday, requireText } from '../util.js';

export const familyRouter = Router();

type MemberInput = { name: string; role: 'kid' | 'parent'; birthday: string; is_admin: boolean };

/** First login: create the family and its members in one transaction. Admin only, once. */
familyRouter.post(
  '/onboarding',
  requireCaller,
  handle(async (req, res) => {
    const caller = req.caller!;
    if (caller.kind !== 'admin' || !caller.userId) throw new HttpError(403, 'Only the family admin can do this');
    if (caller.member) throw new HttpError(409, 'Your family is already set up');

    const familyName = requireText(req.body?.familyName, 'Family name', 60);
    const adminName = requireText(req.body?.adminName, 'Admin name', 60);
    const raw: unknown[] = Array.isArray(req.body?.members) ? req.body.members : [];
    if (raw.length < 1 || raw.length > 20) throw new HttpError(400, 'Add between 1 and 20 family members');

    const members: MemberInput[] = raw.map((m: any, i) => {
      const role = m?.role;
      if (role !== 'kid' && role !== 'parent') throw new HttpError(400, `Member ${i + 1}: choose Kid or Parent`);
      return {
        name: requireText(m?.name, `Member ${i + 1} name`, 40),
        role,
        birthday: parseBirthday(m?.birthday),
        is_admin: i === 0, // the first member is always the admin
      };
    });

    if (members[0].name.toLowerCase() !== adminName.toLowerCase()) {
      throw new HttpError(400, 'The first family member must be the admin');
    }
    if (members[0].role !== 'parent') throw new HttpError(400, 'The admin must be a parent');
    const names = new Set(members.map((m) => m.name.toLowerCase()));
    if (names.size !== members.length) throw new HttpError(400, 'Each family member needs a different name');

    const { data, error } = await db().rpc('create_family', {
      p_owner: caller.userId,
      p_family_name: familyName,
      p_admin_name: adminName,
      p_members: members,
    });
    if (error) {
      if (error.code === '23505') {
        throw new HttpError(409, 'A family with this family name and admin name already exists. Try a different admin name.');
      }
      throw error;
    }
    res.status(201).json({ familyId: data });
  }),
);

const PHOTO_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** Upload / replace the family photo. Body is the raw image bytes. Admin only. */
familyRouter.post(
  '/family/photo',
  requireCaller,
  express.raw({ type: Object.keys(PHOTO_TYPES), limit: '4mb' }),
  handle(async (req, res) => {
    const me = memberOf(req);
    if (req.caller!.kind !== 'admin' || !me.is_admin) throw new HttpError(403, 'Only the family admin can change the photo');
    const type = (req.headers['content-type'] ?? '').split(';')[0];
    const ext = PHOTO_TYPES[type];
    if (!ext || !Buffer.isBuffer(req.body) || req.body.length === 0) {
      throw new HttpError(400, 'Please upload a JPG, PNG or WEBP image');
    }

    const { data: family } = await db().from('families').select('photo_path').eq('id', me.family_id).single();
    const path = `${me.family_id}/${Date.now()}.${ext}`;
    const { error: upErr } = await db().storage.from(PHOTO_BUCKET).upload(path, req.body, { contentType: type });
    if (upErr) throw upErr;
    const { error } = await db().from('families').update({ photo_path: path }).eq('id', me.family_id);
    if (error) throw error;
    if (family?.photo_path) await db().storage.from(PHOTO_BUCKET).remove([family.photo_path]);
    res.json({ ok: true });
  }),
);
