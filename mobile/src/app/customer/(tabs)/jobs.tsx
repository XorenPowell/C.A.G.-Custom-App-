import { router } from 'expo-router';
import { Chip, Empty, Row, Screen } from '../../../ui';
import { customerStatus, statusTone, useStore } from '../../../store';

export default function CustomerJobs() {
  const { s } = useStore();
  const mine = s.jobs.filter((j) => j.customerAccountId === s.me);
  return (
    <Screen title="My jobs">
      {mine.length === 0 && <Empty text="No jobs yet. Jobs booked with your phone or email appear here once confirmed." />}
      {mine.map((j) => {
        const st = customerStatus(j.status);
        return <Row key={j.id} title={`${j.service} · ${j.number}`} sub={j.date} right={<Chip label={st} tone={statusTone(st)} />} onPress={() => router.push(`/customer/job/${j.id}`)} />;
      })}
    </Screen>
  );
}
