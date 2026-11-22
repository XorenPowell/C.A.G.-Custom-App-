import { useState } from 'react';
import { Btn, Card, Chip, KV, P, Screen } from '../../ui';
import { money, useStore } from '../../store';

/** 1099 year-end list (canvas 3.5.9). Threshold shown for reference; filing happens outside the app. */
export default function Tax() {
  const { s } = useStore();
  const [filed, setFiled] = useState<string[]>([]);
  const THRESHOLD = 600;
  return (
    <Screen title="1099 · 2026" back>
      <P>{`Year-to-date paid per worker. Threshold ${money(THRESHOLD)} (check the current IRS figure before filing).`}</P>
      {s.workers.map((w) => {
        const ytd = s.payouts.filter((p) => p.workerId === w.id && p.status === 'sent').reduce((t, p) => t + (p.override ?? p.computed), 0);
        const w9 = w.docs.find((d) => d.type === 'W-9')?.status === 'approved';
        const isFiled = filed.includes(w.id);
        return (
          <Card key={w.id}>
            <KV k={w.name} v={money(ytd)} />
            <KV k="Threshold crossed" v={ytd >= THRESHOLD ? 'Yes' : 'No'} />
            <KV k="W-9 on file" v={w9 ? 'Yes' : 'No'} color={w9 ? undefined : '#FF7878'} />
            <Chip label={isFiled ? 'Filed' : 'Not filed'} tone={isFiled ? 'green' : 'amber'} />
            {!isFiled && <Btn small kind="secondary" label="Mark filed" onPress={() => setFiled([...filed, w.id])} />}
          </Card>
        );
      })}
    </Screen>
  );
}
