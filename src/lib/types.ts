/** Mirrors supabase/schema.sql. */

export type ListKind =
  | "service_category"
  | "inquiry_source"
  | "zone"
  | "vehicle_type"
  | "partnership_status"
  | "partnership_tier"
  | "conversation_outcome";

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

export type ListItem = {
  id: string;
  kind: ListKind;
  name: string;
  description: string | null;
  /** conversation_outcome only: pre-fills a conversation's intent level when this outcome is picked. */
  default_intent_level: number | null;
  /** service_category only: pre-fills a job's Details when this category is picked and Details is empty. */
  details_template: string | null;
  /** service_category only: null = top-level category, set = a subcategory under that category. */
  parent_id: string | null;
  sort_order: number;
  archived: boolean;
};

export type Settings = {
  id: boolean;
  default_pos_fee_percent: number;
  /** Dispatcher commission: a flat percent of worker payout. Fixed for every job. */
  default_commission_percent: number;
  /** Percent held back when transferring a worker's calculated pay to them — the real cost of moving the money. */
  transfer_fee_percent: number;
  /** Real-world deduction (e.g. card processing) taken before an invoice amount is actually deposited — feeds the real commission calculation. */
  deposit_fee_percent: number;
  monthly_jobs_goal: number;
  daily_inquiries_goal: number;
  daily_partnerships_goal: number;
  /** 0=Sunday..6=Saturday. The home screen's "Next payout" sums commission from this weekday through today. */
  pay_period_start_day: number;
  /** Work Face to Face: conversations-per-day target. Resets with the calendar day. */
  face_to_face_daily_goal: number;
  /** Partnerships zone-maturity card: every zone's target count of Mature-status partnerships. */
  mature_partnership_goal_per_zone: number;
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
  /** Can coexist with the hourly rates above — the dispatcher picks per job which to use. */
  flat_rate: number;
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
  /** Stamped once, the first time status ever entered that stage. Never overwritten afterward. */
  developing_at: string | null;
  mature_at: string | null;
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
  /** Trigger-maintained mirror of confirmed_arrival_date/time (once Booked) or the earliest arrival window. */
  arrival_date: string | null;
  arrival_time: string | null;
  /** The dispatcher's specific, confirmed schedule once the job is Booked. */
  confirmed_arrival_date: string | null;
  confirmed_arrival_time: string | null;
  estimated_duration_minutes: number | null;
  addresses: string[];
  /** Real amount the customer was charged. Auto-filled from job_financials.target_total_invoice; editable. */
  total_invoice_paid: number;
  pos_fee_percent: number;
  total_worker_payout_override: number | null;
  invoice_ref: string | null;
  notes: string | null;
  /** Separate from notes — meant for message templates via {{details}}. */
  details: string | null;
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
  /** Whose phone/name a template uses for {{poc_name}}/{{poc_phone}} when no specific recipient is targeted. */
  is_leader: boolean;
  sort_order: number;
  job_worker_fees: JobWorkerFee[];
};

/** Up to three per job. Only populated windows have a row — sort_order is the slot (0,1,2). */
export type JobArrivalWindow = {
  id: string;
  job_id: string;
  sort_order: number;
  date: string;
  start_time: string | null;
  end_time: string | null;
};

/** Ad-hoc job-level cost (parking, supplies, etc.) — folded into the base commission %/POS fee % compute from. */
export type JobCost = {
  id: string;
  job_id: string;
  description: string | null;
  amount: number;
  sort_order: number;
};

export type JobFull = Job & {
  job_workers: JobWorker[];
  job_arrival_windows: JobArrivalWindow[];
  job_costs: JobCost[];
};

/** Rows from the `job_financials` view. */
export type JobFinancials = {
  job_id: string;
  calculated_worker_payout: number;
  total_worker_payout: number;
  /** Sum of this job's job_costs rows. */
  other_costs_total: number;
  pos_fee_amount: number;
  /** Fixed % of (worker payout + other costs + CAG), from Settings — the un-adjusted target. */
  commission_target: number;
  /** Flat $5, hard-coded — the un-adjusted target. */
  cag_target: number;
  /** worker payout + other_costs_total + commission_target + pos_fee_amount + cag_target — what total_invoice_paid auto-fills to. */
  target_total_invoice: number;
  /** Real commission after the shortfall waterfall. Never exceeds commission_target; floors at 0. */
  commission_amount: number;
  /** Real CAG after the shortfall waterfall. Can go negative. */
  cag_amount: number;
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

/**
 * Just an outcome and an intent level at a moment in time — no contact
 * details. An interested prospect becomes a job directly; there's nothing
 * else worth capturing here.
 */
export type FaceToFaceConversation = {
  id: string;
  occurred_at: string;
  /** Null only for conversations logged before sessions existed. */
  session_id: string | null;
  outcome_id: string | null;
  /** 1-10 slider: how interested the dispatcher judged them to be. */
  intent_level: number;
  created_at: string;
};
