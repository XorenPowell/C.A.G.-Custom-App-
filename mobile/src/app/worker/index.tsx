import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Avatar, Btn, Chip, DispatcherCard, ItsYours, K, MenuDrawer, Page, Row, T, chipFor } from '../../wk';
import { crewPhrase, dispatcherOf, greeting, jobTitle, stopsPhrase, useMe, useTake } from '../../worker-data';
import { Job } from '../../store';

const money0 = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

/** Worker / Home (Figma 57:2). */
export default function WorkerHome() {
  const { s, a, id, w } = useMe();
  const [menu, setMenu] = useState(false);
  const [tick, setTick] = useState(Date.now());
  const take = useTake();
  const fired = useRef<Set<string>>(new Set());
  const wait = Number(s.settings.waitSeconds) || 60;

  useEffect(() => {
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const offers = s.jobs.filter((j) => j.crew.length < j.seats && j.offers.some((o) => o.workerId === id && o.outcome === 'offered'));
  const mine = s.jobs.filter((j) => j.crew.some((c) => c.workerId === id) && ['Assigning', 'Queued', 'Quoted', 'Booked', 'On the way', 'Working'].includes(j.status));

  // When my window runs out, the offer passes to the next worker (no decline).
  useEffect(() => {
    for (const j of offers) {
      const o = j.offers.find((x) => x.workerId === id && x.outcome === 'offered');
      const key = j.id + String(o?.offeredAt);
      if (o?.offeredAt && tick - o.offeredAt > wait * 1000 && !fired.current.has(key)) {
        fired.current.add(key);
        a.advanceCascade(j.id);
      }
    }
  }, [tick]); // eslint-disable-line react-hooks/exhaustive-deps

  // Earnings strip from this worker's payouts.
  const pays = s.payouts.filter((p) => p.workerId === id).map((p) => ({ amt: p.override ?? p.computed, at: s.jobs.find((j) => j.id === p.jobId)?.completedAt ?? 0, sent: p.status === 'sent' }));
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(startOfDay); startOfWeek.setDate(startOfDay.getDate() - ((startOfDay.getDay() + 6) % 7));
  const sum = (f: (p: (typeof pays)[number]) => boolean) => pays.filter(f).reduce((t, p) => t + p.amt, 0);
  const stats: [string, string][] = [
    ['Today', money0(sum((p) => p.at >= startOfDay.getTime()))],
    ['This week', money0(sum((p) => p.at >= startOfWeek.getTime()))],
    ['Paid YTD', money0(sum((p) => p.sent))],
  ];

  const disp = dispatcherOf(s, mine[0] ?? offers[0]);

  return (
    <View style={{ flex: 1 }}>
      <Page>
        {/* Header */}
        <Row>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Avatar name={w.name} />
            <View style={{ gap: 2 }}>
              <T s={13} c={K.muted}>{greeting()}</T>
              <T s={17} w="s">{w.name}</T>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Chip label={`★ ${w.rating.toFixed(1)} / 10`} {...chipFor.lime} />
            <Pressable onPress={() => setMenu(true)} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: K.card, alignItems: 'center', justifyContent: 'center' }}>
              <T s={18} w="b">≡</T>
            </Pressable>
          </View>
        </Row>

        {/* Stats */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {stats.map(([k, v]) => (
            <View key={k} style={{ flex: 1, backgroundColor: K.card, borderRadius: 16, padding: 12, gap: 4 }}>
              <T s={12} c={K.muted}>{k}</T>
              <T s={18} w="b">{v}</T>
            </View>
          ))}
        </View>

        {/* Offers */}
        {offers.map((j) => <OfferCard key={j.id} j={j} workerId={id} tick={tick} wait={wait} onTake={() => take.ask(j)} />)}

        {/* Assignments */}
        <Row>
          <T s={18} w="s">Assignments</T>
          <T s={13} c={K.muted}>{`${mine.length} ${mine.length === 1 ? 'job' : 'jobs'}`}</T>
        </Row>
        {mine.length === 0 && (
          <View style={{ backgroundColor: K.card, borderRadius: 18, padding: 16 }}>
            <T s={14} c={K.muted}>No assignments yet. Offers show up above.</T>
          </View>
        )}
        {mine.map((j) => <AssignmentCard key={j.id} j={j} workerId={id} />)}

        <DispatcherCard name={disp.name} phone={disp.phone} />
      </Page>

      {take.sheets}
      <ItsYours visible={take.won} onDone={take.clearWon} />
      <MenuDrawer visible={menu} onClose={() => setMenu(false)} name={w.name} rating={w.rating} active="Home" onSignOut={() => { a.signOut(); router.replace('/'); }} />
    </View>
  );
}

function OfferCard({ j, workerId, tick, wait, onTake }: { j: Job; workerId: string; tick: number; wait: number; onTake: () => void }) {
  const o = j.offers.find((x) => x.workerId === workerId && x.outcome === 'offered');
  const left = Math.max(0, Math.ceil(((o?.offeredAt ?? tick) + wait * 1000 - tick) / 1000));
  const est = j.estPay ?? (j.fixedTotal ? Math.round((Number(j.fixedTotal) * 0.8) / j.seats) : 0);
  return (
    <View style={{ backgroundColor: K.lime, borderRadius: 24, padding: 18, gap: 10 }}>
      <Row>
        <Chip label="NEW JOB" bg={K.ink} c={K.lime} />
        <Chip label={`${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`} bg={K.ink} c={K.text} />
      </Row>
      <T s={22} w="b" c={K.ink}>{jobTitle(j)}</T>
      <T s={14} w="m" c={K.ink}>{`${j.zone} · ${j.date}, arrive ${j.arrival}`}</T>
      <T s={14} w="m" c={K.ink}>{`${stopsPhrase(j.stops.length)} · ${crewPhrase(j)}${est ? ` · Est. $${est}` : ''}`}</T>
      <T s={14} w="s" c={K.ink}>{`Bring: ${j.needs.map((n, i) => (i === 0 ? n.toLowerCase() : n.toLowerCase())).join(', ') || 'nothing special'}`}</T>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Btn dark kind="secondary" label="See details" h={46} flex onPress={() => router.push(`/worker/job/${j.id}`)} />
        <Btn dark label="TAKE" h={46} flex onPress={onTake} />
      </View>
    </View>
  );
}

function AssignmentCard({ j, workerId }: { j: Job; workerId: string }) {
  const c = j.crew.find((x) => x.workerId === workerId);
  const pending = ['Assigning', 'Queued', 'Quoted'].includes(j.status);
  const role = j.seats <= 1 ? 'Solo' : c?.leader ? 'Crew lead' : 'Crew';
  const est = j.estPay ? ` · $${j.estPay} est.` : '';
  const chip =
    pending ? <Chip label="Pending" {...chipFor.amber} />
      : j.status === 'Booked' ? <Chip label="Scheduled" {...chipFor.pill} />
      : <Chip label={j.status} {...chipFor.blue} />;
  const lead = j.status === 'Booked' && j.onlineBy ? `En Route: ${j.onlineBy}` : j.status === 'On the way' ? 'On the way now' : j.status === 'Working' ? 'Working now' : null;
  return (
    <Pressable onPress={() => router.push(`/worker/job/${j.id}`)}
      style={({ pressed }) => ({ backgroundColor: pending ? 'rgba(41,43,48,0.7)' : K.card, borderRadius: 18, padding: 16, gap: 8, opacity: pressed ? 0.85 : 1 })}>
      <Row>
        {lead ? <T s={13} w="s" c={K.lime}>{lead}</T> : null}
        {chip}
      </Row>
      <T s={16} w="s">{`${jobTitle(j)} · ${j.zone}`}</T>
      <T s={13} c={K.muted}>{`Arrive ${j.arrival} · ${stopsPhrase(j.stops.length)} · ${role}${est}`}</T>
    </Pressable>
  );
}
