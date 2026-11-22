import { useMemo, useState } from 'react';
import { Linking, Share, View } from 'react-native';
import { router } from 'expo-router';
import { Btn, Card, Check, ChipRow, Eyebrow, Field, H2, P, Screen } from '../../ui';
import { matchJobs, Role, useStore } from '../../store';
import { C } from '../../theme';

const ROLES = ['Customer', 'Worker', 'Dispatcher', 'Local Admin'] as const;
const ROLE_KEY: Record<(typeof ROLES)[number], Role> = { Customer: 'customer', Worker: 'worker', Dispatcher: 'dispatcher', 'Local Admin': 'local_admin' };

/** Create account with matching past jobs, all ticked (canvas 2.10.4, 3.5.1). */
export default function CreateAccount() {
  const { s, a } = useStore();
  const [role, setRole] = useState<(typeof ROLES)[number]>('Customer');
  const [name, setName] = useState('Dana Wells');
  const [phone, setPhone] = useState('(773) 555-0199');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState(() => Math.random().toString(36).slice(2, 10));
  const [unticked, setUnticked] = useState<string[]>([]);
  const [link, setLink] = useState<string | null>(null);

  const matches = useMemo(() => matchJobs(s.jobs, name, phone, email), [s.jobs, name, phone, email]);
  const ticked = matches.filter((m) => !unticked.includes(m.job.id)).map((m) => m.job.id);

  if (link)
    return (
      <Screen title="Login link ready">
        <Card>
          <H2>{`${name} · ${role}`}</H2>
          <P color={C.text}>{link}</P>
          <P>{`${ticked.length} past job(s) linked. Send the link yourself — the app doesn't send it. They change the password when they first sign in.`}</P>
        </Card>
        <Btn label="Share / copy link" onPress={() => Share.share({ message: `Your Call A Guy login: ${link}` })} />
        {phone ? <Btn kind="secondary" label="Text it" onPress={() => Linking.openURL(`sms:${phone.replace(/\D/g, '')}`)} /> : null}
        {email ? <Btn kind="secondary" label="Email it" onPress={() => Linking.openURL(`mailto:${email}`)} /> : null}
        <Btn kind="secondary" label="Done" onPress={() => router.back()} />
      </Screen>
    );

  return (
    <Screen title="Create account" back footer={
      <Btn label="Create account" disabled={!name || (!phone && !email) || pw.length < 6} onPress={() => {
        a.createAccount({ role: ROLE_KEY[role], name, phone, email }, ticked);
        setLink(`https://app.callaguy.example/login?t=${Math.random().toString(36).slice(2, 12)}`);
      }} />
    }>
      <P>Role</P>
      <ChipRow options={ROLES} value={role} onChange={setRole} />
      <Field label="Full name" value={name} onChangeText={setName} />
      <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}><Field label="Starting password" value={pw} onChangeText={setPw} /></View>
        <Btn small kind="secondary" label="Generate" onPress={() => setPw(Math.random().toString(36).slice(2, 10))} />
      </View>
      <P>They'll be asked to change it when they first sign in.</P>

      <Eyebrow>{`Matching jobs · ${matches.length} found`}</Eyebrow>
      {matches.length === 0 && <P>No past jobs match this name, phone or email.</P>}
      {matches.map((m) => (
        <Check key={m.job.id} label={`${m.job.number} · ${m.job.service} · ${m.job.date}`} sub={`Matched on ${m.on.join(' + ')} · ${m.job.status}`}
          checked={!unticked.includes(m.job.id)} onToggle={() => setUnticked((u) => (u.includes(m.job.id) ? u.filter((x) => x !== m.job.id) : [...u, m.job.id]))} />
      ))}
      {matches.length > 0 && <P>All ticked. Untick any that aren't this person's. Ticked jobs show in their app.</P>}
    </Screen>
  );
}
