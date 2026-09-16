/** Mirrors supabase/schema.sql. */

export type ListKind =
  | "service_category"
  | "inquiry_source"
  | "zone"
  | "vehicle_type"
  | "partnership_status"
  | "partnership_tier";

export const JOB_STATUSES = [
  "Inquiry",
  "Quoted",
  "Booked",
  "Completed",
  "Cancelled",
  "Lost",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const CUSTOMER_TYPES = ["Residential", "Commercial"] as const;
export type CustomerType = (typeof CUSTOMER_TYPES)[number];

export const ENTITY_STATUSES = ["Active", "Inactive"] as const;
export type EntityStatus = (typeof ENTITY_STATUSES)[number];

export const AUDIENCES = ["Customer", "Worker"] as const;
export type Audience = (typeof AUDIENCES)[number];

export const INQUIRY_FOR_OPTIONS = ["Themselves", "A Friend"] as const;
export type InquiryFor = (typeof INQUIRY_FOR_OPTIONS)[number];

export type ListItem = {
  id: string;
  kind: ListKind;
  name: string;
  description: string | null;
  sort_order: number;
  archived: boolean;
};

export type Settings = {
  id: boolean;
  default_pos_fee_percent: number;
  /** Dispatcher commission: percent of worker payout, capped in dollars. */
  default_commission_percent: number;
  default_commission_cap: number;
  monthly_jobs_goal: number;
  daily_inquiries_goal: number;
  daily_partnerships_goal: number;
  /** 0=Sunday..6=Saturday. The home screen's "Next payout" sums commission from this weekday through today. */
  pay_period_start_day: number;
  /** Work Face to Face: conversations-per-day target. Resets with the calendar day. */
  face_to_face_daily_goal: number;
  /** Per-token color overrides from the Appearance settings screen. Empty object = shipped defaults. */
  theme_overrides: Record<string, string>;
};

export type MessageTemplate = {
  id: string;
  template_name: string;
  audience: Audience;
  body: string;
  sort_order: number;
};

export type Entity = {
  id: string;
  entity_name: string;
  roster_size: number;
  worker_names: string[];
  poc_name: string | null;
  poc_phone: string | null;
  status: EntityStatus;
  zone_id: string | null;
  vehicle_type_ids: string[];
  ic_agreement_link: string | null;
  photo_id_link: string | null;
  equipment_photos_link: string | null;
  availability_note: string | null;
  availability_updated_at: string | null;
  reliability_notes: string | null;
  notes: string | null;
  created_at: string;
};

export type EntityReference = {
  id: string;
  entity_id: string;
  reference_name: string | null;
  reference_phone: string | null;
  service_category_id: string | null;
  verified: boolean;
  sort_order: number;
};

export type EntityRate = {
  id: string;
  entity_id: string;
  service_category_id: string;
  regular_rate: number;
  travel_rate: number;
  other_rate: number;
};

export type EntityFee = {
  id: string;
  entity_id: string;
  fee_name: string | null;
  description: string | null;
  amount: number;
  sort_order: number;
};

export type EntityEquipment = {
  id: string;
  entity_id: string;
  item_name: string | null;
  quantity: number;
  notes: string | null;
  sort_order: number;
};

export type EntityAvailability = {
  id: string;
  entity_id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
};

/** Backs the autocomplete on the entity Equipment section. Editable in Settings. */
export type EquipmentPreset = {
  id: string;
  item_name: string;
  default_note: string | null;
  category: string;
  sort_order: number;
  archived: boolean;
};

export type EntityFull = Entity & {
  entity_references: EntityReference[];
  entity_rates: EntityRate[];
  entity_fees: EntityFee[];
  entity_equipment: EntityEquipment[];
  entity_availability: EntityAvailability[];
};

export type Partnership = {
  id: string;
  business_name: string;
  address: string | null;
  zone_id: string | null;
  status_id: string | null;
  tier_id: string | null;
  poc_name: string | null;
  poc_phone: string | null;
  poc_email: string | null;
  secondary_poc_name: string | null;
  secondary_poc_phone: string | null;
  secondary_poc_email: string | null;
  last_visit: string | null;
  cards_dropped_last_visit: number;
  total_cards_dropped: number;
  fliers_dropped_last_visit: number;
  total_fliers_dropped: number;
  last_contact: string | null;
  follow_up_days: number | null;
  notes: string | null;
  created_at: string;
};

export type Job = {
  id: string;
  job_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_type: CustomerType | null;
  service_category_id: string | null;
  inquiry_source_id: string | null;
  partnership_id: string | null;
  zone_id: string | null;
  status: JobStatus;
  date_of_invoice: string | null;
  arrival_date: string | null;
  arrival_time: string | null;
  estimated_duration_minutes: number | null;
  addresses: string[];
  total_invoice_paid: number;
  pos_fee_percent: number;
  other_job_costs: number;
  /** Dispatcher commission on this job: percent of worker payout, capped in dollars. */
  commission_percent: number;
  commission_cap: number;
  total_worker_payout_override: number | null;
  invoice_ref: string | null;
  notes: string | null;
  google_calendar_event_id: string | null;
  created_at: string;
};

export type JobWorkerFee = {
  id: string;
  job_worker_id: string;
  description: string | null;
  amount: number;
  sort_order: number;
};

export type JobWorker = {
  id: string;
  job_id: string;
  entity_id: string | null;
  regular_hours: number;
  regular_rate: number;
  travel_hours: number;
  travel_rate: number;
  other_hours: number;
  other_rate: number;
  total_pay_override: number | null;
  sort_order: number;
  job_worker_fees: JobWorkerFee[];
};

export type JobFull = Job & {
  job_workers: JobWorker[];
};

/** Rows from the `job_financials` view. */
export type JobFinancials = {
  job_id: string;
  calculated_worker_payout: number;
  total_worker_payout: number;
  pos_fee_amount: number;
  total_job_costs: number;
  /** Dispatcher's take: percent of worker payout, capped in dollars. Not a profit/loss figure. */
  commission_amount: number;
  week_of: string | null;
  month: string | null;
  repeat_customer: boolean;
};

/**
 * Work Face to Face: standalone in-person outreach log. Not read by any
 * other screen yet — the dashboard/reports figures are untouched.
 *
 * A session is one outreach stretch (an afternoon of door-knocking, etc.).
 * `ended_at` null means it's the active session — there is only ever one at
 * a time.
 */
export type FaceToFaceSession = {
  id: string;
  started_at: string;
  ended_at: string | null;
  conversation_goal: number;
  committed_hours: number;
  zone_id: string | null;
  created_at: string;
};

/**
 * Time clock: one clock-in/clock-out entry. `clocked_out_at` null means it's
 * the active entry — there is only ever one at a time. `notes` is asked for
 * at clock-out ("what did you accomplish").
 */
export type TimeEntry = {
  id: string;
  clocked_in_at: string;
  clocked_out_at: string | null;
  notes: string | null;
  created_at: string;
};

export type FaceToFaceConversation = {
  id: string;
  occurred_at: string;
  /** Null only for the handful of conversations logged before sessions existed. */
  session_id: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  inquiry_for: InquiryFor | null;
  service_category_id: string | null;
  zone_id: string | null;
  cards_given: number;
  intent_level: number;
  notes: string | null;
  created_at: string;
};
