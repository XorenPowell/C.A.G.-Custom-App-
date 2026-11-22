import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Btn, Card, Check, ChipRow, Eyebrow, Field, H2, KV, P, Screen } from '../../ui';
import { CATEGORY_QUESTIONS, SERVICES, useStore } from '../../store';
import { C } from '../../theme';

const STEPS = ['Service', 'Where', 'When', 'Site details', 'What needs doing', 'Who will be there', 'Your details', 'Review'];
const WHEN = ['Morning', 'Afternoon', 'Evening', 'Specific time'] as const;

/** The 8-step request questionnaire (canvas 3.2.2). Submitting creates an Inquiry. */
export default function Request() {
  const { s, a } = useStore();
  const guest = useLocalSearchParams<{ guest?: string }>().guest === '1';
  const me = guest ? undefined : s.accounts.find((x) => x.id === s.me);
  const [step, setStep] = useState(0);
  const [service, setService] = useState<string>('Moving');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [stops, setStops] = useState<string[]>(['']);
  const [date, setDate] = useState('');
  const [when, setWhen] = useState<(typeof WHEN)[number] | null>(null);
  const [time, setTime] = useState('');
  const [site, setSite] = useState({ parking: '', access: '', rules: '', gate: '' });
  const [desc, setDesc] = useState('');
  const [illBeThere, setIllBeThere] = useState(true);
  const [onsite, setOnsite] = useState({ name: '', phone: '' });
  const [payer, setPayer] = useState({ name: me?.name ?? '', phone: me?.phone ?? '', email: me?.email ?? '' });
  const [doneId, setDoneId] = useState<string | null>(null);

  const qs = CATEGORY_QUESTIONS[service] ?? [];
  const ok = [
    qs.every((q) => !q.required || answers[q.id]),
    stops.some((x) => x.trim()),
    !!date && !!when,
    !!site.parking && !!site.access && !!site.rules,
    !!desc,
    illBeThere || (!!onsite.name && !!onsite.phone),
    !!payer.name && !!payer.phone,
    true,
  ][step];

  const submit = () =>
    a.createJob(
      {
        service, answers, stops: stops.filter((x) => x.trim()), date, arrival: when === 'Specific time' ? time : when ?? '', site, description: desc,
        onsiteSame: illBeThere, onsite, payer, customerAccountId: me?.id ?? null,
      },
      (id) => setDoneId(id),
    );

  if (doneId)
    return (
      <Screen title="Request sent">
        <Card>
          <H2>Thanks — we've got it.</H2>
          <P>Your dispatcher will review it and send a quote. You'll get a text and a notification.</P>
        </Card>
        {me ? <Btn label="See your request" onPress={() => router.replace(`/customer/job/${doneId}`)} /> : null}
        <Btn kind="secondary" label="Done" onPress={() => (me ? router.replace('/customer') : router.replace('/'))} />
      </Screen>
    );

  return (
    <Screen
      title={`Request · ${step + 1} of 8`}
      back
      footer={
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {step > 0 && (
            <View style={{ flex: 1 }}>
              <Btn kind="secondary" label="Back" onPress={() => setStep(step - 1)} />
            </View>
          )}
          <View style={{ flex: 2 }}>
            <Btn label={step === 7 ? 'Send request' : 'Next'} disabled={!ok} onPress={() => (step === 7 ? submit() : setStep(step + 1))} />
          </View>
        </View>
      }
    >
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {STEPS.map((_, i) => (
          <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= step ? C.lime : C.pill }} />
        ))}
      </View>
      <H2>{STEPS[step]}</H2>

      {step === 0 && (
        <>
          <ChipRow options={SERVICES} value={service as (typeof SERVICES)[number]} onChange={(v) => { setService(v); setAnswers({}); }} />
          {qs.map((q) =>
            q.type === 'choice' ? (
              <View key={q.id} style={{ gap: 6 }}>
                <P>{q.label + (q.required ? ' *' : '')}</P>
                <ChipRow options={q.choices ?? []} value={answers[q.id] ?? null} onChange={(v) => setAnswers({ ...answers, [q.id]: v })} />
              </View>
            ) : q.type === 'checkbox' ? (
              <Check key={q.id} label={q.label} checked={answers[q.id] === 'Yes'} onToggle={() => setAnswers({ ...answers, [q.id]: answers[q.id] === 'Yes' ? 'No' : 'Yes' })} />
            ) : (
              <Field key={q.id} label={q.label + (q.required ? ' *' : '')} value={answers[q.id] ?? ''} onChangeText={(t) => setAnswers({ ...answers, [q.id]: t })} keyboardType={q.type === 'number' ? 'number-pad' : 'default'} />
            ),
          )}
          <P>These questions change with the service. The Local Admin edits them in Settings.</P>
        </>
      )}

      {step === 1 && (
        <>
          {stops.map((x, i) => (
            <Field key={i} label={i === 0 ? 'Address (first stop)' : `Stop ${i + 1}`} value={x} onChangeText={(t) => setStops(stops.map((y, k) => (k === i ? t : y)))} placeholder="Street, unit, city" />
          ))}
          <Btn kind="secondary" small label="+ Add a stop" onPress={() => setStops([...stops, ''])} />
        </>
      )}

      {step === 2 && (
        <>
          <Field label="Date (one day per job)" value={date} onChangeText={setDate} placeholder="e.g. Sat 5 Dec" />
          <P>Best time</P>
          <ChipRow options={WHEN} value={when} onChange={setWhen} />
          {when === 'Specific time' && <Field label="Time" value={time} onChangeText={setTime} placeholder="e.g. 9:30 am" />}
          <P>Need a second day? That's a second request.</P>
        </>
      )}

      {step === 3 && (
        <>
          <Field label="Parking and loading *" value={site.parking} onChangeText={(t) => setSite({ ...site, parking: t })} placeholder="Street parking, loading dock…" />
          <Field label="Floor and access *" value={site.access} onChangeText={(t) => setSite({ ...site, access: t })} placeholder="3rd floor, no elevator" />
          <Field label="Building rules *" value={site.rules} onChangeText={(t) => setSite({ ...site, rules: t })} placeholder="Move hours, COI needed…" />
          <Field label="Gate or door code (optional)" value={site.gate} onChangeText={(t) => setSite({ ...site, gate: t })} />
        </>
      )}

      {step === 4 && <Field label="Describe the job" value={desc} onChangeText={setDesc} multiline placeholder="What's moving, anything large or fragile…" />}

      {step === 5 && (
        <>
          <Check label="I'll be there on the day" sub="Untick if someone else will let the crew in (e.g. a tenant or property manager)." checked={illBeThere} onToggle={() => setIllBeThere(!illBeThere)} />
          {!illBeThere && (
            <>
              <Field label="On-site contact name" value={onsite.name} onChangeText={(t) => setOnsite({ ...onsite, name: t })} />
              <Field label="On-site contact phone" value={onsite.phone} onChangeText={(t) => setOnsite({ ...onsite, phone: t })} keyboardType="phone-pad" />
            </>
          )}
        </>
      )}

      {step === 6 && (
        <>
          <P>The person paying for the job.</P>
          <Field label="Name" value={payer.name} onChangeText={(t) => setPayer({ ...payer, name: t })} />
          <Field label="Phone" value={payer.phone} onChangeText={(t) => setPayer({ ...payer, phone: t })} keyboardType="phone-pad" />
          <Field label="Email" value={payer.email} onChangeText={(t) => setPayer({ ...payer, email: t })} keyboardType="email-address" />
        </>
      )}

      {step === 7 && (
        <Card>
          <KV k="Service" v={service} />
          {qs.map((q) => <KV key={q.id} k={q.label} v={answers[q.id] ?? '—'} />)}
          <KV k="Stops" v={stops.filter(Boolean).join('\n')} />
          <KV k="When" v={`${date} · ${when === 'Specific time' ? time : when}`} />
          <KV k="On site" v={illBeThere ? payer.name : `${onsite.name} · ${onsite.phone}`} />
          <KV k="Payer" v={`${payer.name} · ${payer.phone}`} />
          <Eyebrow>Next</Eyebrow>
          <P>Your dispatcher lines up a crew and sends a quote. Nothing is charged until you accept and Square sends the bill.</P>
        </Card>
      )}
    </Screen>
  );
}
