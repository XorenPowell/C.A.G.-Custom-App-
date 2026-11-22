import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import {
  BackHeader, Btn, Card, Chip, DispatcherCard, Eyebrow, Field, ItsYours, K, KV, Page, Row, Sheet, SheetTitle, SlideBar, T, chipFor,
} from '../../../wk';
import { clock, payoutBreakdown, slideSteps } from '../../../store';
import { dispatcherOf, fillTemplate, firstName, hourBefore, jobTitle, phoneOfWorker, stopsPhrase, useMe, useTake } from '../../../worker-data';

type UpKind = "I can't make it" | 'Running late' | "Can't get in" | 'Job is bigger' | 'Damage';
const UPS: { key: UpKind; title: string; sub: string; red?: boolean }[] = [
  { key: "I can't make it", title: 'I can’t make it', sub: 'Gives the job back · lowers your rating', red: true },
  { key: 'Running late', title: 'Running late', sub: 'Tell them how many minutes' },
  { key: "Can't get in", title: 'Customer not here / can’t get in', sub: 'Starts the wait clock' },
  { key: 'Job is bigger', title: 'Job is bigger than described', sub: 'Extra items, time, crew or truck' },
  { key: 'Damage', title: 'Something got damaged', sub: 'Photos required' },
];
const MINUTES = ['5', '10', '15', '20', '30+'] as const;

/** Worker / Job detail · states 1–5 (Figma 57:84, 57:160, 57:247, 57:339, 57:430). */
export default function WorkerJob() {
  const { id: jobId } = useLocalSearchParams<{ id: string }>();
  const { s, a, id, w } = useMe();
  const j = s.jobs.find((x) => x.id === jobId);
  const take = useTake();
  const [sheet, setSheet] = useState<null | 'menu' | UpKind | 'expense'>(null);
  const [minutes, setMinutes] = useState<(typeof MINUTES)[number]>('15');
  const [msg, setMsg] = useState('');
  const [amount, setAmount] = useState('');
  const [what, setWhat] = useState('');
  const [receipt, setReceipt] = useState(false);

  // The slide bar is a horizontal drag near the left edge; the native stack's
  // swipe-back gesture would otherwise take it and move the whole screen.
  // The back button in the header still works.
  const noSwipeBack = <Stack.Screen options={{ gestureEnabled: false }} />;

  if (!j) return <Page header={<BackHeader title="Job detail" />}>{noSwipeBack}<T c={K.muted}>This job could not be loaded.</T></Page>;

  const c = j.crew.find((x) => x.workerId === id);
  const disp = dispatcherOf(s, j);
  const steps = slideSteps(j.stops);
  const next = c ? steps[c.slides.length] : undefined;
  const slid = (kind: string, stop?: number) => c?.slides.find((x) => x.kind === kind && (stop === undefined || x.stop === stop));
  const online = slid('online');
  const done = j.status === 'Completed';
  const role = j.seats <= 1 ? 'Solo' : c?.leader ? 'Crew lead' : 'Crew';

  // Where am I: last arrived stop not yet left.
  const arrivedAt = c ? [...c.slides].reverse().find((x) => x.kind === 'arrive')?.stop : undefined;
  const leftStops = new Set((c?.slides ?? []).filter((x) => x.kind === 'leave').map((x) => x.stop));
  const atStop = arrivedAt !== undefined && !leftStops.has(arrivedAt) ? arrivedAt : undefined;

  // Required photos (canvas 2.1.4): before at stop 1, one at each stop before leaving, an after photo before completing.
  const has = (l: string) => !!c?.photos.includes(l);
  let need: string | null = null;
  if (c && atStop !== undefined && next) {
    if (atStop === 0 && !has('Before')) need = 'Before';
    else if (!has(`Stop ${atStop + 1}`)) need = `Stop ${atStop + 1}`;
    else if (next.kind === 'complete' && !has('After')) need = 'After';
  }
  const needCopy: Record<string, [string, string]> = {
    Before: ['Before photo required', 'Take a photo of the unit before you touch anything. The slide unlocks once it’s taken.'],
    After: ['After photo required', 'Take a photo of the finished job. The slide unlocks once it’s taken.'],
  };
  const [needTitle, needBody] = need ? needCopy[need] ?? [`${need} photo required`, 'Take a photo at this stop before you leave. The slide unlocks once it’s taken.'] : ['', ''];

  const progress = ['On the way', 'Working', 'Completed'] as const;
  const active = j.status === 'On the way' || j.status === 'Working' || j.status === 'Completed' ? j.status : null;
  const assigned = !!c;
  const revealed = !!online || done;
  const exact = !/[–-]/.test(j.arrival);

  const tpl = (k: UpKind) => fillTemplate(w.templates?.[k] ?? '', { dispatcher: disp.name, me: w.name, job: j, minutes });
  const openUp = (k: UpKind) => { setMsg(tpl(k)); setSheet(k); };
  const textDispatcher = (body: string) => Linking.openURL(`sms:${disp.phone.replace(/\D/g, '')}?body=${encodeURIComponent(body)}`);

  // Times card per state.
  let times: { eyebrow: string; big: string; sub: string; lime?: boolean };
  if (done) {
    const comp = slid('complete');
    times = { eyebrow: 'COMPLETED', big: `${j.date} · ${comp ? clock(comp.at) : ''}`, sub: `Online ${online ? clock(online.at) : '—'} → complete ${comp ? clock(comp.at) : '—'}` };
  } else if (!online) {
    times = { eyebrow: 'ONLINE BY:', big: `${j.date} · ${j.onlineBy ?? '30 min before'}`, sub: `Arrival: ${exact ? 'exactly' : 'between'} ${j.arrival}  ·  travel ≈ 30 min`, lime: true };
  } else if (arrivedAt !== undefined) {
    const arr = slid('arrive', arrivedAt)!;
    times = { eyebrow: 'ARRIVAL', big: `${j.date} · ${j.arrival}`, sub: `Arrived stop ${arrivedAt + 1} at ${clock(arr.at)}` };
  } else {
    times = { eyebrow: 'ARRIVAL', big: `${j.date} · ${j.arrival}`, sub: `Online since ${clock(online.at)} · ETA ${clock(online.at + 28 * 60_000)}` };
  }

  const firstOpen = j.stops.findIndex((_, i) => !leftStops.has(i) && i !== atStop);
  const stopChip = (i: number) =>
    leftStops.has(i) ? { label: 'Done', ...chipFor.pillMuted, text: K.muted, w: 'r' as const }
      : i === atStop ? { label: 'Here now', ...chipFor.lime, text: K.text, w: 's' as const }
      : i === firstOpen && atStop === undefined ? { label: 'Next', ...chipFor.pillMuted, text: K.text, w: 'r' as const }
      : { label: 'Upcoming', ...chipFor.pillMuted, text: K.muted, w: 'r' as const };
  const navTarget = j.stops[atStop !== undefined ? Math.min(atStop + 1, j.stops.length - 1) : Math.max(firstOpen, 0)];

  const breakdown = c ? payoutBreakdown(c, w) : null;
  const payout = s.payouts.find((p) => p.jobId === j.id && p.workerId === id);

  return (
    <View style={{ flex: 1 }}>
      {noSwipeBack}
      <Page header={<BackHeader title="Job detail" />}>
        <T s={24} w="b">{jobTitle(j)}</T>
        <T s={14} c={K.muted}>{`${j.zone} · ${stopsPhrase(j.stops.length)} · ${assigned ? role : `${j.seats}-person crew`}`}</T>

        {/* Progress */}
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {progress.map((p) => (
            <View key={p} style={{ flex: 1, borderRadius: 999, paddingVertical: 8, alignItems: 'center', backgroundColor: active === p ? K.lime : K.pill }}>
              <T s={12} w="s" c={active === p ? K.ink : K.muted}>{p}</T>
            </View>
          ))}
        </View>

        {/* Times */}
        <Card>
          <Eyebrow c={times.lime ? K.lime : K.muted}>{times.eyebrow}</Eyebrow>
          <T s={times.lime ? 28 : 22} w="b" c={times.lime ? K.lime : K.text}>{times.big}</T>
          <T s={14} c={K.muted}>{times.sub}</T>
        </Card>

        <DispatcherCard name={disp.name} phone={disp.phone} label="JOB DISPATCHER" />

        {/* Customer & crew: unlock 1 hour before arrival (mock: once online) */}
        {!revealed ? (
          <Card>
            <Eyebrow>CUSTOMER & CREW</Eyebrow>
            <T s={15} w="m">{`Unlocks at ${hourBefore(j.arrival) ?? '1 hour before arrival'}`}</T>
          </Card>
        ) : !done ? (
          <>
            <Card>
              <Eyebrow>CUSTOMER</Eyebrow>
              <Row>
                <T s={17} w="s">{firstName(j.onsiteSame ? j.payer.name : j.onsite.name)}</T>
                <Pressable onPress={() => Linking.openURL(`tel:${(j.onsiteSame ? j.payer.phone : j.onsite.phone).replace(/\D/g, '')}`)}>
                  <T s={14} c={K.muted}>{j.onsiteSame ? j.payer.phone : j.onsite.phone}</T>
                </Pressable>
              </Row>
            </Card>
            <Card>
              <Eyebrow>CREW</Eyebrow>
              {j.crew.map((m) => (
                <Row key={m.workerId}>
                  <T s={14} w="m">{[s.workers.find((x) => x.id === m.workerId)?.name, [m.leader && 'Leader', m.poc && 'Point of contact', m.workerId === id && 'you'].filter(Boolean).join(' · ')].filter(Boolean).join('  ·  ')}</T>
                  <T s={13} c={K.muted}>{phoneOfWorker(s, m.workerId)}</T>
                </Row>
              ))}
            </Card>
          </>
        ) : null}

        {!done && (
          <>
            <Card>
              <Eyebrow>SITE DETAILS</Eyebrow>
              <KV k="Parking" v={j.site.parking || '—'} />
              <KV k="Floor & access" v={j.site.access || '—'} />
              <KV k="Building rules" v={j.site.rules || '—'} />
              {(j.fragile || j.site.gate) ? (
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                  {j.fragile ? <Chip label={`Fragile: ${j.fragile}`} {...chipFor.amber} /> : null}
                  {j.site.gate ? <Chip label={`Gate code ${j.site.gate}`} {...chipFor.pill} /> : null}
                </View>
              ) : null}
            </Card>
            <Card>
              <Eyebrow>BRING</Eyebrow>
              <T s={15} w="m">{j.needs.join('  ·  ') || 'Nothing special'}</T>
            </Card>
            <Card>
              <Eyebrow>STOPS</Eyebrow>
              {j.stops.map((st, i) => {
                const ch = stopChip(i);
                return (
                  <Row key={i}>
                    <T s={15} w={ch.w} c={ch.text} style={{ flexShrink: 1 }}>{st}</T>
                    <Chip label={ch.label} bg={ch.bg} c={ch.c} />
                  </Row>
                );
              })}
              {online && navTarget ? <Btn kind="secondary" label="Navigate to next stop" onPress={() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(navTarget)}`)} /> : null}
            </Card>
            <Card>
              <Eyebrow>THE WORK</Eyebrow>
              <T s={15}>{j.description || 'No description yet.'}</T>
            </Card>
          </>
        )}

        {/* Photos */}
        <Card>
          <Eyebrow>PHOTOS ON THIS JOB</Eyebrow>
          {c && c.photos.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {c.photos.map((p, i) => (
                <View key={i} style={{ width: 98, height: 74, borderRadius: 10, backgroundColor: K.pill, padding: 6 }}>
                  <T s={10} w="s" c={K.muted}>{p}</T>
                </View>
              ))}
            </View>
          ) : (
            <T s={14} c={K.muted}>{need === 'Before' ? 'Take a before photo to arrive at stop 1.' : 'No photos yet. A before photo is required when you arrive.'}</T>
          )}
        </Card>

        {need && (
          <Card bg={K.amberBg} style={{ gap: 10 }}>
            <T s={16} w="s" c={K.amber}>{needTitle}</T>
            <T s={13} c={K.amber}>{needBody}</T>
            <Btn label="Open camera" onPress={() => a.takePhoto(j.id, id, need!)} />
          </Card>
        )}

        {/* Completed: payout */}
        {done && breakdown && (
          <Card>
            <Eyebrow>YOUR PAYOUT FOR THIS JOB</Eyebrow>
            {breakdown.lines.map((l) => <KV key={l.label} k={l.label} v={`$${l.amount.toFixed(2)}`} />)}
            <Row>
              <T s={16} w="b">Total</T>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Chip label={payout?.status === 'sent' ? 'Sent' : 'Pending'} {...(payout?.status === 'sent' ? chipFor.lime : chipFor.pill)} />
                <T s={18} w="b" c={K.lime}>{`$${(payout ? payout.override ?? payout.computed : breakdown.total).toFixed(2)}`}</T>
              </View>
            </Row>
          </Card>
        )}

        {/* Not taken yet: this is an offer */}
        {!assigned && j.offers.some((o) => o.workerId === id && o.outcome === 'offered') && j.crew.length < j.seats && (
          <Btn label="TAKE" onPress={() => take.ask(j)} />
        )}

        {assigned && !done && (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Btn kind="secondary" label="Something’s up" flex onPress={() => setSheet('menu')} />
            <Btn kind="secondary" label="Add expense" flex onPress={() => { setAmount(''); setWhat(''); setReceipt(false); setSheet('expense'); }} />
          </View>
        )}

        {assigned && !done && next && (j.status === 'Booked' || online) && (
          <SlideBar label={next.label} locked={!!need} lockedLabel="Take the photo to continue" onDone={() => a.slide(j.id, id, next.kind, next.stop)} />
        )}
        {assigned && ['Assigning', 'Quoted', 'Queued'].includes(j.status) && (
          <T s={13} c={K.muted} center>Waiting on the customer to accept the quote. The slide appears once the job is booked.</T>
        )}
        {done && <DispatcherCard name={disp.name} phone={disp.phone} label="JOB DISPATCHER" />}
      </Page>

      {/* Something's up · menu (Figma 58:91) */}
      <Sheet visible={sheet === 'menu'} onClose={() => setSheet(null)}>
        <SheetTitle>Something’s up?</SheetTitle>
        <T s={14} c={K.muted}>Pick one. A text to your dispatcher opens with your template filled in.</T>
        {UPS.map((u) => (
          <Pressable key={u.key} onPress={() => openUp(u.key)} style={({ pressed }) => ({ backgroundColor: u.red ? K.redBg : K.pill, borderRadius: 14, padding: 14, gap: 2, opacity: pressed ? 0.85 : 1 })}>
            <T s={16} w="s" c={u.red ? K.red : K.text}>{u.title}</T>
            <T s={13} c={u.red ? K.red : K.muted}>{u.sub}</T>
          </Pressable>
        ))}
        <Btn kind="secondary" label="Cancel" onPress={() => setSheet(null)} />
      </Sheet>

      {/* Running late (Figma 58:113) and the other templates */}
      <Sheet visible={!!sheet && sheet !== 'menu' && sheet !== 'expense' && sheet !== "I can't make it"} onClose={() => setSheet(null)}>
        <SheetTitle>{UPS.find((u) => u.key === sheet)?.title ?? ''}</SheetTitle>
        {sheet === 'Running late' && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {MINUTES.map((m) => (
              <Pressable key={m} onPress={() => { setMinutes(m); setMsg(fillTemplate(w.templates?.['Running late'] ?? '', { dispatcher: disp.name, me: w.name, job: j, minutes: m })); }}
                style={{ flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: minutes === m ? K.lime : K.pill }}>
                <T s={13} w="s" c={minutes === m ? K.ink : K.text}>{`${m} min`}</T>
              </Pressable>
            ))}
          </View>
        )}
        <Field label="Message (your template — edit before sending)" value={msg} onChangeText={setMsg} multiline />
        <Btn label="Text dispatcher" onPress={() => { a.customerRequest(j.id, "Something's up", msg); textDispatcher(msg); setSheet(null); }} />
        <Btn kind="secondary" label="Cancel" onPress={() => setSheet(null)} />
      </Sheet>

      {/* I can't make it (Figma 58:137) */}
      <Sheet visible={sheet === "I can't make it"} onClose={() => setSheet(null)}>
        <SheetTitle>Give this job back?</SheetTitle>
        <View style={{ backgroundColor: K.redBg, borderRadius: 14, padding: 14, gap: 4 }}>
          <T s={15} w="s" c={K.red}>This lowers your rating.</T>
          <T s={13} c={K.red}>{`Now ${w.rating.toFixed(1)} / 10 → about ${(w.rating - 0.5).toFixed(1)}. Below 8 you stop getting offers.`}</T>
        </View>
        <Field label="Message (your template — edit before sending)" value={msg} onChangeText={setMsg} multiline />
        <T s={12} c={K.muted}>Your seat goes back to the cascade and your dispatcher is alerted.</T>
        <Btn label="Give it back & text dispatcher" onPress={() => { a.giveBack(j.id, id); textDispatcher(msg); setSheet(null); }} />
        <Btn kind="secondary" label="Keep the job" onPress={() => setSheet(null)} />
      </Sheet>

      {/* Add expense (Figma 58:153) */}
      <Sheet visible={sheet === 'expense'} onClose={() => setSheet(null)}>
        <SheetTitle>Add expense</SheetTitle>
        <Field label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="$8.00" />
        <Field label="What for" value={what} onChangeText={setWhat} placeholder="Parking" />
        <View style={{ backgroundColor: K.pill, borderRadius: 14, padding: 16, gap: 8 }}>
          <Eyebrow>RECEIPT PHOTO · REQUIRED</Eyebrow>
          <T s={14} c={receipt ? K.text : K.muted}>{receipt ? 'Receipt photo taken ✓' : 'No photo, no save.'}</T>
          <Btn kind="secondary" label={receipt ? 'Retake photo' : 'Take photo of receipt'} onPress={() => setReceipt(true)} />
        </View>
        <Btn label="Save expense" disabled={!receipt || !amount || !what} onPress={() => { a.addExpense(j.id, id, amount, what); setSheet(null); }} />
        <T s={12} c={K.muted}>Save unlocks once the receipt photo is taken.</T>
      </Sheet>

      {take.sheets}
      <ItsYours visible={take.won} onDone={take.clearWon} />
    </View>
  );
}
