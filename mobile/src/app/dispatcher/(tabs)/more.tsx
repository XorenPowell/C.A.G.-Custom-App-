import { useState } from 'react';
import { router } from 'expo-router';
import { Btn, Card, Eyebrow, H2, KV, P, Row, Screen } from '../../../ui';
import { clock, money, useStore } from '../../../store';

export default function DispatcherMore() {
  const { s, a } = useStore();
  const [clockedIn, setClockedIn] = useState<number | null>(null);
  const done = s.jobs.filter((j) => j.status === 'Completed');
  const noInvoice = done.filter((j) => !j.squareLink);
  const commission = done.reduce((t, j) => t + (Number(j.amountPaid || j.fixedTotal || 0) * Number(s.settings.commission)) / 100, 0);
  return (
    <Screen title="More">
      <Card>
        <Eyebrow>Time clock</Eyebrow>
        <H2>{clockedIn ? `Clocked in at ${clock(clockedIn)}` : 'Clocked out'}</H2>
        <Btn label={clockedIn ? 'Clock out' : 'Clock in'} onPress={() => setClockedIn(clockedIn ? null : Date.now())} />
      </Card>
      <Card>
        <Eyebrow>Money (my jobs)</Eyebrow>
        <KV k="Commission, completed jobs" v={money(commission)} />
        <KV k="Completed with no Square link" v={String(noInvoice.length)} color={noInvoice.length ? '#FF7878' : undefined} />
      </Card>
      {noInvoice.map((j) => <Row key={j.id} tone="red" title={`${j.number} · ${j.payer.name}`} sub="Completed — paste the Square invoice link" onPress={() => router.push(`/dispatcher/job/${j.id}`)} />)}
      <Row title="Reports" sub="The reports the Local Admin gave you (mockup)" />
      <Row title="Roster" sub={`${s.workers.length} workers`} />
      <P>Reports, roster, visits, cards and face-to-face come in the next pass.</P>
      <Btn kind="secondary" label="Reset mock data" onPress={() => a.reset()} />
      <Btn kind="secondary" label="Switch role (mockup)" onPress={() => { a.signOut(); router.replace('/'); }} />
    </Screen>
  );
}
