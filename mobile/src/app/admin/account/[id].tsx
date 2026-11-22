import { useLocalSearchParams } from 'expo-router';
import { Btn, Card, Chip, ChipRow, Eyebrow, KV, P, Row, Screen } from '../../../ui';
import { Role, money, useStore } from '../../../store';

const ROLES = ['Customer', 'Worker', 'Dispatcher', 'Local Admin'] as const;
const KEY: Record<(typeof ROLES)[number], Role> = { Customer: 'customer', Worker: 'worker', Dispatcher: 'dispatcher', 'Local Admin': 'local_admin' };
const LABEL = Object.fromEntries(Object.entries(KEY).map(([k, v]) => [v, k])) as Record<Role, (typeof ROLES)[number]>;

/** Account detail: change role, see their data, deactivate / reactivate (canvas 3.5.1). */
export default function AccountDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { s, a } = useStore();
  const acc = s.accounts.find((x) => x.id === id);
  if (!acc) return <Screen title="Account" back><P>This account could not be loaded.</P></Screen>;
  const w = s.workers.find((x) => x.id === acc.workerId);
  const jobs = acc.role === 'customer' ? s.jobs.filter((j) => j.customerAccountId === acc.id) : w ? s.jobs.filter((j) => j.crew.some((c) => c.workerId === w.id)) : [];
  const payouts = w ? s.payouts.filter((p) => p.workerId === w.id) : [];
  return (
    <Screen title={acc.name} back>
      <Chip label={acc.active ? 'Active' : 'Deactivated'} tone={acc.active ? 'green' : 'red'} />
      <Card>
        <KV k="Phone" v={acc.phone || '—'} />
        <KV k="Email" v={acc.email || '—'} />
      </Card>
      <Eyebrow>Role</Eyebrow>
      <ChipRow options={ROLES} value={LABEL[acc.role]} onChange={(r) => a.setRole(acc.id, KEY[r])} />
      {w && (
        <Card>
          <Eyebrow>Worker</Eyebrow>
          <KV k="Rating" v={w.rating.toFixed(1)} />
          <KV k="Payout method" v={w.payoutMethod} />
          <KV k="Paperwork" v={`${w.docs.filter((d) => d.status === 'approved').length} of ${w.docs.length} approved`} />
          <KV k="Paid all time" v={money(payouts.filter((p) => p.status === 'sent').reduce((t, p) => t + (p.override ?? p.computed), 0))} />
        </Card>
      )}
      <Eyebrow>{`Jobs · ${jobs.length}`}</Eyebrow>
      {jobs.map((j) => <Row key={j.id} title={`${j.number} · ${j.service}`} sub={`${j.date} · ${j.status}`} />)}
      <Btn kind={acc.active ? 'danger' : 'primary'} label={acc.active ? 'Deactivate' : 'Reactivate'} onPress={() => a.setAccountActive(acc.id, !acc.active)} />
      <P>Deactivated accounts keep every job, payout and tax record.</P>
    </Screen>
  );
}
