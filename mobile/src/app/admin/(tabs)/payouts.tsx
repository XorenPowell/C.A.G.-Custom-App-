import { useState } from 'react';
import { Btn, Card, Chip, ChipRow, Eyebrow, Field, KV, P, Row, Screen, Sheet } from '../../../ui';
import { Payout, money, useStore, workerName } from '../../../store';
import { C } from '../../../theme';

/** Payouts per worker; mark sent; correct one that wasn't sent or went out at a different amount (canvas 3.5.8). */
export default function Payouts() {
  const { s, a } = useStore();
  const [send, setSend] = useState<Payout | null>(null);
  const [fix, setFix] = useState<Payout | null>(null);
  const [method, setMethod] = useState('');
  const [date, setDate] = useState('Today');
  const [ref, setRef] = useState('');
  const [override, setOverride] = useState('');
  const [kind, setKind] = useState<'Not sent' | 'Different amount'>('Not sent');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const amt = (p: Payout) => p.override ?? p.computed;

  return (
    <Screen title="Payouts">
      {s.workers.map((w) => {
        const mine = s.payouts.filter((p) => p.workerId === w.id);
        if (!mine.length) return null;
        const owed = mine.filter((p) => p.status === 'pending').reduce((t, p) => t + amt(p), 0);
        return (
          <Card key={w.id}>
            <KV k={w.name} v={owed ? `${money(owed)} owed` : 'Up to date'} color={owed ? C.amber : C.green} />
            <P>{w.payoutMethod}</P>
            {mine.map((p) => {
              const j = s.jobs.find((x) => x.id === p.jobId);
              return (
                <Row key={p.id} title={`${j?.number} · ${money(amt(p))}`}
                  sub={[p.sent ? `Sent ${p.sent.date} · ${p.sent.method} · ${p.sent.ref}` : 'Pending', ...p.corrections.map((c) => `Corrected: ${c.kind}${c.amount ? ' $' + c.amount : ''}`)].join('\n')}
                  right={p.status === 'pending'
                    ? <Btn small label="Mark sent" onPress={() => { setSend(p); setMethod(w.payoutMethod.split(' · ')[0]); setRef(''); setOverride(''); }} />
                    : <Btn small kind="secondary" label="Correct" onPress={() => { setFix(p); setAmount(''); setNote(''); }} />} />
              );
            })}
          </Card>
        );
      })}

      <Sheet visible={!!send} onClose={() => setSend(null)} title={send ? `Mark sent · ${workerName(s, send.workerId)}` : ''}>
        {send && (
          <>
            <KV k="Calculated" v={money(send.computed)} />
            <Field label="Override amount (optional)" value={override} onChangeText={setOverride} keyboardType="decimal-pad" placeholder="Leave empty to use calculated" />
            <Field label="Method" value={method} onChangeText={setMethod} />
            <Field label="Date sent" value={date} onChangeText={setDate} />
            <Field label="Reference" value={ref} onChangeText={setRef} placeholder="Zelle / Cash App confirmation" />
            <P>You send the money outside the app. This only records that you did.</P>
            <Btn label="Mark sent" onPress={() => { a.markPayoutSent(send.id, { method, date, ref }, override ? Number(override) : null); setSend(null); }} />
          </>
        )}
      </Sheet>
      <Sheet visible={!!fix} onClose={() => setFix(null)} title="Correct a payout">
        <ChipRow options={['Not sent', 'Different amount'] as const} value={kind} onChange={setKind} />
        {kind === 'Different amount' && <Field label="Amount actually sent ($)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />}
        <Field label="Note" value={note} onChangeText={setNote} />
        <Eyebrow>The original record stays</Eyebrow>
        <Btn label="Save correction" onPress={() => { if (fix) a.correctPayout(fix.id, kind, amount, note); setFix(null); }} />
      </Sheet>
    </Screen>
  );
}
