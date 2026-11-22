import { useState } from 'react';
import { Btn, Chip, ChipRow, Eyebrow, Field, KV, P, Row, Screen, Sheet } from '../../../ui';
import { ago, Partnership, useStore } from '../../../store';

const KINDS = ['Call', 'Text', 'Email', 'Visit'] as const;
const GAPS = [['1 hour', 3600_000], ['Tomorrow', 86400_000], ['3 days', 3 * 86400_000], ['1 week', 7 * 86400_000]] as const;

/** Partnerships with their next action; "Log & set next" in one step (canvas 2.3, 2.11). */
export default function DispatcherField() {
  const { s, a } = useStore();
  const [open, setOpen] = useState<Partnership | null>(null);
  const [kind, setKind] = useState<(typeof KINDS)[number]>('Visit');
  const [what, setWhat] = useState('');
  const [nextKind, setNextKind] = useState<(typeof KINDS)[number]>('Call');
  const [gap, setGap] = useState<(typeof GAPS)[number][0]>('3 days');
  const [note, setNote] = useState('');
  const list = [...s.partnerships].sort((x, y) => x.nextAction.at - y.nextAction.at);
  return (
    <Screen title="Field">
      <P>Partnerships, visits, cards and face-to-face live here. This mockup shows the partnership loop.</P>
      <Eyebrow>Partnerships</Eyebrow>
      {list.map((p) => (
        <Row key={p.id} title={p.name} sub={`${p.zone} · ${p.stage} · ${p.nextAction.kind} ${ago(p.nextAction.at)}`} tone={p.nextAction.at < Date.now() ? 'red' : undefined}
          right={<Chip label={p.stage} />} onPress={() => { setOpen(p); setNote(''); setWhat(''); }} />
      ))}
      <Sheet visible={!!open} onClose={() => setOpen(null)} title={open?.name ?? ''}>
        {open && (
          <>
            <KV k="Due" v={`${open.nextAction.kind} · ${open.nextAction.note}`} />
            <Eyebrow>What happened</Eyebrow>
            <ChipRow options={KINDS} value={kind} onChange={setKind} />
            <Field label="Outcome / note" value={what} onChangeText={setWhat} placeholder="Spoke to Rita, left 20 cards" />
            <Eyebrow>Next action</Eyebrow>
            <ChipRow options={KINDS} value={nextKind} onChange={setNextKind} />
            <ChipRow options={GAPS.map((g) => g[0])} value={gap} onChange={setGap} />
            <Field label="Note" value={note} onChangeText={setNote} />
            <Btn label="Log & set next" onPress={() => {
              a.logPartnership(open.id, { kind: nextKind, at: Date.now() + GAPS.find((g) => g[0] === gap)![1], note: note || `${nextKind} follow-up` });
              setOpen(null);
            }} />
          </>
        )}
      </Sheet>
    </Screen>
  );
}
