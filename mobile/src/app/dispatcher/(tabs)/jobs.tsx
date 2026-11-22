import { useState } from 'react';
import { TextInput } from 'react-native';
import { router } from 'expo-router';
import { Btn, Chip, ChipRow, Empty, Row, Screen } from '../../../ui';
import { digits, statusTone, useStore } from '../../../store';
import { C } from '../../../theme';

const FILTERS = ['Open', 'Inquiry', 'Assigning', 'Queued', 'Quoted', 'Booked', 'Live', 'Completed', 'Ended', 'All'] as const;

export default function DispatcherJobs() {
  const { s } = useStore();
  const [f, setF] = useState<(typeof FILTERS)[number]>('Open');
  const [q, setQ] = useState('');
  const match = (st: string) =>
    f === 'All' ? true
      : f === 'Open' ? !['Completed', 'Cancelled', 'Lost', 'Rejected'].includes(st)
      : f === 'Live' ? ['On the way', 'Working'].includes(st)
      : f === 'Ended' ? ['Cancelled', 'Lost', 'Rejected'].includes(st)
      : st === f;
  const qq = q.trim().toLowerCase();
  const list = s.jobs.filter((j) => match(j.status) && (!qq || [j.number, j.payer.name, j.service, j.payer.email].some((x) => x.toLowerCase().includes(qq)) || (digits(qq).length > 3 && digits(j.payer.phone).includes(digits(qq)))));
  return (
    <Screen title="Jobs" right={<Btn small label="+ New" onPress={() => router.push('/dispatcher/new-job')} />}>
      <TextInput value={q} onChangeText={setQ} placeholder="Search name, phone, job number" placeholderTextColor={C.muted}
        style={{ backgroundColor: C.pill, borderRadius: 14, padding: 14, color: C.text, fontSize: 15 }} />
      <ChipRow options={FILTERS} value={f} onChange={setF} wrap={false} />
      {list.length === 0 && <Empty text="No jobs match." />}
      {list.map((j) => (
        <Row key={j.id} title={`${j.payer.name || 'No name'} · ${j.service}`} sub={`${j.number} · ${j.date || 'No date'} · ${j.crew.length}/${j.seats} crew`}
          right={<Chip label={j.status} tone={statusTone(j.status)} />} onPress={() => router.push(`/dispatcher/job/${j.id}`)} />
      ))}
    </Screen>
  );
}
