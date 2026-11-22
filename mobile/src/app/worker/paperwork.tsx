import { useState } from 'react';
import { View } from 'react-native';
import { BackHeader, Btn, Card, Chip, Eyebrow, K, Page, Row, Sheet, SheetTitle, T, chipFor } from '../../wk';
import { useMe } from '../../worker-data';
import { REQUIRED_DOCS, daysUntil, docState, fmtDate } from '../../store';

const CHIP = {
  Approved: chipFor.lime,
  'Under review': chipFor.pill,
  'Expiring soon': chipFor.amber,
  Expired: chipFor.red,
  Rejected: chipFor.red,
  'Not uploaded': chipFor.red,
} as const;

/** Worker / Paperwork (Figma 58:173). Expiry is read from stored dates; no reminders. */
export default function Paperwork() {
  const { s, a, id, w } = useMe();
  const [upload, setUpload] = useState<string | null>(null);
  const paidYtd = s.payouts.filter((p) => p.workerId === id && p.status === 'sent').reduce((t, p) => t + (p.override ?? p.computed), 0);

  const rows = w.docs.map((d) => {
    const st = docState(d);
    let sub = d.note ?? '';
    let subC: string = K.muted;
    if (st === 'Approved' && d.expires) sub = `Expires ${fmtDate(d.expires)}`;
    if (st === 'Expiring soon' && d.expires) { sub = `Expires ${fmtDate(d.expires)} · ${daysUntil(d.expires)} days`; subC = K.amber; }
    if (st === 'Expired' && d.expires) { sub = `Expired ${fmtDate(d.expires)} · upload a new one`; subC = K.red; }
    if (st === 'Rejected') { sub = `Rejected: ${d.reason ?? 'see your dispatcher'}`; subC = K.red; }
    if (st === 'Under review') { sub = d.note ?? 'Submitted'; subC = K.text; }
    if (st === 'Not uploaded') { sub = 'Tap to upload'; subC = K.red; }
    return { d, st, sub, subC };
  });
  const blocking = rows.filter((r) => REQUIRED_DOCS.includes(r.d.type) && !['Approved', 'Expiring soon'].includes(r.st));

  return (
    <View style={{ flex: 1 }}>
      <Page header={<BackHeader title="Paperwork" />}>
        {blocking.length > 0 && (
          <Card bg={K.redBg} style={{ gap: 4 }}>
            <T s={15} w="s" c={K.red}>You can’t get offers until these are done</T>
            <T s={13} c={K.red}>{blocking.map((r) => `${r.d.type} ${r.st.toLowerCase()}`).join(' · ')}</T>
          </Card>
        )}
        <Card>
          <Eyebrow>1099 STATUS</Eyebrow>
          <T s={15} w="m">{`Not issued yet · $${Math.round(paidYtd).toLocaleString('en-US')} paid this year`}</T>
        </Card>
        <Eyebrow>DOCUMENTS</Eyebrow>
        {rows.map(({ d, st, sub, subC }) => (
          <Card key={d.type} style={{ padding: 14, gap: 4, borderRadius: 16 }} onPress={() => setUpload(d.type)}>
            <Row>
              <T s={15} w="s">{d.type}</T>
              <Chip label={st} {...CHIP[st]} />
            </Row>
            {sub ? <T s={13} c={subC}>{sub}</T> : null}
          </Card>
        ))}
      </Page>
      <Sheet visible={!!upload} onClose={() => setUpload(null)}>
        <SheetTitle>{upload ?? ''}</SheetTitle>
        <T s={14} c={K.muted}>Upload a new photo or file. It goes to the Local Admin for approval.</T>
        <Btn label="Take photo" onPress={() => { if (upload) a.uploadDoc(w.id, upload); setUpload(null); }} />
        <Btn kind="secondary" label="Cancel" onPress={() => setUpload(null)} />
      </Sheet>
    </View>
  );
}
