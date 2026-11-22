import { ReactNode, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Btn, Card, Check, Chip, ChipRow, Eyebrow, Field, KV, P, Row, Screen, Sheet, Stepper } from '../../../ui';
import {
  CATEGORY_QUESTIONS, CHECKLIST, ENDING_REASONS, Job, NEEDS, PayStatus, ago, dispatchable, jobPrice, payLabel, statusTone, useStore, workerName,
} from '../../../store';
import { C } from '../../../theme';

function Section({ title, sub, open: initial = false, children }: { title: string; sub?: string; open?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(initial);
  return (
    <Card>
      <Pressable onPress={() => setOpen(!open)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.text, fontSize: 16, fontWeight: '700' }}>{title}</Text>
          {sub && !open ? <Text style={{ color: C.muted, fontSize: 13 }} numberOfLines={1}>{sub}</Text> : null}
        </View>
        <Text style={{ color: C.muted, fontSize: 16 }}>{open ? '⌃' : '⌄'}</Text>
      </Pressable>
      {open && <View style={{ gap: 10, marginTop: 4 }}>{children}</View>}
    </Card>
  );
}

const PAY: PayStatus[] = ['unpaid', 'partly_paid', 'paid', 'refunded', 'cancelled'];

/** The dispatcher's job ticket (canvas 3.4.3). Every field is editable at any stage. */
export default function DispatcherJob() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { s, a } = useStore();
  const j = s.jobs.find((x) => x.id === id);
  const [endSheet, setEndSheet] = useState(false);
  const [endKind, setEndKind] = useState<'Cancelled' | 'Lost' | 'Rejected'>('Cancelled');
  const [endReason, setEndReason] = useState<string | null>(null);
  const [endNote, setEndNote] = useState('');
  const [assignSheet, setAssignSheet] = useState(false);
  if (!j) return <Screen title="Job" back><P>This job could not be loaded.</P></Screen>;
  const up = (fn: (x: Job) => void) => a.updateJob(j.id, fn);
  const ended = ['Cancelled', 'Lost', 'Rejected'].includes(j.status);

  // Default pool order: job's zone first, then rating (canvas 2.2.1, proposed).
  const eligible = s.workers.filter(dispatchable).sort((x, y) => Number(y.zone === j.zone) - Number(x.zone === j.zone) || y.rating - x.rating);
  const current = j.offers.find((o) => o.outcome === 'offered');
  const full = j.crew.length >= j.seats;
  const tel = (p: string) => Linking.openURL(`tel:${p.replace(/\D/g, '')}`);
  const sms = (p: string) => Linking.openURL(`sms:${p.replace(/\D/g, '')}`);

  return (
    <Screen title={`${j.number} · ${j.service}`} back>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Chip label={j.status} tone={statusTone(j.status)} />
        <Chip label={`${j.crew.length} of ${j.seats} crew`} tone={full ? 'green' : 'amber'} />
        <Chip label={payLabel[j.pay]} tone={statusTone(payLabel[j.pay])} />
      </View>
      {j.ending && <P>{`${j.status}: ${j.ending.reason}${j.ending.note ? ' — ' + j.ending.note : ''}`}</P>}

      {j.nextAction && (
        <Row title={`Next: ${j.nextAction.kind}`} sub={`${j.nextAction.note} · ${ago(j.nextAction.at)}`} tone={j.nextAction.at < Date.now() ? 'red' : undefined}
          right={<Btn small kind="secondary" label="Done" onPress={() => a.setNextAction(j.id, null)} />} />
      )}

      {j.requests.length > 0 && (
        <Card style={{ borderWidth: 1, borderColor: C.amber }}>
          <Eyebrow>Requests & Something's up</Eyebrow>
          {j.requests.map((r, i) => <KV key={i} k={r.kind} v={`${r.text} · ${ago(r.at)}`} />)}
        </Card>
      )}

      <Section title="Customer" sub={`${j.payer.name} · ${j.payer.phone}`} open>
        <KV k="Payer" v={j.payer.name} />
        <KV k="Phone" v={j.payer.phone} />
        <KV k="Email" v={j.payer.email || '—'} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><Btn small kind="secondary" label="Call" onPress={() => tel(j.payer.phone)} /></View>
          <View style={{ flex: 1 }}><Btn small kind="secondary" label="Text" onPress={() => sms(j.payer.phone)} /></View>
        </View>
        <KV k="On site" v={j.onsiteSame ? 'Same as payer' : `${j.onsite.name} · ${j.onsite.phone}`} />
        <KV k="Account" v={j.customerAccountId ? 'Linked' : 'No account (customer record)'} />
      </Section>

      <Section title="Service & site" sub={`${j.service} · ${j.description || 'No description'}`}>
        <ChipRow options={Object.keys(CATEGORY_QUESTIONS)} value={j.service} onChange={(v) => up((x) => { x.service = v; })} />
        {(CATEGORY_QUESTIONS[j.service] ?? []).map((q) => (
          <Field key={q.id} label={q.label} value={j.answers[q.id] ?? ''} onChangeText={(t) => up((x) => { x.answers[q.id] = t; })} />
        ))}
        <Field label="Description (customer sees)" value={j.description} onChangeText={(t) => up((x) => { x.description = t; })} multiline />
        <Field label="Parking and loading" value={j.site.parking} onChangeText={(t) => up((x) => { x.site.parking = t; })} />
        <Field label="Floor and access" value={j.site.access} onChangeText={(t) => up((x) => { x.site.access = t; })} />
        <Field label="Building rules" value={j.site.rules} onChangeText={(t) => up((x) => { x.site.rules = t; })} />
      </Section>

      <Section title="When & where" sub={`${j.date || 'No date'} · ${j.arrival || 'no arrival'} · ${j.stops.length} stop(s)`}>
        <Field label="Date (one day per job)" value={j.date} onChangeText={(t) => up((x) => { x.date = t; })} />
        <Field label="Confirmed arrival: time or window" value={j.arrival} onChangeText={(t) => up((x) => { x.arrival = t; })} />
        {j.stops.map((st, i) => <Field key={i} label={`Stop ${i + 1}`} value={st} onChangeText={(t) => up((x) => { x.stops[i] = t; })} />)}
        <Btn small kind="secondary" label="+ Add a stop" onPress={() => up((x) => { x.stops.push(''); })} />
      </Section>

      <Section title="Quote" sub={jobPrice(j)} open={j.status === 'Inquiry'}>
        <ChipRow options={['Fixed price', 'Estimate'] as const} value={j.quoteType === 'fixed' ? 'Fixed price' : j.quoteType === 'estimate' ? 'Estimate' : null}
          onChange={(v) => up((x) => { x.quoteType = v === 'Fixed price' ? 'fixed' : 'estimate'; })} />
        {j.quoteType === 'fixed' && <Field label="Total ($)" value={j.fixedTotal} onChangeText={(t) => up((x) => { x.fixedTotal = t; })} keyboardType="decimal-pad" />}
        {j.quoteType === 'estimate' && (
          <>
            <Field label="Hourly rate ($)" value={j.hourly} onChangeText={(t) => up((x) => { x.hourly = t; })} keyboardType="decimal-pad" />
            <Field label="Minimum hours" value={j.minHours} onChangeText={(t) => up((x) => { x.minHours = t; })} keyboardType="decimal-pad" />
            <Field label="Estimated hours" value={j.estHours} onChangeText={(t) => up((x) => { x.estHours = t; })} keyboardType="decimal-pad" />
          </>
        )}
        <P>{`POS fee ${s.settings.posFee}% and commission ${s.settings.commission}% are added in the quote builder from the payout.`}</P>
      </Section>

      <Section title="Crew & what the job needs" sub={`${j.seats} seat(s) · ${j.needs.join(', ') || 'no needs set'}`} open={j.status === 'Inquiry'}>
        <Stepper label="Seats needed" value={j.seats} onChange={(n) => up((x) => { x.seats = n; })} />
        <P>What the job needs</P>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {NEEDS.map((n) => (
            <Chip key={n} label={n} tone={j.needs.includes(n) ? 'lime' : 'default'} onPress={() => up((x) => { x.needs = x.needs.includes(n) ? x.needs.filter((y) => y !== n) : [...x.needs, n]; })} />
          ))}
        </View>
        <Eyebrow>Crew</Eyebrow>
        {j.crew.length === 0 && <P>Nobody yet.</P>}
        {j.crew.map((c) => (
          <KV key={c.workerId} k={workerName(s, c.workerId)} v={[c.leader && 'Leader', c.poc && 'Contact', c.slides.length ? `${c.slides.length} slide(s)` : ''].filter(Boolean).join(' · ') || 'Crew'} />
        ))}
      </Section>

      <Section title="Assignment" sub={current ? `Offered to ${workerName(s, current.workerId)}` : full ? 'Crew filled' : 'Not released'} open={['Inquiry', 'Assigning', 'Queued'].includes(j.status)}>
        <P>{`Worker pool, in order (zone first, then rating). Each gets ${s.settings.waitSeconds} s.`}</P>
        {eligible.map((w) => {
          const inPool = j.pool.includes(w.id);
          const o = j.offers.find((x) => x.workerId === w.id);
          const label = j.crew.some((c) => c.workerId === w.id) ? 'Took it' : o?.outcome === 'offered' ? 'Offered now' : o?.outcome === 'timed_out' ? 'Timed out' : o?.outcome === 'waiting' ? `Next in line` : '';
          return (
            <Check key={w.id} label={`${w.name} · ${w.rating.toFixed(1)}`} sub={`${w.zone} · ${w.vehicle}${label ? ' · ' + label : ''}`} checked={inPool}
              onToggle={() => up((x) => { x.pool = inPool ? x.pool.filter((p) => p !== w.id) : [...x.pool, w.id]; })} />
          );
        })}
        {!full && ['Inquiry', 'Queued'].includes(j.status) && <Btn label="Release to cascade" disabled={!j.pool.length} onPress={() => a.releaseToCascade(j.id)} />}
        {!full && current && (
          <>
            <Btn kind="secondary" label={`Mock: ${workerName(s, current.workerId)} takes it`} onPress={() => a.takeOffer(j.id, current.workerId)} />
            <Btn kind="secondary" label="Mock: window runs out → next worker" onPress={() => a.advanceCascade(j.id)} />
          </>
        )}
        {!full && <Btn kind="secondary" label="Assign directly" onPress={() => setAssignSheet(true)} />}
        {full && j.status === 'Assigning' && <Btn label="Send quote to customer" disabled={!j.quoteType} onPress={() => a.sendQuote(j.id)} />}
        {j.status === 'Quoted' && <Btn kind="secondary" label="Mock: customer accepts" onPress={() => a.acceptQuote(j.id)} />}
      </Section>

      <Section title="Money · Square" sub={j.squareLink ? `${payLabel[j.pay]} · link pasted` : 'No invoice linked'} open={j.status === 'Completed'}>
        <Field label="Square invoice link (paste)" value={j.squareLink} onChangeText={(t) => up((x) => { x.squareLink = t; if (t && x.pay === 'none') x.pay = 'unpaid'; })} placeholder="https://squareup.com/pay-invoice/…" />
        <P>Status, copied from Square</P>
        <ChipRow options={PAY.map((p) => payLabel[p])} value={payLabel[j.pay]} onChange={(v) => up((x) => { x.pay = (Object.keys(payLabel) as PayStatus[]).find((k) => payLabel[k] === v) ?? 'unpaid'; })} />
        <Field label="Amount paid ($)" value={j.amountPaid} onChangeText={(t) => up((x) => { x.amountPaid = t; })} keyboardType="decimal-pad" />
        <Field label="Tip ($)" value={j.tip} onChangeText={(t) => up((x) => { x.tip = t; })} keyboardType="decimal-pad" />
        <P>Square's API comes later and will fill these on its own.</P>
      </Section>

      <Section title="Contact checklist" sub={`${Object.keys(j.checklist).length} of ${CHECKLIST.length} done`}>
        {CHECKLIST.map((c) => (
          <Check key={c.key} label={c.label} sub={j.checklist[c.key] ? `Done ${ago(j.checklist[c.key])}` : 'Text button opens your messages'} checked={!!j.checklist[c.key]} onToggle={() => a.toggleChecklist(j.id, c.key)} />
        ))}
      </Section>

      <Section title="Internal notes" sub={j.notes || 'None'}>
        <Field label="Dispatchers only" value={j.notes} onChangeText={(t) => up((x) => { x.notes = t; })} multiline />
      </Section>

      {!ended && j.status !== 'Completed' && <Btn kind="danger" label="End job (Cancelled / Lost / Rejected)" onPress={() => setEndSheet(true)} />}

      <Sheet visible={endSheet} onClose={() => setEndSheet(false)} title="End this job">
        <ChipRow options={['Cancelled', 'Lost', 'Rejected'] as const} value={endKind} onChange={(v) => { setEndKind(v); setEndReason(null); }} />
        <P>Reason (required)</P>
        <ChipRow options={ENDING_REASONS[endKind]} value={endReason} onChange={setEndReason} />
        <Field label="Note" value={endNote} onChangeText={setEndNote} />
        <Btn kind="danger" label={`Mark ${endKind}`} disabled={!endReason} onPress={() => { a.endJob(j.id, endKind, endReason!, endNote); setEndSheet(false); }} />
      </Sheet>
      <Sheet visible={assignSheet} onClose={() => setAssignSheet(false)} title="Assign directly">
        <P>Only workers with approved paperwork are listed.</P>
        {eligible.filter((w) => !j.crew.some((c) => c.workerId === w.id)).map((w) => (
          <Row key={w.id} title={w.name} sub={`${w.zone} · ${w.rating.toFixed(1)} · ${w.vehicle}`} onPress={() => { a.assignDirect(j.id, w.id); setAssignSheet(false); }} />
        ))}
      </Sheet>
    </Screen>
  );
}
