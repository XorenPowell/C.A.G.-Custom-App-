import { useState } from 'react';
import { Linking, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Btn, Card, Check, Chip, ChipRow, Eyebrow, Field, H2, KV, P, Screen, Sheet } from '../../../ui';
import { CATEGORY_QUESTIONS, customerStatus, jobPrice, payLabel, statusTone, useStore } from '../../../store';
import { C } from '../../../theme';

const TRACK = ['Inquiry sent', 'Quote ready', 'Booked', 'On the way', 'Working', 'Completed'];

export default function CustomerJob() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { s, a } = useStore();
  const j = s.jobs.find((x) => x.id === id);
  const [agree, setAgree] = useState(false);
  const [sheet, setSheet] = useState<null | 'change'>(null);
  const [kind, setKind] = useState<'Change something' | 'Cancel the job' | 'Report a problem'>('Change something');
  const [text, setText] = useState('');
  if (!j) return <Screen title="Job" back><P>This job could not be loaded.</P></Screen>;

  const st = customerStatus(j.status);
  const ended = ['Cancelled', 'Lost', 'Rejected'].includes(j.status);
  const at = TRACK.indexOf(st);
  const crew = j.crew.map((c) => s.workers.find((w) => w.id === c.workerId)).filter(Boolean);

  return (
    <Screen title={`${j.service} · ${j.number}`} back>
      <Chip label={st} tone={statusTone(st)} />
      {!ended && (
        <Card>
          {TRACK.map((t, i) => (
            <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: i <= at ? C.lime : C.pill }} />
              <P color={i <= at ? C.text : C.muted}>{t}</P>
            </View>
          ))}
        </Card>
      )}
      {ended && <Card><P>{`This job was ${j.status.toLowerCase()}${j.ending ? ` · ${j.ending.reason}` : ''}.`}</P></Card>}

      {j.status === 'Quoted' && (
        <Card style={{ borderWidth: 1, borderColor: C.lime }}>
          <Eyebrow>{j.quoteType === 'estimate' ? 'Estimate' : 'Fixed price'}</Eyebrow>
          <H2>{jobPrice(j)}</H2>
          {j.quoteType === 'estimate' && <P>{`About ${j.estHours} hours. You pay for the real time, ${j.minHours} hours minimum.`}</P>}
          <KV k="Date" v={j.date} />
          <KV k="Arrival" v={j.arrival} />
          <KV k="Crew" v={`${j.crew.length} ${j.crew.length === 1 ? 'person' : 'people'}`} />
          {!j.agreementSigned && (
            <Check label="I agree to the customer agreement" sub="Signed once, on your first job." checked={agree} onToggle={() => setAgree(!agree)} />
          )}
          <Btn label="Accept quote" disabled={!j.agreementSigned && !agree} onPress={() => a.acceptQuote(j.id)} />
          <Btn kind="secondary" label="Ask a question" onPress={() => { setKind('Change something'); setSheet('change'); }} />
        </Card>
      )}

      {['Booked', 'On the way', 'Working', 'Completed'].includes(j.status) && crew.length > 0 && (
        <Card>
          <Eyebrow>Who's coming</Eyebrow>
          {crew.map((w) => (
            <KV key={w!.id} k={w!.name.split(' ')[0]} v={w!.vehicle} />
          ))}
          {j.status === 'On the way' && <Chip label="ETA about 20 min (live map later)" tone="blue" />}
        </Card>
      )}

      <Card>
        <Eyebrow>The job</Eyebrow>
        <KV k="Date" v={j.date || 'To confirm'} />
        <KV k="Arrival" v={j.arrival || 'To confirm'} />
        {j.stops.map((x, i) => <KV key={i} k={`Stop ${i + 1}`} v={x} />)}
        {(CATEGORY_QUESTIONS[j.service] ?? []).map((q) => <KV key={q.id} k={q.label} v={j.answers[q.id] ?? '—'} />)}
        <KV k="On site" v={j.onsiteSame ? j.payer.name : `${j.onsite.name} · ${j.onsite.phone}`} />
      </Card>

      {(j.status === 'Completed' || j.pay !== 'none') && (
        <Card>
          <Eyebrow>Charges & payment</Eyebrow>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <H2>{j.amountPaid ? `$${j.amountPaid}` : jobPrice(j)}</H2>
            <Chip label={payLabel[j.pay]} tone={statusTone(payLabel[j.pay])} />
          </View>
          {j.tip ? <KV k="Tip" v={`$${j.tip}`} /> : null}
          {j.squareLink ? (
            j.pay === 'paid' ? (
              <Btn kind="secondary" label="View receipt (Square)" onPress={() => Linking.openURL(j.squareLink)} />
            ) : (
              <Btn label="Pay (opens Square)" onPress={() => Linking.openURL(j.squareLink)} />
            )
          ) : (
            <P>Your dispatcher will send the bill.</P>
          )}
          <P>Payments are handled by Square. We never see or store your card.</P>
        </Card>
      )}

      {j.requests.length > 0 && (
        <Card>
          <Eyebrow>Your requests</Eyebrow>
          {j.requests.map((r, i) => <KV key={i} k={r.kind} v={r.text} />)}
        </Card>
      )}

      {!ended && j.status !== 'Completed' && (
        <Btn kind="secondary" label="Request a change or cancel" onPress={() => setSheet('change')} />
      )}

      <Sheet visible={sheet === 'change'} onClose={() => setSheet(null)} title="Tell your dispatcher">
        <ChipRow options={['Change something', 'Cancel the job', 'Report a problem'] as const} value={kind} onChange={setKind} />
        <Field label="What's up?" value={text} onChangeText={setText} multiline />
        <P>This goes to your dispatcher as a text. They'll get back to you.</P>
        <Btn label="Send" disabled={!text} onPress={() => { a.customerRequest(j.id, kind, text); setText(''); setSheet(null); }} />
      </Sheet>
    </Screen>
  );
}
