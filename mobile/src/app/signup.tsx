import { useState } from 'react';
import { router } from 'expo-router';
import { Btn, Card, Chip, Eyebrow, Field, KV, P, Row, Screen } from '../ui';
import { matchJobs, useStore } from '../store';

/** Customer self sign-up. Past jobs link only once the matching phone or email is verified (canvas 2.10.1). */
export default function SignUp() {
  const { s, a } = useStore();
  const [name, setName] = useState('Dana Wells');
  const [phone, setPhone] = useState('(773) 555-0199');
  const [email, setEmail] = useState('dana.w@example.com');
  const [pw, setPw] = useState('');
  const [accId, setAccId] = useState<string | null>(null);
  const [verified, setVerified] = useState({ phone: false, email: false });
  const [code, setCode] = useState('');

  const acc = s.accounts.find((x) => x.id === accId);
  const linked = accId ? s.jobs.filter((j) => j.customerAccountId === accId) : [];
  const waitingEmail = acc && !verified.email ? matchJobs(s.jobs, '', '', acc.email).filter((m) => !linked.includes(m.job)) : [];
  const waitingPhone = acc && !verified.phone ? matchJobs(s.jobs, '', acc.phone, '').filter((m) => !linked.includes(m.job)) : [];

  if (!acc)
    return (
      <Screen title="Create account" back>
        <Field label="Full name" value={name} onChangeText={setName} />
        <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
        <Field label="Password" value={pw} onChangeText={setPw} secure placeholder="At least 8 characters" />
        <P>We'll text a code to your phone and email you a link. Past jobs booked with that phone or email appear once each one is confirmed.</P>
        <Btn label="Create account" disabled={!name || (!phone && !email)} onPress={() => setAccId(a.signUpCustomer({ name, phone, email }))} />
      </Screen>
    );

  return (
    <Screen title="Confirm it's you" back>
      <Card>
        <Eyebrow>Phone</Eyebrow>
        <KV k={acc.phone || 'No phone'} v={verified.phone ? 'Confirmed' : 'Not confirmed'} />
        {!verified.phone && acc.phone ? (
          <>
            <Field label="6-digit code (mock: any code)" value={code} onChangeText={setCode} keyboardType="number-pad" />
            <Btn small label="Confirm phone" onPress={() => { a.verifyChannel(acc.id, 'phone'); setVerified((v) => ({ ...v, phone: true })); }} />
          </>
        ) : null}
      </Card>
      <Card>
        <Eyebrow>Email</Eyebrow>
        <KV k={acc.email || 'No email'} v={verified.email ? 'Confirmed' : 'Link sent'} />
        {!verified.email && acc.email ? (
          <Btn small kind="secondary" label="Mock: I tapped the email link" onPress={() => { a.verifyChannel(acc.id, 'email'); setVerified((v) => ({ ...v, email: true })); }} />
        ) : null}
      </Card>

      <Eyebrow>{`Your past jobs · ${linked.length}`}</Eyebrow>
      {linked.map((j) => (
        <Row key={j.id} title={`${j.number} · ${j.service}`} sub={`${j.date} · ${j.status}`} right={<Chip label="Linked" tone="green" />} />
      ))}
      {waitingPhone.length > 0 && <P>{`${waitingPhone.length} more job(s) match your phone — they appear once your phone is confirmed.`}</P>}
      {waitingEmail.length > 0 && <P>{`${waitingEmail.length} more job(s) match your email — they appear once your email is confirmed.`}</P>}
      <Btn label="Continue to the app" onPress={() => router.replace('/customer')} />
    </Screen>
  );
}
