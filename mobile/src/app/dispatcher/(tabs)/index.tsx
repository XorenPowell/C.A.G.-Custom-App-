import { router } from 'expo-router';
import { Btn, Chip, Eyebrow, H1, P, Row, Screen } from '../../../ui';
import { ago, useStore } from '../../../store';

/** The work queue: every next action across jobs and partnerships, in time order (canvas 2.11.2). */
export default function DispatcherQueue() {
  const { s } = useStore();
  const items = [
    ...s.jobs
      .filter((j) => j.nextAction && !['Completed', 'Cancelled', 'Lost', 'Rejected'].includes(j.status) || (j.status === 'Completed' && j.nextAction))
      .map((j) => ({ key: j.id, at: j.nextAction!.at, title: `${j.nextAction!.kind} · ${j.payer.name || j.number}`, sub: `${j.number} · ${j.service} · ${j.nextAction!.note}`, go: () => router.push(`/dispatcher/job/${j.id}`) })),
    ...s.partnerships.map((p) => ({ key: p.id, at: p.nextAction.at, title: `${p.nextAction.kind} · ${p.name}`, sub: `Partnership · ${p.nextAction.note}`, go: () => router.push('/dispatcher/field') })),
  ].sort((a, b) => a.at - b.at);
  const now = Date.now();
  const overdue = items.filter((i) => i.at < now);
  const later = items.filter((i) => i.at >= now);
  return (
    <Screen>
      <H1>Work queue</H1>
      <Btn label="+ New job" onPress={() => router.push('/dispatcher/new-job')} />
      <Eyebrow>{`Due now · ${overdue.length}`}</Eyebrow>
      {overdue.length === 0 && <P>Nothing overdue.</P>}
      {overdue.map((i) => <Row key={i.key} tone="red" title={i.title} sub={i.sub} right={<Chip label={ago(i.at)} tone="red" />} onPress={i.go} />)}
      <Eyebrow>Coming up</Eyebrow>
      {later.map((i) => <Row key={i.key} title={i.title} sub={i.sub} right={<Chip label={ago(i.at)} />} onPress={i.go} />)}
    </Screen>
  );
}
