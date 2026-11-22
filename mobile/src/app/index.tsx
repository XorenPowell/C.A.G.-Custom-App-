import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Btn, Card, Eyebrow, Field, Gap, H1, P, Screen } from '../ui';
import { Role, useStore } from '../store';
import { C } from '../theme';

const HOME: Record<Role, string> = {
  customer: '/customer',
  worker: '/worker',
  dispatcher: '/dispatcher',
  local_admin: '/admin',
};

export default function SignIn() {
  const { a } = useStore();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const go = (r: Role) => {
    a.signIn(r);
    router.replace(HOME[r] as never);
  };
  return (
    <Screen>
      <Gap h={24} />
      <H1>Call A Guy</H1>
      <P>One sign-in for customers, workers and staff.</P>
      <Gap />
      <Field label="Email or phone" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="you@example.com" />
      <Field label="Password" value={pw} onChangeText={setPw} secure placeholder="••••••••" />
      <Btn label="Sign in" onPress={() => go('customer')} />
      <Btn kind="secondary" label="Create a customer account" onPress={() => router.push('/signup')} />
      <Btn kind="secondary" label="Request a job without an account" onPress={() => router.push('/customer/request?guest=1' as never)} />

      <Gap h={12} />
      <Card style={{ borderWidth: 1, borderColor: C.line, backgroundColor: C.bg }}>
        <Eyebrow>Mockup · sign in as</Eyebrow>
        <P>Pick a role to walk the workflow. "Switch role" on each profile tab brings you back here; the data is shared, so a job you request as the customer shows up for the dispatcher.</P>
        <View style={{ gap: 8 }}>
          <Btn small label="Customer · Mary Lopez" onPress={() => go('customer')} />
          <Btn small label="Worker · Xoren Powell" onPress={() => go('worker')} />
          <Btn small label="Dispatcher · Alex Rivera" onPress={() => go('dispatcher')} />
          <Btn small label="Local Admin · Taylor M." onPress={() => go('local_admin')} />
        </View>
      </Card>
    </Screen>
  );
}
