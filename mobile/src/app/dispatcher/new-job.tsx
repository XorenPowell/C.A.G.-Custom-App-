import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Btn, Check, ChipRow, Eyebrow, Field, P, Screen } from '../../ui';
import { CATEGORY_QUESTIONS, SERVICES, ZONES, useStore } from '../../store';

/** A dispatcher enters a phone or text inquiry. It becomes a customer record, not an account (canvas 2.10.1). */
export default function NewJob() {
  const { a } = useStore();
  const [payer, setPayer] = useState({ name: '', phone: '', email: '' });
  const [same, setSame] = useState(true);
  const [onsite, setOnsite] = useState({ name: '', phone: '' });
  const [service, setService] = useState<(typeof SERVICES)[number]>('Moving');
  const [zone, setZone] = useState<(typeof ZONES)[number]>('Lakeview');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [stop, setStop] = useState('');
  const [date, setDate] = useState('');
  const [arrival, setArrival] = useState('');
  const [desc, setDesc] = useState('');
  const [notes, setNotes] = useState('');
  const qs = CATEGORY_QUESTIONS[service] ?? [];
  return (
    <Screen title="New job" back footer={
      <Btn label="Create inquiry" disabled={!payer.name || !payer.phone} onPress={() =>
        a.createJob({ payer, onsiteSame: same, onsite, service, zone, answers, stops: stop ? [stop] : [], date, arrival, description: desc, notes },
          (id) => router.replace(`/dispatcher/job/${id}`))} />
    }>
      <Eyebrow>1 · Payer</Eyebrow>
      <Field label="Name" value={payer.name} onChangeText={(t) => setPayer({ ...payer, name: t })} />
      <Field label="Phone" value={payer.phone} onChangeText={(t) => setPayer({ ...payer, phone: t })} keyboardType="phone-pad" />
      <Field label="Email" value={payer.email} onChangeText={(t) => setPayer({ ...payer, email: t })} keyboardType="email-address" />
      <Check label="On-site contact: same as payer" checked={same} onToggle={() => setSame(!same)} />
      {!same && (
        <>
          <Field label="On-site name" value={onsite.name} onChangeText={(t) => setOnsite({ ...onsite, name: t })} />
          <Field label="On-site phone" value={onsite.phone} onChangeText={(t) => setOnsite({ ...onsite, phone: t })} keyboardType="phone-pad" />
        </>
      )}

      <Eyebrow>2 · Service</Eyebrow>
      <ChipRow options={SERVICES} value={service} onChange={(v) => { setService(v); setAnswers({}); }} />
      {qs.map((q) => (
        <View key={q.id}>
          {q.type === 'choice' ? (
            <View style={{ gap: 6 }}>
              <P>{q.label}</P>
              <ChipRow options={q.choices ?? []} value={answers[q.id] ?? null} onChange={(v) => setAnswers({ ...answers, [q.id]: v })} />
            </View>
          ) : q.type === 'checkbox' ? (
            <Check label={q.label} checked={answers[q.id] === 'Yes'} onToggle={() => setAnswers({ ...answers, [q.id]: answers[q.id] === 'Yes' ? 'No' : 'Yes' })} />
          ) : (
            <Field label={q.label} value={answers[q.id] ?? ''} onChangeText={(t) => setAnswers({ ...answers, [q.id]: t })} />
          )}
        </View>
      ))}

      <Eyebrow>3 · When (one date)</Eyebrow>
      <Field label="Date" value={date} onChangeText={setDate} placeholder="e.g. Sat 5 Dec" />
      <Field label="Arrival time or window" value={arrival} onChangeText={setArrival} placeholder="9:00 – 10:00 am" />

      <Eyebrow>4 · Where</Eyebrow>
      <ChipRow options={ZONES} value={zone} onChange={setZone} />
      <Field label="First stop" value={stop} onChangeText={setStop} placeholder="More stops on the job ticket" />

      <Eyebrow>5 · Notes</Eyebrow>
      <Field label="Job description (customer sees this)" value={desc} onChangeText={setDesc} multiline />
      <Field label="Internal notes (dispatchers only)" value={notes} onChangeText={setNotes} multiline />
    </Screen>
  );
}
