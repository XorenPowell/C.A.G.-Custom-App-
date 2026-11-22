import { router } from 'expo-router';
import { Btn, Card, Check, Eyebrow, KV, Screen } from '../../../ui';
import { useStore } from '../../../store';
import { useState } from 'react';

export default function CustomerProfile() {
  const { s, a } = useStore();
  const me = s.accounts.find((x) => x.id === s.me);
  const [push, setPush] = useState(true);
  const [email, setEmail] = useState(true);
  return (
    <Screen title="Profile">
      <Card>
        <KV k="Name" v={me?.name ?? ''} />
        <KV k="Phone" v={me?.phone ?? ''} />
        <KV k="Email" v={me?.email ?? ''} />
      </Card>
      <Eyebrow>Notifications</Eyebrow>
      <Check label="Push notifications" sub="Quote ready, crew on the way, payment due" checked={push} onToggle={() => setPush(!push)} />
      <Check label="Email" checked={email} onToggle={() => setEmail(!email)} />
      <Btn kind="secondary" label="Switch role (mockup)" onPress={() => { a.signOut(); router.replace('/'); }} />
    </Screen>
  );
}
