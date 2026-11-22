import { useState } from 'react';
import { TextInput } from 'react-native';
import { router } from 'expo-router';
import { Btn, Chip, ChipRow, Empty, Row, Screen } from '../../../ui';
import { digits, Role, useStore } from '../../../store';
import { C } from '../../../theme';

const ROLE_LABEL: Record<Role, string> = { customer: 'Customer', worker: 'Worker', dispatcher: 'Dispatcher', local_admin: 'Local Admin' };
const FILTERS = ['All', 'Customer', 'Worker', 'Dispatcher', 'Local Admin', 'Deactivated'] as const;

export default function Accounts() {
  const { s } = useStore();
  const [q, setQ] = useState('');
  const [f, setF] = useState<(typeof FILTERS)[number]>('All');
  const qq = q.trim().toLowerCase();
  const list = s.accounts.filter((x) =>
    (f === 'All' || (f === 'Deactivated' ? !x.active : ROLE_LABEL[x.role] === f)) &&
    (!qq || x.name.toLowerCase().includes(qq) || x.email.toLowerCase().includes(qq) || (digits(qq).length > 3 && digits(x.phone).includes(digits(qq)))));
  return (
    <Screen title="Accounts" right={<Btn small label="+ Create" onPress={() => router.push('/admin/create-account')} />}>
      <TextInput value={q} onChangeText={setQ} placeholder="Search name, phone or email" placeholderTextColor={C.muted}
        style={{ backgroundColor: C.pill, borderRadius: 14, padding: 14, color: C.text, fontSize: 15 }} />
      <ChipRow options={FILTERS} value={f} onChange={setF} wrap={false} />
      {list.length === 0 && <Empty text="No accounts match." />}
      {list.map((x) => (
        <Row key={x.id} title={x.name} sub={`${ROLE_LABEL[x.role]} · ${x.phone || x.email}`} right={<Chip label={x.active ? 'Active' : 'Deactivated'} tone={x.active ? 'green' : 'red'} />}
          onPress={() => router.push(`/admin/account/${x.id}`)} />
      ))}
    </Screen>
  );
}
