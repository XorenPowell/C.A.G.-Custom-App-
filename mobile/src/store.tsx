// Mock data + workflow actions. Everything lives in memory so one phone can play
// all four roles and walk a job end to end. Supabase replaces this later; the
// shapes follow supabase/V2_DATA_MAP.md.
import { createContext, ReactNode, useContext, useMemo, useState } from 'react';

export type Role = 'customer' | 'worker' | 'dispatcher' | 'local_admin';
export type JobStatus =
  | 'Inquiry' | 'Assigning' | 'Queued' | 'Quoted' | 'Booked' | 'On the way' | 'Working'
  | 'Completed' | 'Cancelled' | 'Lost' | 'Rejected';
export type PayStatus = 'none' | 'unpaid' | 'partly_paid' | 'paid' | 'refunded' | 'cancelled';
export type SlideKind = 'online' | 'arrive' | 'leave' | 'complete';

export const SERVICES = ['Moving', 'Junk removal', 'Assembly', 'Delivery'] as const;
export const ZONES = ['Lakeview', 'Logan Square', 'West Loop', 'Hyde Park'] as const;
export const NEEDS = ['Box truck', 'Pickup', 'Cargo van', 'Dolly', 'Straps', 'Blankets', 'Drill'] as const;
export const ENDING_REASONS: Record<'Cancelled' | 'Lost' | 'Rejected', string[]> = {
  Cancelled: ['Customer changed plans', 'Found someone cheaper', 'Date no longer works'],
  Lost: ['Could not fill the crew', 'No reply to quote', 'Went elsewhere'],
  Rejected: ['Outside our area', 'Unsafe or not allowed', 'Not a service we offer'],
};
export const CATEGORY_QUESTIONS: Record<string, { id: string; label: string; type: 'text' | 'number' | 'choice' | 'checkbox'; choices?: string[]; required?: boolean }[]> = {
  Moving: [
    { id: 'floors', label: 'Floors at pick-up', type: 'number', required: true },
    { id: 'elevator', label: 'Elevator available?', type: 'checkbox' },
    { id: 'size', label: 'Home size', type: 'choice', choices: ['Studio', '1 bed', '2 bed', '3+ bed'], required: true },
  ],
  'Junk removal': [{ id: 'load', label: 'How much?', type: 'choice', choices: ['A few items', 'Half truck', 'Full truck'], required: true }],
  Assembly: [{ id: 'items', label: 'How many items?', type: 'number', required: true }],
  Delivery: [{ id: 'store', label: 'Picking up from', type: 'text', required: true }],
};
export const CHECKLIST: { key: string; label: string }[] = [
  { key: 'inquiry_received', label: 'Inquiry received' },
  { key: 'quote_sent', label: 'Quote sent' },
  { key: 'crew_confirmed', label: 'Crew confirmed' },
  { key: 'day_before', label: 'Day-before reminder' },
  { key: 'on_the_way', label: 'Worker on the way' },
  { key: 'payment_due', label: 'Payment due' },
  { key: 'sign_off', label: 'Sign-off' },
];

export type Person = { name: string; phone: string; email: string };
export type Slide = { kind: SlideKind; stop?: number; at: number };
export type Crew = {
  workerId: string;
  leader: boolean;
  poc: boolean;
  slides: Slide[];
  /** Photo labels taken by this crew member: 'Before', 'Stop 2', 'After'… */
  photos: string[];
  expenses?: { amount: string; what: string }[];
};
export type Offer = { workerId: string; position: number; offeredAt: number | null; outcome: 'waiting' | 'offered' | 'taken' | 'timed_out' };
export type Job = {
  id: string;
  number: string;
  /** Short job title the worker sees, e.g. "Jane’s Couch!". Falls back to the service. */
  title?: string;
  /** "Be online by" time shown to the worker (arrival minus travel). */
  onlineBy?: string;
  /** Estimated pay per worker shown on offers and assignments. */
  estPay?: number;
  /** Large / fragile items flag text, shown as an amber chip. */
  fragile?: string;
  service: string;
  answers: Record<string, string>;
  payer: Person;
  onsiteSame: boolean;
  onsite: { name: string; phone: string };
  customerAccountId: string | null;
  stops: string[];
  zone: string;
  date: string;
  arrival: string;
  site: { parking: string; access: string; rules: string; gate: string };
  description: string;
  notes: string;
  quoteType: 'fixed' | 'estimate' | null;
  fixedTotal: string;
  hourly: string;
  minHours: string;
  estHours: string;
  seats: number;
  needs: string[];
  status: JobStatus;
  ending: { reason: string; note: string } | null;
  ownerId: string;
  pool: string[];
  offers: Offer[];
  crew: Crew[];
  squareLink: string;
  pay: PayStatus;
  amountPaid: string;
  tip: string;
  checklist: Record<string, number>;
  agreementSigned: boolean;
  nextAction: { kind: string; at: number; note: string } | null;
  requests: { kind: string; text: string; at: number }[];
  createdAt: number;
  completedAt: number | null;
};
export type DocStatus = 'pending' | 'approved' | 'rejected' | 'missing';
export type Worker = {
  id: string;
  name: string;
  zone: string;
  rating: number;
  vehicle: string;
  equipment: string[];
  payoutMethod: string;
  active: boolean;
  docs: { type: string; status: DocStatus; expires?: string; reason?: string; note?: string }[];
  // Profile details (canvas 4.8); optional so older seed rows stay short.
  kind?: 'Individual' | 'Crew' | 'Vendor';
  phone?: string;
  email?: string;
  home?: string;
  handle?: string;
  rates?: { regular: number; travel: number; other: number };
  fees?: { name: string; amount: string }[];
  unavailable?: { id: string; title: string; kind: 'Weekly' | 'Once'; when: string }[];
  templates?: Record<string, string>;
};
export type Account = { id: string; role: Role; name: string; phone: string; email: string; active: boolean; workerId?: string };
export type Payout = {
  id: string;
  jobId: string;
  workerId: string;
  computed: number;
  override: number | null;
  status: 'pending' | 'sent';
  sent?: { method: string; date: string; ref: string };
  corrections: { kind: 'Not sent' | 'Different amount'; amount?: string; note: string; at: number }[];
};
export type Partnership = { id: string; name: string; zone: string; stage: string; nextAction: { kind: string; at: number; note: string } };

export type State = {
  role: Role | null;
  me: string | null; // account id
  jobs: Job[];
  workers: Worker[];
  accounts: Account[];
  payouts: Payout[];
  partnerships: Partnership[];
  settings: { commission: string; posFee: string; transferFee: string; flatFee: string; waitSeconds: string; ratingThreshold: string; refillDays: string };
  seq: number;
};

/* ---------- seed ---------- */
const now = Date.now();
const H = 3600_000;
const D = 24 * H;
const blankSite = { parking: '', access: '', rules: '', gate: '' };
const docsOk = (expiring?: boolean) => [
  { type: 'W-9', status: 'approved' as DocStatus },
  { type: 'IC agreement', status: 'approved' as DocStatus },
  { type: 'Photo ID', status: 'approved' as DocStatus },
  { type: 'Background check', status: 'approved' as DocStatus },
  { type: "Driver's license", status: 'approved' as DocStatus, expires: '2028-08-01' },
  { type: 'Vehicle insurance', status: 'approved' as DocStatus, expires: expiring ? '2026-12-12' : '2027-03-01' },
];

/** Paperwork state read from stored dates — no reminders (canvas 2.7.1). */
export function docState(d: { status: DocStatus; expires?: string }, soonDays = 30): 'Approved' | 'Under review' | 'Rejected' | 'Not uploaded' | 'Expired' | 'Expiring soon' {
  if (d.status === 'missing') return 'Not uploaded';
  if (d.status === 'rejected') return 'Rejected';
  if (d.status === 'pending') return 'Under review';
  if (d.expires) {
    const days = Math.ceil((new Date(d.expires + 'T23:59:59').getTime() - Date.now()) / 86400_000);
    if (days < 0) return 'Expired';
    if (days <= soonDays) return 'Expiring soon';
  }
  return 'Approved';
}
export const fmtDate = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
export const daysUntil = (iso: string) => Math.ceil((new Date(iso + 'T23:59:59').getTime() - Date.now()) / 86400_000);

function baseJob(p: Partial<Job> & { id: string; number: string }): Job {
  return {
    service: 'Moving', answers: {}, payer: { name: '', phone: '', email: '' }, onsiteSame: true, onsite: { name: '', phone: '' },
    customerAccountId: null, stops: [], zone: 'Lakeview', date: '', arrival: '', site: { ...blankSite }, description: '', notes: '',
    quoteType: null, fixedTotal: '', hourly: '', minHours: '', estHours: '', seats: 1, needs: [], status: 'Inquiry', ending: null,
    ownerId: 'a_disp', pool: [], offers: [], crew: [], squareLink: '', pay: 'none', amountPaid: '', tip: '', checklist: {},
    agreementSigned: false, nextAction: null, requests: [], createdAt: now, completedAt: null,
    ...p,
  };
}

const mary: Person = { name: 'Mary Lopez', phone: '(312) 555-0142', email: 'mary.lopez@example.com' };

const seed: State = {
  role: null,
  me: null,
  seq: 145,
  settings: { commission: '5', posFee: '5', transferFee: '2', flatFee: '5', waitSeconds: '60', ratingThreshold: '8', refillDays: '30' },
  workers: [
    {
      // The demo worker — matches the Figma worker frames.
      id: 'w1', name: 'Xoren Powell', zone: 'Logan Square', rating: 9.2, vehicle: 'Box truck', equipment: ['Box truck', 'Dolly', '6 moving blankets', 'Straps'],
      payoutMethod: 'Cash App · $xorenp', active: true, kind: 'Individual', phone: '(773) 555-0191', email: 'xoren@example.com', home: 'Logan Square', handle: '$xorenp',
      rates: { regular: 28, travel: 20, other: 24 }, fees: [{ name: 'Dolly fee', amount: '$5 / job' }],
      unavailable: [
        { id: 'u1', title: 'Every Sunday', kind: 'Weekly', when: 'All day' },
        { id: 'u2', title: 'Every Monday', kind: 'Weekly', when: '12:00 AM – 12:00 PM' },
        { id: 'u3', title: 'Dec 24 – Dec 26', kind: 'Once', when: 'All day' },
      ],
      templates: {
        "I can't make it": 'Hi {dispatcher}, this is {me} on job {job} ({when}). I can’t make it — sorry for the short notice.',
        'Running late': 'Hi {dispatcher}, this is {me} on job {job}. I’m running about {minutes} minutes late.',
        "Can't get in": 'Hi {dispatcher}, this is {me} on job {job}. The customer isn’t here / I can’t get in. Starting the wait clock.',
        'Job is bigger': 'Hi {dispatcher}, this is {me} on job {job}. The job is bigger than described: ',
        Damage: 'Hi {dispatcher}, this is {me} on job {job}. Something got damaged — photos attached.',
      },
      docs: [
        { type: 'W-9', status: 'approved', note: 'Approved Oct 2' },
        { type: 'IC agreement', status: 'approved', note: 'Signed Oct 2' },
        { type: 'Photo ID', status: 'approved', expires: '2029-03-31' },
        { type: 'Background check', status: 'approved', note: 'Cleared Oct 5' },
        { type: "Driver's license", status: 'approved', expires: '2027-01-04' },
        { type: 'Vehicle insurance', status: 'approved', expires: '2027-06-30' },
        { type: 'Equipment photos', status: 'rejected', reason: 'dolly not visible — retake' },
      ],
    },
    { id: 'w2', name: 'Marcus T.', zone: 'Logan Square', rating: 9.1, vehicle: 'Pickup', equipment: ['Dolly', 'Drill'], payoutMethod: 'Cash App · $marcust', active: true, docs: docsOk() },
    { id: 'w3', name: 'Dee R.', zone: 'Lakeview', rating: 8.6, vehicle: 'Cargo van', equipment: ['Blankets', 'Straps'], payoutMethod: 'Venmo · @dee-r', active: true, docs: docsOk() },
    {
      id: 'w4', name: 'Sam K.', zone: 'West Loop', rating: 7.9, vehicle: 'None', equipment: ['Drill'], payoutMethod: 'Zelle · sam@example.com', active: true,
      docs: [
        { type: 'W-9', status: 'pending' },
        { type: 'IC agreement', status: 'approved' },
        { type: 'Photo ID', status: 'approved' },
        { type: 'Background check', status: 'missing' },
      ],
    },
  ],
  accounts: [
    { id: 'a_cust', role: 'customer', name: 'Mary Lopez', phone: mary.phone, email: mary.email, active: true },
    { id: 'a_work', role: 'worker', name: 'Xoren Powell', phone: '(773) 555-0191', email: 'xoren@example.com', active: true, workerId: 'w1' },
    { id: 'a_work2', role: 'worker', name: 'Marcus T.', phone: '(312) 555-0177', email: 'marcus@example.com', active: true, workerId: 'w2' },
    { id: 'a_disp', role: 'dispatcher', name: 'Alex Rivera', phone: '(312) 555-0101', email: 'alex@example.com', active: true },
    { id: 'a_admin', role: 'local_admin', name: 'Taylor M.', phone: '(312) 555-0100', email: 'taylor@example.com', active: true },
  ],
  partnerships: [
    { id: 'p1', name: 'Southport Hardware', zone: 'Lakeview', stage: 'Developing', nextAction: { kind: 'Visit', at: now - 2 * H, note: 'Refill card stack by the register' } },
    { id: 'p2', name: 'Logan Storage Co.', zone: 'Logan Square', stage: 'Visited', nextAction: { kind: 'Call', at: now + 3 * H, note: 'Ask for the manager, Rita' } },
    { id: 'p3', name: 'Lakeview Realty', zone: 'Lakeview', stage: 'Mature', nextAction: { kind: 'Email', at: now + 2 * D, note: 'Send December referral numbers' } },
  ],
  jobs: [
    baseJob({
      id: 'j1', number: 'JOB-0142', service: 'Moving', answers: { floors: '3', elevator: 'No', size: '2 bed' }, payer: mary, customerAccountId: 'a_cust',
      stops: ['1520 W Belmont Ave, Apt 3', '2211 N Clybourn Ave'], zone: 'Lakeview', date: 'Tomorrow · Tue 24 Nov', arrival: '9:00 – 10:00 am',
      site: { parking: 'Loading zone on Belmont', access: '3rd floor walk-up', rules: 'Move-out by noon', gate: '' }, description: '2-bed move, couch, bed, ~20 boxes',
      quoteType: 'fixed', fixedTotal: '640', seats: 2, needs: ['Box truck', 'Dolly', 'Blankets'], status: 'Booked', pool: ['w2', 'w3'],
      offers: [{ workerId: 'w2', position: 0, offeredAt: now - D, outcome: 'taken' }, { workerId: 'w3', position: 1, offeredAt: now - D, outcome: 'taken' }],
      crew: [{ workerId: 'w2', leader: true, poc: true, slides: [], photos: [] }, { workerId: 'w3', leader: false, poc: false, slides: [], photos: [] }],
      checklist: { inquiry_received: now - 2 * D, quote_sent: now - D, crew_confirmed: now - D }, agreementSigned: true,
      nextAction: { kind: 'Text', at: now + 5 * H, note: 'Day-before reminder' }, createdAt: now - 3 * D,
    }),
    baseJob({
      id: 'j2', number: 'JOB-0143', service: 'Junk removal', answers: { load: 'Half truck' }, payer: { name: 'Chris Bell', phone: '(773) 555-0118', email: 'chris.bell@example.com' },
      stops: ['4410 N Kedzie Ave'], zone: 'Logan Square', date: 'Thu 26 Nov', arrival: 'Morning', description: 'Old couch, mattress, boxes from the garage',
      nextAction: { kind: 'Quote', at: now - 20 * 60_000, note: 'Review & quote, now' }, createdAt: now - H,
      checklist: {},
    }),
    baseJob({
      id: 'j3', number: 'JOB-0139', service: 'Assembly', answers: { items: '4' }, payer: mary, customerAccountId: 'a_cust', stops: ['1520 W Belmont Ave, Apt 3'],
      date: 'Sat 14 Nov', arrival: '1:00 pm', quoteType: 'estimate', hourly: '60', minHours: '2', estHours: '3', status: 'Completed', crew: [{ workerId: 'w1', leader: true, poc: true, slides: [], photos: [] }],
      squareLink: 'https://squareup.com/pay-invoice/demo-0139', pay: 'paid', amountPaid: '180', tip: '20', agreementSigned: true,
      checklist: { inquiry_received: now - 12 * D, quote_sent: now - 11 * D, crew_confirmed: now - 11 * D, sign_off: now - D }, createdAt: now - 12 * D, completedAt: now - D,
    }),
    baseJob({
      id: 'j4', number: 'JOB-0144', title: 'Jane’s Couch!', estPay: 135, onlineBy: '2:30 PM', service: 'Moving', answers: { floors: '1', elevator: 'Yes', size: 'Studio' }, payer: { name: 'Jane Park', phone: '(312) 555-0163', email: 'jane.park@example.com' },
      stops: ['2750 N Milwaukee Ave', '1615 N Damen Ave'], zone: 'Logan Square', date: 'Tue', arrival: '3:00–5:00 PM', quoteType: 'fixed', fixedTotal: '340',
      description: 'Pick up a sectional couch and deliver it to the new apartment, second floor.', site: { parking: 'Street parking', access: '2nd floor, wide stairs', rules: 'None', gate: '' },
      seats: 2, needs: ['Box truck', 'Dolly', '6 moving blankets'], status: 'Assigning', pool: ['w1', 'w3', 'w2'],
      offers: [{ workerId: 'w1', position: 0, offeredAt: now + 15_000, outcome: 'offered' }, { workerId: 'w3', position: 1, offeredAt: null, outcome: 'waiting' }, { workerId: 'w2', position: 2, offeredAt: null, outcome: 'waiting' }],
      checklist: { inquiry_received: now - 5 * H }, nextAction: { kind: 'Fill crew', at: now + H, note: 'Watch the cascade' }, createdAt: now - 5 * H,
    }),
    baseJob({
      id: 'j8', number: 'JOB-1042', title: 'Storage unit move', estPay: 96, onlineBy: '2:30 PM', service: 'Moving', answers: { floors: '0', elevator: 'No', size: '1 bed' },
      payer: { name: 'Jane Kim', phone: '(312) 555-0148', email: 'jane.kim@example.com' }, stops: ['1200 N Damen Ave', '2214 W Division St'], zone: 'Wicker Park',
      date: 'Tue', arrival: '3:00 PM', quoteType: 'fixed', fixedTotal: '240', seats: 2, needs: ['Box truck', 'Dolly', '6 moving blankets'], status: 'Booked',
      site: { parking: 'Loading zone out front, 20 min', access: 'Ground floor, no stairs', rules: 'Moves 9 AM–5 PM only', gate: '4821' }, fragile: 'glass table',
      description: 'Move the contents of one storage unit (two couches, six boxes) from Damen to Division. Ground floor at both ends.',
      crew: [{ workerId: 'w1', leader: true, poc: false, slides: [], photos: [] }, { workerId: 'w2', leader: false, poc: true, slides: [], photos: [] }],
      agreementSigned: true, checklist: { inquiry_received: now - 3 * D, quote_sent: now - 2 * D, crew_confirmed: now - 2 * D }, createdAt: now - 3 * D,
    }),
    baseJob({
      id: 'j9', number: 'JOB-1047', title: 'Apartment cleanout', estPay: 84, service: 'Junk removal', answers: { load: 'Half truck' },
      payer: { name: 'Luis Ortega', phone: '(773) 555-0133', email: 'luis@example.com' }, stops: ['2431 W Armitage Ave'], zone: 'Logan Square',
      date: 'Thu', arrival: '1:30–3:00 PM', quoteType: 'estimate', hourly: '65', minHours: '2', estHours: '3', seats: 1, needs: ['Box truck'], status: 'Quoted',
      site: { parking: 'Alley behind the building', access: '3rd floor, elevator', rules: 'Use the freight elevator', gate: '' },
      description: 'Clear out a 1-bed apartment: mattress, dresser, bags. Customer is moving out.',
      crew: [{ workerId: 'w1', leader: true, poc: true, slides: [], photos: [] }], checklist: { inquiry_received: now - D, quote_sent: now - 5 * H }, createdAt: now - D,
    }),
    // Phone jobs for a person with no account yet — shows matching on Create account.
    baseJob({
      id: 'j5', number: 'JOB-0128', service: 'Delivery', answers: { store: 'IKEA Schaumburg' }, payer: { name: 'Dana Wells', phone: '(773) 555-0199', email: '' },
      stops: ['600 W Diversey Pkwy'], date: 'Tue 20 Oct', arrival: '2:00 pm', quoteType: 'fixed', fixedTotal: '150', status: 'Completed',
      crew: [{ workerId: 'w2', leader: true, poc: true, slides: [], photos: [] }], pay: 'paid', amountPaid: '150', squareLink: 'https://squareup.com/pay-invoice/demo-0128', createdAt: now - 33 * D, completedAt: now - 32 * D,
    }),
    baseJob({
      id: 'j6', number: 'JOB-0135', service: 'Junk removal', answers: { load: 'A few items' }, payer: { name: 'Dana Wells', phone: '', email: 'dana.w@example.com' }, // email only: shows the per-channel rule
      stops: ['600 W Diversey Pkwy'], date: 'Mon 9 Nov', arrival: 'Afternoon', status: 'Cancelled', ending: { reason: 'Date no longer works', note: '' }, createdAt: now - 14 * D,
    }),
    baseJob({
      id: 'j7', number: 'JOB-0137', service: 'Moving', answers: { floors: '2', size: '1 bed' }, payer: { name: 'Ben Ortiz', phone: '(312) 555-0124', email: 'ben@example.com' },
      stops: ['2600 N Lincoln Ave', '1900 W Fullerton Ave'], date: 'Thu 12 Nov', arrival: '8:00 am', quoteType: 'fixed', fixedTotal: '380', status: 'Completed',
      crew: [{ workerId: 'w3', leader: true, poc: true, slides: [], photos: [] }, { workerId: 'w1', leader: false, poc: false, slides: [], photos: [] }],
      checklist: { inquiry_received: now - 12 * D, quote_sent: now - 11 * D, crew_confirmed: now - 11 * D }, createdAt: now - 12 * D, completedAt: now - 2 * D,
    }),
  ],
  payouts: [
    { id: 'po1', jobId: 'j3', workerId: 'w1', computed: 162, override: null, status: 'pending', corrections: [] },
    { id: 'po2', jobId: 'j5', workerId: 'w2', computed: 128, override: null, status: 'sent', sent: { method: 'Cash App', date: '23 Oct', ref: 'CA-88412' }, corrections: [] },
    { id: 'po3', jobId: 'j7', workerId: 'w3', computed: 171, override: null, status: 'pending', corrections: [] },
    { id: 'po4', jobId: 'j7', workerId: 'w1', computed: 152, override: null, status: 'sent', sent: { method: 'Zelle', date: '14 Nov', ref: 'ZL-20931' }, corrections: [] },
  ],
};

/* ---------- derived helpers ---------- */
export const digits = (s: string) => s.replace(/\D/g, '');
export const norm = (s: string) => s.trim().toLowerCase();
export const money = (n: number) => `$${n.toFixed(2).replace(/\.00$/, '')}`;
export const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60_000);
  if (Math.abs(m) < 60) return m >= 0 ? `${m} min ago` : `in ${-m} min`;
  const h = Math.round(m / 60);
  if (Math.abs(h) < 24) return h >= 0 ? `${h} h ago` : `in ${-h} h`;
  const d = Math.round(h / 24);
  return d >= 0 ? `${d} d ago` : `in ${-d} d`;
};
export const clock = (t: number) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export function jobPrice(j: Job): string {
  if (j.quoteType === 'fixed' && j.fixedTotal) return `$${j.fixedTotal}`;
  if (j.quoteType === 'estimate' && j.hourly) return `$${j.hourly}/h · min ${j.minHours || '?'} h`;
  return 'Not priced';
}
export function customerStatus(s: JobStatus): string {
  if (s === 'Inquiry' || s === 'Assigning' || s === 'Queued') return 'Inquiry sent';
  if (s === 'Quoted') return 'Quote ready';
  return s;
}
export function workerStatus(s: JobStatus): string {
  if (s === 'Quoted') return 'Waiting on customer';
  if (s === 'Booked') return 'Scheduled';
  return s;
}
export function statusTone(s: string): 'default' | 'lime' | 'red' | 'amber' | 'green' | 'blue' {
  if (['Completed', 'Paid', 'paid'].includes(s)) return 'green';
  if (['Cancelled', 'Lost', 'Rejected', 'Overdue'].includes(s)) return 'red';
  if (['Queued', 'Assigning', 'Quote ready', 'Quoted', 'Unpaid', 'unpaid', 'Partly paid'].includes(s)) return 'amber';
  if (['On the way', 'Working', 'Booked', 'Scheduled'].includes(s)) return 'blue';
  return 'default';
}
export const payLabel: Record<PayStatus, string> = { none: 'No invoice yet', unpaid: 'Unpaid', partly_paid: 'Partly paid', paid: 'Paid', refunded: 'Refunded', cancelled: 'Cancelled' };

/** The slide sequence for one crew member: online, arrive/leave each stop, complete. */
export function slideSteps(stops: string[]): { kind: SlideKind; stop?: number; label: string }[] {
  const steps: { kind: SlideKind; stop?: number; label: string }[] = [{ kind: 'online', label: 'Slide to go online' }];
  stops.forEach((_, i) => {
    steps.push({ kind: 'arrive', stop: i, label: `Slide to arrive at stop ${i + 1}` });
    if (i < stops.length - 1) steps.push({ kind: 'leave', stop: i, label: `Slide to leave stop ${i + 1}` });
  });
  steps.push({ kind: 'complete', label: 'Slide to complete' });
  return steps;
}

export const REQUIRED_DOCS = ['W-9', 'IC agreement', 'Photo ID', 'Background check', "Driver's license", 'Vehicle insurance'];
const VEHICLE_DOCS = ["Driver's license", 'Vehicle insurance'];
/** Offers only go to Active workers whose required paperwork is approved and unexpired (canvas 2.7.1). */
export function dispatchable(w: Worker): boolean {
  return w.active && REQUIRED_DOCS.every((type) => {
    const d = w.docs.find((x) => x.type === type);
    if (!d) return VEHICLE_DOCS.includes(type); // vehicle papers only if they have a vehicle on file
    const st = docState(d);
    return st === 'Approved' || st === 'Expiring soon';
  });
}

/** Payout lines for one crew member: hours from their own slides in 15-minute steps (canvas 2.1.4, 4.10.1). */
export function payoutBreakdown(c: Crew, w: Worker | undefined) {
  const at = (k: SlideKind) => c.slides.find((x) => x.kind === k)?.at;
  const online = at('online');
  const firstArrive = at('arrive');
  const complete = at('complete');
  const q = (ms: number) => Math.max(0.25, Math.ceil(ms / 900_000) / 4);
  const travelH = online && firstArrive ? q(firstArrive - online) : 0;
  const regularH = firstArrive && complete ? q(complete - firstArrive) : 0;
  const rates = w?.rates ?? { regular: 0, travel: 0, other: 0 };
  const num = (s: string) => Number(s.replace(/[^0-9.]/g, '')) || 0;
  const lines: { label: string; amount: number }[] = [];
  if (regularH) lines.push({ label: `Regular ${regularH} h × ${rates.regular}`, amount: regularH * rates.regular });
  if (travelH) lines.push({ label: `Travel ${travelH} h × ${rates.travel}`, amount: travelH * rates.travel });
  for (const f of w?.fees ?? []) lines.push({ label: `Standing fee: ${f.name.replace(/ fee$/i, '').toLowerCase()}`, amount: num(f.amount) });
  for (const e of c.expenses ?? []) lines.push({ label: `Expense: ${e.what.toLowerCase()} (receipt)`, amount: num(e.amount) });
  return { lines, total: lines.reduce((s, l) => s + l.amount, 0), hours: regularH + travelH };
}

export function matchJobs(jobs: Job[], name: string, phone: string, email: string) {
  const n = norm(name), p = digits(phone), e = norm(email);
  return jobs
    .filter((j) => !j.customerAccountId)
    .map((j) => {
      const people = [j.payer, ...(j.onsiteSame ? [] : [{ ...j.onsite, email: '' }])];
      const on: string[] = [];
      if (n && people.some((x) => norm(x.name) === n)) on.push('name');
      if (p.length >= 7 && people.some((x) => digits(x.phone) === p)) on.push('phone');
      if (e && people.some((x) => norm(x.email) === e)) on.push('email');
      return { job: j, on };
    })
    .filter((m) => m.on.length > 0);
}

/* ---------- store ---------- */
type Ctx = { s: State; a: ReturnType<typeof makeActions> };
const StoreCtx = createContext<Ctx | null>(null);

let idSeq = 1000;
const newId = (p: string) => p + (++idSeq);

function makeActions(mut: (fn: (d: State) => void) => void) {
  const job = (d: State, id: string) => {
    const j = d.jobs.find((x) => x.id === id);
    if (!j) throw new Error('job ' + id);
    return j;
  };
  return {
    signIn(role: Role) {
      const id = { customer: 'a_cust', worker: 'a_work', dispatcher: 'a_disp', local_admin: 'a_admin' }[role];
      mut((d) => {
        d.role = role;
        d.me = id;
        // Mockup: a live offer restarts its countdown when you open the worker app.
        if (role === 'worker') for (const j of d.jobs) for (const o of j.offers) if (o.outcome === 'offered') o.offeredAt = Date.now();
      });
    },
    signOut() { mut((d) => { d.role = null; d.me = null; }); },
    reset() { mut((d) => { Object.assign(d, JSON.parse(JSON.stringify(seed)), { role: d.role, me: d.me }); }); },

    /** Customer request or dispatcher-entered job → a new Inquiry. Returns the new id via callback. */
    createJob(p: Partial<Job>, done?: (id: string) => void) {
      const id = newId('j');
      mut((d) => {
        d.seq += 1;
        d.jobs.unshift(baseJob({
          ...p, id, number: `JOB-0${d.seq}`, status: 'Inquiry', createdAt: Date.now(),
          nextAction: { kind: 'Quote', at: Date.now(), note: 'Review & quote, now' },
        }));
      });
      done?.(id);
    },
    updateJob(id: string, fn: (j: Job) => void) { mut((d) => fn(job(d, id))); },

    /** Dispatcher releases the job: offers run down the pool one at a time. */
    releaseToCascade(id: string) {
      mut((d) => {
        const j = job(d, id);
        j.status = 'Assigning';
        j.offers = j.pool.filter((w) => !j.crew.some((c) => c.workerId === w)).map((w, i) => ({ workerId: w, position: i, offeredAt: i === 0 ? Date.now() : null, outcome: i === 0 ? 'offered' : 'waiting' }));
        j.nextAction = { kind: 'Fill crew', at: Date.now() + H, note: 'Watch the cascade' };
        if (!j.offers.length) { j.status = 'Queued'; }
      });
    },
    /** The current offer timed out (or the dispatcher skips it): next in line gets it. */
    advanceCascade(id: string) {
      mut((d) => {
        const j = job(d, id);
        const cur = j.offers.find((o) => o.outcome === 'offered');
        if (cur) cur.outcome = 'timed_out';
        const next = j.offers.find((o) => o.outcome === 'waiting');
        if (next) { next.outcome = 'offered'; next.offeredAt = Date.now(); }
        else if (j.crew.length < j.seats) { j.status = 'Queued'; j.nextAction = { kind: 'Fill crew', at: Date.now(), note: 'Cascade ran out — call workers' }; }
      });
    },
    takeOffer(id: string, workerId: string) {
      mut((d) => {
        const j = job(d, id);
        if (j.crew.length >= j.seats || j.crew.some((c) => c.workerId === workerId)) return;
        j.crew.push({ workerId, leader: j.crew.length === 0, poc: j.crew.length === 0, slides: [], photos: [] });
        const o = j.offers.find((x) => x.workerId === workerId);
        if (o) o.outcome = 'taken';
        if (j.crew.length >= j.seats) {
          j.offers.forEach((x) => { if (x.outcome !== 'taken') x.outcome = x.outcome === 'offered' ? 'timed_out' : x.outcome; });
          if (j.status === 'Queued') j.status = 'Assigning';
          j.nextAction = { kind: 'Text', at: Date.now(), note: 'Crew filled — send the quote' };
        } else {
          const next = j.offers.find((x) => x.outcome === 'waiting');
          if (next && !j.offers.some((x) => x.outcome === 'offered')) { next.outcome = 'offered'; next.offeredAt = Date.now(); }
        }
      });
    },
    giveBack(id: string, workerId: string) {
      mut((d) => {
        const j = job(d, id);
        j.crew = j.crew.filter((c) => c.workerId !== workerId);
        j.requests.push({ kind: "I can't make it", text: `${d.workers.find((w) => w.id === workerId)?.name} gave the job back`, at: Date.now() });
        if (j.status !== 'Inquiry') j.status = 'Queued';
        j.nextAction = { kind: 'Fill crew', at: Date.now(), note: 'A seat was released' };
      });
    },
    assignDirect(id: string, workerId: string) {
      mut((d) => {
        const j = job(d, id);
        if (j.crew.some((c) => c.workerId === workerId) || j.crew.length >= j.seats) return;
        j.crew.push({ workerId, leader: j.crew.length === 0, poc: j.crew.length === 0, slides: [], photos: [] });
        if (j.status === 'Inquiry' || j.status === 'Queued') j.status = 'Assigning';
      });
    },
    sendQuote(id: string) {
      mut((d) => { const j = job(d, id); j.status = 'Quoted'; j.checklist.quote_sent = Date.now(); j.checklist.crew_confirmed = Date.now(); j.nextAction = { kind: 'Follow up', at: Date.now() + 24 * H, note: 'Quote follow-up' }; });
    },
    acceptQuote(id: string) {
      mut((d) => { const j = job(d, id); j.status = 'Booked'; j.agreementSigned = true; j.nextAction = { kind: 'Text', at: Date.now() + 12 * H, note: 'Day-before reminder' }; });
    },
    customerRequest(id: string, kind: string, text: string) {
      mut((d) => { const j = job(d, id); j.requests.push({ kind, text, at: Date.now() }); j.nextAction = { kind: 'Call', at: Date.now(), note: `${kind}: ${text}` }; });
    },
    /** A required photo. The first one at stop 1 (the before photo) moves the job to Working. */
    takePhoto(id: string, workerId: string, label: string) {
      mut((d) => {
        const j = job(d, id);
        const c = j.crew.find((x) => x.workerId === workerId);
        if (c) c.photos.push(label);
        if (label === 'Before' && j.status === 'On the way') j.status = 'Working';
      });
    },
    addExpense(id: string, workerId: string, amount: string, what: string) {
      mut((d) => { const c = job(d, id).crew.find((x) => x.workerId === workerId); if (c) (c.expenses ??= []).push({ amount, what }); });
    },
    addUnavailable(workerId: string, block: { title: string; kind: 'Weekly' | 'Once'; when: string }) {
      const bid = newId('u');
      mut((d) => { const w = d.workers.find((x) => x.id === workerId); if (w) (w.unavailable ??= []).push({ id: bid, ...block }); });
    },
    removeUnavailable(workerId: string, blockId: string) {
      mut((d) => { const w = d.workers.find((x) => x.id === workerId); if (w) w.unavailable = (w.unavailable ?? []).filter((b) => b.id !== blockId); });
    },
    updateWorker(workerId: string, fn: (w: Worker) => void) {
      mut((d) => { const w = d.workers.find((x) => x.id === workerId); if (w) fn(w); });
    },
    setTemplate(workerId: string, key: string, text: string) {
      mut((d) => { const w = d.workers.find((x) => x.id === workerId); if (w) (w.templates ??= {})[key] = text; });
    },
    /** Worker uploads or replaces a document; it waits for the Local Admin. */
    uploadDoc(workerId: string, type: string) {
      mut((d) => { const doc = d.workers.find((w) => w.id === workerId)?.docs.find((x) => x.type === type); if (doc) { doc.status = 'pending'; doc.reason = undefined; doc.note = 'Submitted today'; } });
    },
    slide(id: string, workerId: string, kind: SlideKind, stop?: number) {
      mut((d) => {
        const j = job(d, id);
        const c = j.crew.find((x) => x.workerId === workerId);
        if (!c) return;
        c.slides.push({ kind, stop, at: Date.now() });
        if (kind === 'online' && ['Booked', 'Quoted'].includes(j.status)) { j.status = 'On the way'; j.checklist.on_the_way = j.checklist.on_the_way ?? 0; }
        // Arriving does not start Working: the before photo does (canvas 2.1.4).
        if (kind === 'complete') {
          // Mock: the rest of the crew finishes with the demo worker.
          j.status = 'Completed';
          j.completedAt = Date.now();
          j.nextAction = { kind: 'Text', at: Date.now(), note: 'Send sign-off + Square invoice' };
          for (const m of j.crew) {
            if (!d.payouts.some((p) => p.jobId === j.id && p.workerId === m.workerId)) {
              const own = payoutBreakdown(m, d.workers.find((x) => x.id === m.workerId)).total;
              const base = Number(j.fixedTotal || Number(j.hourly || 0) * Number(j.estHours || j.minHours || 0)) || 200;
              const computed = Math.round((own || (base * 0.8) / j.crew.length) * 100) / 100;
              d.payouts.push({ id: 'po' + Math.random().toString(36).slice(2, 7), jobId: j.id, workerId: m.workerId, computed, override: null, status: 'pending', corrections: [] });
            }
          }
        }
      });
    },
    endJob(id: string, status: 'Cancelled' | 'Lost' | 'Rejected', reason: string, note: string) {
      mut((d) => { const j = job(d, id); j.status = status; j.ending = { reason, note }; j.nextAction = null; });
    },
    toggleChecklist(id: string, key: string) {
      mut((d) => { const j = job(d, id); if (j.checklist[key]) delete j.checklist[key]; else j.checklist[key] = Date.now(); });
    },
    createAccount(acc: Omit<Account, 'id' | 'active'>, linkJobIds: string[]) {
      const id = newId('a');
      mut((d) => {
        let workerId: string | undefined;
        if (acc.role === 'worker') {
          workerId = 'w' + id;
          d.workers.push({ id: workerId, name: acc.name, zone: 'Lakeview', rating: 10, vehicle: 'None', equipment: [], payoutMethod: 'Not set', active: true, docs: ['W-9', 'IC agreement', 'Photo ID', 'Background check'].map((t) => ({ type: t, status: 'missing' as DocStatus })) });
        }
        d.accounts.push({ ...acc, id, active: true, workerId });
        for (const jid of linkJobIds) { const j = d.jobs.find((x) => x.id === jid); if (j) j.customerAccountId = id; }
      });
      return id;
    },
    /** Customer self sign-up: account first, jobs link only as each channel is verified (2.10.1). */
    signUpCustomer(p: { name: string; phone: string; email: string }) {
      const id = newId('a');
      mut((d) => {
        d.accounts.push({ id, role: 'customer', name: p.name, phone: p.phone, email: p.email, active: true });
        d.role = 'customer';
        d.me = id;
      });
      return id;
    },
    verifyChannel(accountId: string, channel: 'phone' | 'email') {
      mut((d) => {
        const acc = d.accounts.find((x) => x.id === accountId);
        if (!acc) return;
        for (const m of matchJobs(d.jobs, '', channel === 'phone' ? acc.phone : '', channel === 'email' ? acc.email : '')) m.job.customerAccountId = accountId;
      });
    },
    setAccountActive(id: string, active: boolean) {
      mut((d) => { const acc = d.accounts.find((x) => x.id === id); if (acc) { acc.active = active; const w = d.workers.find((x) => x.id === acc.workerId); if (w) w.active = active; } });
    },
    setRole(id: string, role: Role) { mut((d) => { const acc = d.accounts.find((x) => x.id === id); if (acc) acc.role = role; }); },
    reviewDoc(workerId: string, type: string, status: DocStatus, reason?: string) {
      mut((d) => { const doc = d.workers.find((w) => w.id === workerId)?.docs.find((x) => x.type === type); if (doc) { doc.status = status; doc.reason = reason; } });
    },
    markPayoutSent(id: string, sent: { method: string; date: string; ref: string }, override: number | null) {
      mut((d) => { const p = d.payouts.find((x) => x.id === id); if (p) { p.status = 'sent'; p.sent = sent; p.override = override; } });
    },
    correctPayout(id: string, kind: 'Not sent' | 'Different amount', amount: string, note: string) {
      mut((d) => { const p = d.payouts.find((x) => x.id === id); if (p) p.corrections.push({ kind, amount, note, at: Date.now() }); });
    },
    /** Log what happened on a partnership and set its next action (canvas 2.11.1). */
    logPartnership(id: string, next: { kind: string; at: number; note: string }) {
      mut((d) => { const p = d.partnerships.find((x) => x.id === id); if (p) p.nextAction = next; });
    },
    setNextAction(id: string, next: { kind: string; at: number; note: string } | null) {
      mut((d) => { job(d, id).nextAction = next; });
    },
    setSetting(k: keyof State['settings'], v: string) { mut((d) => { d.settings[k] = v; }); },
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<State>(() => JSON.parse(JSON.stringify(seed)));
  const a = useMemo(() => makeActions((fn) => setS((prev) => { const d: State = JSON.parse(JSON.stringify(prev)); fn(d); return d; })), []);
  return <StoreCtx.Provider value={{ s, a }}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error('useStore outside StoreProvider');
  return c;
}

export const workerName = (s: State, id: string) => s.workers.find((w) => w.id === id)?.name ?? 'Unknown';
export const myWorkerId = (s: State) => s.accounts.find((x) => x.id === s.me)?.workerId ?? 'w1';
