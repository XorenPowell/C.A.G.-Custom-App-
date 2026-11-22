import { useState } from 'react';
import { View } from 'react-native';
import { Btn, Card, Chip, Field, H2, KV, P, Screen } from '../../ui';
import { dispatchable, docState, fmtDate, useStore } from '../../store';

const tone = { approved: 'green', pending: 'amber', rejected: 'red', missing: 'red' } as const;

/** Approve or reject paperwork. No reminders; expiry is read from the stored dates (canvas 2.7.1). */
export default function Vetting() {
  const { s, a } = useStore();
  const [reason, setReason] = useState('');
  return (
    <Screen title="Vetting" back>
      {s.workers.map((w) => (
        <Card key={w.id}>
          <H2>{w.name}</H2>
          <Chip label={dispatchable(w) ? 'Can be dispatched' : 'Not dispatchable'} tone={dispatchable(w) ? 'green' : 'red'} />
          {w.docs.map((d) => (
            <View key={d.type} style={{ gap: 6 }}>
              <KV k={`${d.type}${d.expires ? ' · exp ' + fmtDate(d.expires) : ''}`} v={docState(d)} />
              {d.status === 'pending' && (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}><Btn small label="Approve" onPress={() => a.reviewDoc(w.id, d.type, 'approved')} /></View>
                  <View style={{ flex: 1 }}><Btn small kind="danger" label="Reject" onPress={() => a.reviewDoc(w.id, d.type, 'rejected', reason || 'Unreadable')} /></View>
                </View>
              )}
              {d.status === 'missing' && <Chip label="Not uploaded" tone={tone.missing} />}
            </View>
          ))}
        </Card>
      ))}
      <Field label="Rejection reason (used by Reject)" value={reason} onChangeText={setReason} />
      <P>The worker sees the reason on their Paperwork screen.</P>
    </Screen>
  );
}
