/** Mirrors supabase/schema.sql. */

export type ListKind =
  | "service_category"
  | "lead_source"
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
  monthly_jobs_goal: number;
  daily_leads_goal: number;
  daily_partnerships_goal: number;
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
  /** Null while this is still a lead. Set means it counts toward every metric. */
  date_signed: string | null;
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
  lead_source_id: string | null;
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
  profit: number;
  week_of: string | null;
  month: string | null;
  repeat_customer: boolean;
};
