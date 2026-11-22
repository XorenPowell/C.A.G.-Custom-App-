import { router } from 'expo-router';
import { Btn, Card, Chip, Eyebrow, H1, KV, P, Row, Screen } from '../../../ui';
import { customerStatus, jobPrice, payLabel, statusTone, useStore } from '../../../store';

export default function CustomerHome() {
  const { s } = useStore();
  const me = s.accounts.find((x) => x.id === s.me);
  const mine = s.jobs.filter((j) => j.customerAccountId === s.me);
  const active = mine.filter((j) => !['Completed', 'Cancelled', 'Lost', 'Rejected'].includes(j.status));
  const due = mine.filter((j) => j.status === 'Completed' && ['unpaid', 'partly_paid'].includes(j.pay));
  return (
    <Screen>
      <H1>{`Hi ${me?.name.split(' ')[0] ?? 'there'}`}</H1>
      <Btn label="Request a job" onPress={() => router.push('/customer/request')} />

      {due.map((j) => (
        <Row key={j.id} tone="red" title={`Payment due · ${j.number}`} sub={`${j.service} · ${payLabel[j.pay]}`} onPress={() => router.push(`/customer/job/${j.id}`)} />
      ))}

      <Eyebrow>Coming up</Eyebrow>
      {active.length === 0 && <P>No upcoming jobs.</P>}
      {active.map((j) => {
        const st = customerStatus(j.status);
        return (
          <Card key={j.id} onPress={() => router.push(`/customer/job/${j.id}`)}>
            <Chip label={st} tone={statusTone(st)} />
            <P color="#F5F7FA" style={{ fontSize: 17, fontWeight: '700' }}>{`${j.service} · ${j.date || 'Date to confirm'}`}</P>
            <KV k="Arrival" v={j.arrival || 'To confirm'} />
            <KV k="Price" v={jobPrice(j)} />
            {j.status === 'Quoted' && <Btn small label="Review your quote" onPress={() => router.push(`/customer/job/${j.id}`)} />}
          </Card>
        );
      })}
    </Screen>
  );
}
