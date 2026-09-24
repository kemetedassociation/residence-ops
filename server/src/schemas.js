import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(180),
  password: z.string().min(8).max(200),
  phone: z.string().trim().max(40).optional().default(""),
  residence_id: z.string().max(60).optional().nullable(),
  building_id: z.string().max(60).optional().nullable(),
  room: z.string().trim().max(40).optional().default(""),
  lease_number: z.string().trim().max(80).optional().nullable(),
  accepted_privacy: z.literal(true, {
    errorMap: () => ({ message: "Vous devez accepter la politique de confidentialité pour créer un compte." }),
  }),
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(180),
  password: z.string().min(1).max(200),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email().max(180),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8).max(200),
});

export const incidentCreateSchema = z.object({
  type: z.enum(["eau", "electricite", "securite", "bruit", "autre"]),
  title: z.string().trim().max(160).optional().default(""),
  building_id: z.string().max(60).optional().nullable(),
  floor: z.string().trim().max(20).optional().default(""),
  room: z.string().trim().max(120).optional().default(""),
  description: z.string().trim().min(5).max(2000),
  priority: z.enum(["urgent", "normal", "faible"]).optional().default("normal"),
  // Envoi sécurisé (/api/files/<id>) ou ancien envoi public (/uploads/<fichier>, images seulement).
  photo_urls: z
    .array(z.string().regex(/^\/(uploads\/[\w.-]{1,120}|api\/files\/[\w-]{10,40})$/, "Pièce jointe invalide."))
    .max(6)
    .optional()
    .default([]),
  photos_visibility: z.enum(["public", "private"]).optional(),
});

export const incidentPatchSchema = z.object({
  status: z.enum(["signale", "confirme", "en_cours", "resolu", "rejete"]).optional(),
  priority: z.enum(["urgent", "normal", "faible"]).optional(),
  assigned_to: z.string().max(60).nullable().optional(),
});

export const confirmationCreateSchema = z.object({
  incident_id: z.string().min(1).max(60),
});

export const interventionCreateSchema = z.object({
  incident_id: z.string().min(1).max(60),
  technician_id: z.string().max(60).optional().nullable(),
  scheduled_date: z.string().min(1),
  notes: z.string().trim().max(1000).optional().default(""),
});

export const interventionPatchSchema = z.object({
  status: z.enum(["planifiee", "en_cours", "terminee", "annulee"]).optional(),
  notes: z.string().trim().max(1000).optional(),
  scheduled_date: z.string().optional(),
});

export const postCreateSchema = z.object({
  title: z.string().trim().min(2).max(160),
  content: z.string().trim().min(2).max(4000),
  category: z.enum(["intervention", "reglementation", "travaux", "information", "alerte"]).optional().default("information"),
  pinned: z.boolean().optional().default(false),
  published: z.boolean().optional().default(true),
  cover_image_url: z.string().max(300).optional().nullable(),
});

export const postPatchSchema = postCreateSchema.partial();

export const feedbackCreateSchema = z.object({
  type: z.enum(["suggestion", "satisfaction"]).optional().default("suggestion"),
  title: z.string().trim().max(160).optional().default(""),
  message: z.string().trim().min(2).max(1000),
  rating: z.number().int().min(1).max(5).optional(),
  incident_id: z.string().max(60).optional().nullable(),
});

export const userPatchMeSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  room: z.string().trim().max(40).optional(),
  building_id: z.string().max(60).nullable().optional(),
  lease_number: z.string().trim().max(80).nullable().optional(),
});

export const leaseReviewSchema = z.object({
  lease_status: z.enum(["verified", "rejected", "none"]),
});

export const pushSubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
});

export const buildingCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  floors: z.number().int().min(1).max(200).optional().default(1),
});

export const buildingPatchSchema = buildingCreateSchema.partial();

export const residencePatchSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  address: z.string().trim().max(200).optional(),
  city: z.string().trim().max(120).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  display_name: z.string().trim().max(160).nullable().optional(),
  logo_url: z.string().trim().max(300).nullable().optional(),
  primary_color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "doit être une couleur hexadécimale, ex: #2563eb")
    .nullable()
    .optional(),
  plan: z.enum(["standard", "premium"]).optional(),
});

export const walletCreditSchema = z.object({
  amount_cents: z.number().int().positive().max(100000, "Montant maximum : 1000€ par opération."),
  reason: z.string().trim().min(2).max(200),
});

export const menuCreateSchema = z.object({
  menu_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "format de date attendu : AAAA-MM-JJ"),
  meal: z.enum(["midi", "soir"]),
  items: z.array(z.string().trim().min(1).max(120)).min(1).max(10),
});

export const menuPatchSchema = menuCreateSchema.partial();

export const reservationCreateSchema = z.object({
  menu_id: z.string().min(1).max(60),
  dish: z.string().trim().min(1).max(120),
  pay_with_card: z.boolean().optional().default(false),
});

export const DOCUMENT_TYPES = ["attestation_residence", "avis_echeance", "autre"];

const privateFileUrl = z.string().regex(/^\/api\/files\/[\w-]{10,40}$/, "Fichier invalide.");

export const documentCreateSchema = z.object({
  type: z.enum(DOCUMENT_TYPES),
  note: z.string().trim().max(500).optional().default(""),
  attachment_url: privateFileUrl.nullable().optional().default(null),
});

export const documentPatchSchema = z.object({
  status: z.enum(["demande", "en_traitement", "pret", "refuse"]).optional(),
  admin_note: z.string().trim().max(500).optional(),
  file_url: privateFileUrl.nullable().optional(),
});

export const slotCreateSchema = z.object({
  start_at: z.string().min(1),
  end_at: z.string().min(1),
});

export const appointmentCreateSchema = z.object({
  slot_id: z.string().min(1).max(60),
  note: z.string().trim().max(300).optional().default(""),
});

export const activityCreateSchema = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1000).optional().default(""),
  category: z.enum(["sport", "jeux", "projection", "soiree", "autre"]).optional().default("autre"),
  activity_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "format de date attendu : AAAA-MM-JJ"),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, "format d'heure attendu : HH:MM"),
  end_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "format d'heure attendu : HH:MM")
    .nullable()
    .optional()
    .default(null),
  location: z.string().trim().max(160).optional().default(""),
});

export const activityPatchSchema = activityCreateSchema.partial();
