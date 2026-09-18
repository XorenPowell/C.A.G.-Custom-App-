import { dateLongDisplay, durationDisplay, money, phoneDisplay, timeDisplay } from "@/lib/format";

/** Every variable the dispatcher can put in a message body (spec section 6). */
export const TEMPLATE_VARS: { token: string; description: string }[] = [
  { token: "job_id", description: "JOB-0012" },
  { token: "customer_name", description: "Customer's name" },
  { token: "customer_phone", description: "Customer's phone, formatted" },
  { token: "service_category", description: "e.g. Moving" },
  { token: "arrival_date", description: "e.g. Mon, Aug 10, 2026" },
  { token: "arrival_time", description: "e.g. 9:00 AM" },
  { token: "estimated_duration", description: "e.g. 2h 30m" },
  { token: "address_1", description: "First stop" },
  { token: "address_2", description: "Second stop" },
  { token: "address_3", description: "Third stop" },
  { token: "address_4", description: "Fourth stop" },
  { token: "address_5", description: "Fifth stop" },
  { token: "all_addresses", description: "Every stop, arrow separated" },
  { token: "entity_names", description: "Assigned entities, comma separated" },
  { token: "poc_name", description: "Entity point of contact" },
  { token: "poc_phone", description: "Entity POC phone, formatted" },
  { token: "zone", description: "Job zone" },
  { token: "pay", description: "The recipient worker's pay for this job, e.g. $117.50" },
  { token: "details", description: "Job details (parking, gate codes, etc.)" },
  { token: "notes", description: "Job notes" },
];

export type TemplateContext = {
  job_id: string;
  customer_name: string;
  customer_phone: string;
  service_category: string;
  arrival_date: string;
  arrival_time: string;
  estimated_duration: string;
  address_1: string;
  address_2: string;
  address_3: string;
  address_4: string;
  address_5: string;
  all_addresses: string;
  entity_names: string;
  poc_name: string;
  poc_phone: string;
  zone: string;
  pay: string;
  details: string;
  notes: string;
};

export type TemplateJob = {
  job_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  arrival_date: string | null;
  arrival_time: string | null;
  estimated_duration_minutes: number | null;
  addresses: string[];
  details: string | null;
  notes: string | null;
};

export type TemplateEntity = {
  entity_name: string;
  poc_name: string | null;
  poc_phone: string | null;
  /** This entity's effective pay for the job being messaged about (override if set, else calculated). */
  pay: number | null;
  /** Whose phone/name represents the job when no specific recipient is targeted. At most one per job. */
  is_leader?: boolean;
};

/**
 * Builds the substitution context for a job.
 *
 * `target` is the entity being messaged, when the action is aimed at one
 * specific entity's POC — takes priority. Without it, POC fields use
 * whichever assigned entity is marked as the job's leader, falling back to
 * the first assigned entity if none is, so customer-facing templates still
 * resolve on older jobs with no leader set.
 */
export function buildContext(
  job: TemplateJob,
  serviceCategory: string,
  zone: string,
  entities: TemplateEntity[],
  target?: TemplateEntity | null,
): TemplateContext {
  const poc = target ?? entities.find((e) => e.is_leader) ?? entities[0] ?? null;
  const addresses = (job.addresses ?? []).filter((a) => a && a.trim() !== "");

  return {
    job_id: job.job_id ?? "",
    customer_name: job.customer_name ?? "",
    customer_phone: job.customer_phone ? phoneDisplay(job.customer_phone) : "",
    service_category: serviceCategory === "—" ? "" : serviceCategory,
    arrival_date: job.arrival_date ? dateLongDisplay(job.arrival_date) : "",
    arrival_time: job.arrival_time ? timeDisplay(job.arrival_time) : "",
    estimated_duration:
      job.estimated_duration_minutes != null
        ? durationDisplay(job.estimated_duration_minutes)
        : "",
    address_1: addresses[0] ?? "",
    address_2: addresses[1] ?? "",
    address_3: addresses[2] ?? "",
    address_4: addresses[3] ?? "",
    address_5: addresses[4] ?? "",
    all_addresses: addresses.join(" → "),
    entity_names: entities.map((e) => e.entity_name).join(", "),
    poc_name: poc?.poc_name ?? "",
    poc_phone: poc?.poc_phone ? phoneDisplay(poc.poc_phone) : "",
    zone: zone === "—" ? "" : zone,
    pay: poc?.pay != null ? money(poc.pay) : "",
    details: job.details ?? "",
    notes: job.notes ?? "",
  };
}

/**
 * Substitutes {{variable}} tokens. Known variables with no data resolve to an
 * empty string; unrecognised tokens are left visible so a typo is obvious.
 */
export function resolveTemplate(body: string, ctx: TemplateContext): string {
  return (body ?? "").replace(/\{\{\s*([a-z_0-9]+)\s*\}\}/gi, (match, name: string) => {
    const key = name.toLowerCase() as keyof TemplateContext;
    return key in ctx ? ctx[key] : match;
  });
}

/** Tokens in a body that aren't real variables — surfaced in Settings. */
export function unknownTokens(body: string): string[] {
  const known = new Set(TEMPLATE_VARS.map((v) => v.token));
  const found = new Set<string>();
  for (const m of (body ?? "").matchAll(/\{\{\s*([a-z_0-9]+)\s*\}\}/gi)) {
    const token = m[1].toLowerCase();
    if (!known.has(token)) found.add(token);
  }
  return [...found];
}
