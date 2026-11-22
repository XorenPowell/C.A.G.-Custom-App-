import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { BackHeader, Card, Chip, K, Page, Row, T, chipFor } from '../../wk';
import { jobTitle, useMe } from '../../worker-data';
import { JobStatus } from '../../store';

const FILTERS = ['Upcoming', 'Working', 'Completed'] as const;
const GROUP: Record<(typeof FILTERS)[number], JobStatus[]> = {
  Upcoming: ['Assigning', 'Queued', 'Quoted', 'Booked'],
  Working: ['On the way', 'Working'],
  Completed: ['Completed'],
};

/** Worker / Jobs (Figma 22:4). */
export default function WorkerJobs() {
  const { s, id } = useMe();
  const [f, setF] = useState<(typeof FILTERS)[number]>('Upcoming');
  const list = s.jobs.filter((j) => j.crew.some((c) => c.workerId === id) && GROUP[f].includes(j.status));
  return (
    <Page header={<BackHeader title="Jobs" />}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {FILTERS.map((x) => (
          <Pressable key={x} onPress={() => setF(x)} style={{ borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: x === f ? K.lime : K.pill }}>
            <T s={13} w="s" c={x === f ? K.ink : K.muted}>{x}</T>
          </Pressable>
        ))}
      </View>
      {list.length === 0 && <Card><T s={14} c={K.muted}>Nothing here.</T></Card>}
      {list.map((j) => {
        const pending = ['Assigning', 'Queued', 'Quoted'].includes(j.status);
        const chip = f === 'Completed' ? { label: 'Completed', ...chipFor.pill } : f === 'Working' ? { label: j.status, ...chipFor.blue } : pending ? { label: 'Pending', ...chipFor.amber } : { label: 'Upcoming', ...chipFor.blue };
        return (
          <Card key={j.id} onPress={() => router.push(`/worker/job/${j.id}`)}>
            <Row>
              <T s={16} w="s" style={{ flexShrink: 1 }}>{jobTitle(j)}</T>
              <Chip label={chip.label} bg={chip.bg} c={chip.c} />
            </Row>
            <T s={13} c={K.muted}>{`${j.date} · ${j.arrival} · ${j.zone}`}</T>
          </Card>
        );
      })}
    </Page>
  );
}
