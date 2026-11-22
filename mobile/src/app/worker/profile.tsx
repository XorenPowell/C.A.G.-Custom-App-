import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Avatar, BackHeader, Btn, Card, Chip, Eyebrow, Field, K, KV, Page, Row, Sheet, SheetTitle, T, chipFor } from '../../wk';
import { useMe } from '../../worker-data';

const TEMPLATE_LABEL: Record<string, string> = {
  "I can't make it": 'I can’t make it',
  'Running late': 'Running late',
  "Can't get in": 'Can’t get in',
  'Job is bigger': 'Job is bigger',
  Damage: 'Damage',
};

/** Worker / My profile (Figma 58:227). */
export default function MyProfile() {
  const { a, w } = useMe();
  const [tpl, setTpl] = useState<string | null>(null);
  const [tplText, setTplText] = useState('');
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({ phone: '', email: '', home: '', method: '', handle: '' });
  const method = w.payoutMethod.split(' · ')[0] ?? w.payoutMethod;
  const blocks = w.unavailable ?? [];

  return (
    <View style={{ flex: 1 }}>
      <Page header={<BackHeader title="My profile" />}>
        <Card>
          <Row>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 }}>
              <Avatar name={w.name} size={56} fs={18} />
              <View style={{ gap: 2, flexShrink: 1 }}>
                <T s={18} w="s">{w.name}</T>
                <T s={13} c={K.muted}>{`${w.kind ?? 'Individual'} · ${w.vehicle}`}</T>
              </View>
            </View>
            <Chip label={`★ ${w.rating.toFixed(1)} / 10`} {...chipFor.lime} />
          </Row>
        </Card>

        <Card>
          <Eyebrow>CONTACT</Eyebrow>
          <KV k="Phone" v={w.phone ?? '—'} />
          <KV k="Email" v={w.email ?? '—'} />
          <KV k="Home address" v={w.home ?? '—'} />
        </Card>

        <Card>
          <Eyebrow>PAYOUT METHOD</Eyebrow>
          <KV k="Method" v={method} />
          <KV k="Handle" v={w.handle ?? w.payoutMethod.split(' · ')[1] ?? '—'} />
          <T s={12} c={K.muted}>Visible to the Local Admin, who sends your payouts.</T>
        </Card>

        <Card>
          <Eyebrow>RATES PER HOUR</Eyebrow>
          <KV k="Regular" v={`$${w.rates?.regular ?? 0}`} />
          <KV k="Travel" v={`$${w.rates?.travel ?? 0}`} />
          <KV k="Other" v={`$${w.rates?.other ?? 0}`} />
        </Card>

        <Card>
          <Eyebrow>STANDING FEES & EQUIPMENT</Eyebrow>
          {(w.fees ?? []).map((f) => <KV key={f.name} k={f.name} v={f.amount} />)}
          <T s={14}>{w.equipment.join(' · ')}</T>
        </Card>

        <Card onPress={() => router.push('/worker/unavailable')}>
          <Eyebrow>UNAVAILABLE TIMES</Eyebrow>
          <T s={14}>{blocks.length ? blocks.map((b) => `${b.title.replace(/^Every /, '')}${b.when === 'All day' ? ' all day' : ` ${b.when}`}`).join(' · ') : 'None set'}</T>
          <T s={12} c={K.muted}>Everything else counts as available.</T>
        </Card>

        <Card>
          <Eyebrow>MY TEXT TEMPLATES</Eyebrow>
          {Object.keys(TEMPLATE_LABEL).map((k) => (
            <KV key={k} k={TEMPLATE_LABEL[k]!} v="Edit" onPress={() => { setTpl(k); setTplText(w.templates?.[k] ?? ''); }} />
          ))}
        </Card>

        <Btn kind="secondary" label="Edit profile" onPress={() => {
          setForm({ phone: w.phone ?? '', email: w.email ?? '', home: w.home ?? '', method, handle: w.handle ?? '' });
          setEdit(true);
        }} />
      </Page>

      <Sheet visible={!!tpl} onClose={() => setTpl(null)}>
        <SheetTitle>{tpl ? TEMPLATE_LABEL[tpl]! : ''}</SheetTitle>
        <Field label="Template ({dispatcher}, {me}, {job}, {when}, {minutes} fill in for you)" value={tplText} onChangeText={setTplText} multiline />
        <Btn label="Save template" onPress={() => { if (tpl) a.setTemplate(w.id, tpl, tplText); setTpl(null); }} />
        <Btn kind="secondary" label="Cancel" onPress={() => setTpl(null)} />
      </Sheet>

      <Sheet visible={edit} onClose={() => setEdit(false)}>
        <SheetTitle>Edit profile</SheetTitle>
        <Field label="Phone" value={form.phone} onChangeText={(t) => setForm({ ...form, phone: t })} keyboardType="phone-pad" />
        <Field label="Email" value={form.email} onChangeText={(t) => setForm({ ...form, email: t })} keyboardType="email-address" />
        <Field label="Home address" value={form.home} onChangeText={(t) => setForm({ ...form, home: t })} />
        <Field label="Payout method" value={form.method} onChangeText={(t) => setForm({ ...form, method: t })} />
        <Field label="Handle" value={form.handle} onChangeText={(t) => setForm({ ...form, handle: t })} />
        <Btn label="Save" onPress={() => {
          a.updateWorker(w.id, (x) => { x.phone = form.phone; x.email = form.email; x.home = form.home; x.handle = form.handle; x.payoutMethod = `${form.method} · ${form.handle}`; });
          setEdit(false);
        }} />
        <Btn kind="secondary" label="Cancel" onPress={() => setEdit(false)} />
      </Sheet>
    </View>
  );
}
