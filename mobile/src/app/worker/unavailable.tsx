import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { BackHeader, Btn, Card, Chip, Eyebrow, Field, K, Page, Row, T, chipFor } from '../../wk';
import { useMe } from '../../worker-data';

const WEEKLY = /^(every\s+)?(mon|tue|wed|thu|fri|sat|sun)/i;

/** Worker / Unavailable times (Figma 58:302). Anything not blocked counts as available (canvas 4.8.4). */
export default function Unavailable() {
  const { a, w } = useMe();
  const [day, setDay] = useState('');
  const [from, setFrom] = useState('9:00 AM');
  const [to, setTo] = useState('5:00 PM');
  const add = () => {
    const weekly = WEEKLY.test(day.trim());
    const name = day.trim().replace(/^every\s+/i, '');
    a.addUnavailable(w.id, {
      title: weekly ? `Every ${name.charAt(0).toUpperCase()}${name.slice(1)}` : day.trim(),
      kind: weekly ? 'Weekly' : 'Once',
      when: from || to ? `${from} – ${to}` : 'All day',
    });
    setDay('');
  };
  return (
    <Page header={<BackHeader title="Unavailable times" />}>
      <T s={14} c={K.muted}>Block the times you can’t work. You’ll get offers any other time.</T>
      {(w.unavailable ?? []).map((b) => (
        <Card key={b.id} style={{ padding: 14, gap: 4, borderRadius: 16 }}>
          <Row>
            <T s={15} w="s">{b.title}</T>
            <Chip label={b.kind} {...chipFor.pill} />
          </Row>
          <Row>
            <T s={13} c={K.muted}>{b.when}</T>
            <Pressable onPress={() => a.removeUnavailable(w.id, b.id)} hitSlop={8}>
              <T s={13} w="s" c={K.red}>Remove</T>
            </Pressable>
          </Row>
        </Card>
      ))}
      <Card>
        <Eyebrow>ADD A BLOCK</Eyebrow>
        <Field label="Date or day" value={day} onChangeText={setDay} placeholder="Pick a date, or repeat weekly" />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Field label="From" value={from} onChangeText={setFrom} style={{ flex: 1 }} />
          <Field label="To" value={to} onChangeText={setTo} style={{ flex: 1 }} />
        </View>
        <Btn label="Add block" disabled={!day.trim()} onPress={add} />
      </Card>
    </Page>
  );
}
