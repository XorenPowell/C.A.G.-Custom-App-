import { router } from 'expo-router';
import { Card, Eyebrow, H1, KV, Row, Screen } from '../../../ui';
import { docState, fmtDate, money, useStore } from '../../../store';

export default function AdminHome() {
  const { s } = useStore();
  const docIssues = s.workers.flatMap((w) => w.docs.filter((d) => docState(d) !== 'Approved').map((d) => ({ w, d, st: docState(d) })));
  const owed = s.payouts.filter((p) => p.status === 'pending');
  const noInvoice = s.jobs.filter((j) => j.status === 'Completed' && !j.squareLink);
  const open = s.jobs.filter((j) => !['Completed', 'Cancelled', 'Lost', 'Rejected'].includes(j.status));
  return (
    <Screen>
      <H1>Local Admin</H1>
      <Card>
        <KV k="Open jobs" v={String(open.length)} />
        <KV k="Payouts owed" v={money(owed.reduce((t, p) => t + (p.override ?? p.computed), 0))} />
        <KV k="Active workers" v={String(s.workers.filter((w) => w.active).length)} />
      </Card>
      <Eyebrow>Needs attention</Eyebrow>
      {docIssues.map(({ w, d, st }) => (
        <Row key={w.id + d.type} tone={st === 'Expiring soon' || st === 'Under review' ? undefined : 'red'} title={`${w.name} · ${d.type}`} sub={d.expires ? `${st} · ${fmtDate(d.expires)}` : st} onPress={() => router.push('/admin/vetting')} />
      ))}
      {owed.length > 0 && <Row title={`${owed.length} payout(s) to send`} sub="Mark each one sent after paying" onPress={() => router.push('/admin/payouts')} />}
      {noInvoice.map((j) => <Row key={j.id} tone="red" title={`${j.number} has no Square invoice`} sub={`Completed · ${j.payer.name}`} />)}
      <Eyebrow>Tools</Eyebrow>
      <Row title="Vetting" sub="Approve or reject paperwork" onPress={() => router.push('/admin/vetting')} />
      <Row title="1099 year-end" sub="Year-to-date paid, W-9, filed" onPress={() => router.push('/admin/tax')} />
    </Screen>
  );
}
