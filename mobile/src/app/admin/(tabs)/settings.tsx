import { router } from 'expo-router';
import { Btn, Card, Eyebrow, Field, KV, P, Row, Screen } from '../../../ui';
import { CATEGORY_QUESTIONS, State, useStore } from '../../../store';

const FIELDS: [keyof State['settings'], string][] = [
  ['commission', 'Dispatcher commission %'],
  ['posFee', 'POS fee % (quote builder)'],
  ['transferFee', 'Transfer fee %'],
  ['flatFee', 'Flat company fee $'],
  ['waitSeconds', 'Dispatch waiting interval (seconds)'],
  ['ratingThreshold', 'Rating threshold'],
  ['refillDays', 'Default refill interval (days)'],
];

export default function Settings() {
  const { s, a } = useStore();
  return (
    <Screen title="Settings">
      <P>Defaults only — each job keeps the values it was created with.</P>
      {FIELDS.map(([k, label]) => (
        <Field key={k} label={label} value={s.settings[k]} onChangeText={(t) => a.setSetting(k, t)} keyboardType="decimal-pad" />
      ))}
      <Eyebrow>Category questions</Eyebrow>
      {Object.entries(CATEGORY_QUESTIONS).map(([cat, qs]) => (
        <Card key={cat}>
          <KV k={cat} v={`${qs.length} question(s)`} />
          {qs.map((q) => <P key={q.id}>{`• ${q.label} · ${q.type}${q.required ? ' · required' : ''}`}</P>)}
        </Card>
      ))}
      <Eyebrow>Lists & access</Eyebrow>
      <Row title="Lists" sub="Zones, sources, ending reasons, stages…" />
      <Row title="Fee catalog" sub="Named fees, shape, which side they land on" />
      <Row title="Rating rules" sub="Events and how much each moves the rating" />
      <Row title="Module access" sub="Grant modules to roles or single accounts" />
      <P>These open in the next pass.</P>
      <Btn kind="secondary" label="Switch role (mockup)" onPress={() => { a.signOut(); router.replace('/'); }} />
    </Screen>
  );
}
