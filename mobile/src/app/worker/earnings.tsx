import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { BackHeader, Card, Chip, Eyebrow, K, Page, Row, T, chipFor } from '../../wk';
import { jobTitle, useMe } from '../../worker-data';
import { payoutBreakdown } from '../../store';

const RANGES = ['Today', 'This week', 'This month', 'All time'] as const;
const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const fmt = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

/** Worker / Earnings (Figma 21:90). */
export default function WorkerEarnings() {
  const { s, id, w } = useMe();
  const [range, setRange] = useState<(typeof RANGES)[number]>('This week');

  const day0 = new Date(); day0.setHours(0, 0, 0, 0);
  const week0 = new Date(day0); week0.setDate(day0.getDate() - ((day0.getDay() + 6) % 7));
  const month0 = new Date(day0.getFullYear(), day0.getMonth(), 1);
  const year0 = new Date(day0.getFullYear(), 0, 1);
  const from = { Today: day0, 'This week': week0, 'This month': month0, 'All time': new Date(0) }[range].getTime();

  const rows = s.payouts
    .filter((p) => p.workerId === id)
    .map((p) => {
      const j = s.jobs.find((x) => x.id === p.jobId);
      const c = j?.crew.find((x) => x.workerId === id);
      const hrs = c ? payoutBreakdown(c, w).hours : 0;
      return { p, j, amt: p.override ?? p.computed, at: j?.completedAt ?? 0, hrs: hrs || Number(j?.estHours || 0) || 0 };
    })
    .sort((a, b) => b.at - a.at);

  const ytd = rows.filter((r) => r.p.status === 'sent' && r.at >= year0.getTime()).reduce((t, r) => t + r.amt, 0);
  const pending = rows.filter((r) => r.p.status === 'pending');
  const inRange = rows.filter((r) => r.at >= from);
  const perDay = DAYS.map((_, i) => {
    const start = new Date(week0); start.setDate(week0.getDate() + i);
    const end = new Date(start); end.setDate(start.getDate() + 1);
    return rows.filter((r) => r.at >= start.getTime() && r.at < end.getTime()).reduce((t, r) => t + r.amt, 0);
  });
  const max = Math.max(1, ...perDay);

  return (
    <Page header={<BackHeader title="Earnings" />}>
      <Card style={{ padding: 20 }}>
        <Eyebrow>YEAR TO DATE</Eyebrow>
        <T s={34} w="b" style={{ lineHeight: 41 }}>{fmt(ytd)}</T>
        <T s={14} c={K.muted}>{`${pending.length} ${pending.length === 1 ? 'payout' : 'payouts'} pending · ${fmt(pending.reduce((t, r) => t + r.amt, 0))}`}</T>
      </Card>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {RANGES.map((r) => (
          <Pressable key={r} onPress={() => setRange(r)} style={{ borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16, backgroundColor: r === range ? K.lime : K.pill }}>
            <T s={14} w="s" c={r === range ? K.ink : K.muted}>{r}</T>
          </Pressable>
        ))}
      </ScrollView>

      <Card style={{ gap: 14 }}>
        <Row>
          <Eyebrow>DAILY · THIS WEEK</Eyebrow>
          <T s={14} w="s">{fmt(perDay.reduce((a, b) => a + b, 0))}</T>
        </Row>
        <View style={{ height: 130, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          {perDay.map((v, i) => (
            <View key={i} style={{ width: 45, alignItems: 'center', gap: 6 }}>
              <View style={{ width: 28, height: v ? Math.max(8, Math.round((v / max) * 80)) : 4, borderRadius: 6, backgroundColor: v ? K.lime : K.pill }} />
              <T s={12} w="m" c={K.muted}>{DAYS[i]!}</T>
            </View>
          ))}
        </View>
        <T s={11} c={K.muted}>Bars show payout per day.</T>
      </Card>

      <Eyebrow>PAYOUTS</Eyebrow>
      {inRange.length === 0 && <Card><T s={14} c={K.muted}>{`No payouts ${range === 'All time' ? 'yet' : range.toLowerCase()}.`}</T></Card>}
      {inRange.map(({ p, j, amt, at, hrs }) => (
        <Card key={p.id}>
          <Row style={{ alignItems: 'flex-start' }}>
            <View style={{ gap: 3, flexShrink: 1 }}>
              <T s={16} w="s">{j ? jobTitle(j) : 'Job'}</T>
              <T s={13} c={K.muted}>{`${at ? new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}${hrs ? ` · ${hrs} hrs` : ''}`}</T>
            </View>
            <View style={{ gap: 6 }}>
              <T s={16} w="s">{fmt(amt)}</T>
              <Chip self="flex-start" label={p.status === 'sent' ? 'Sent' : 'Pending'} {...(p.status === 'sent' ? chipFor.lime : chipFor.pill)} />
            </View>
          </Row>
        </Card>
      ))}
    </Page>
  );
}
