// Worker-side helpers shared by the Figma-matched worker screens.
import { useState } from 'react';
import { View } from 'react-native';
import { Job, State, myWorkerId, useStore } from './store';
import { Btn, Eyebrow, K, Sheet, SheetTitle, T } from './wk';

export function useMe() {
  const { s, a } = useStore();
  const id = myWorkerId(s);
  const w = s.workers.find((x) => x.id === id)!;
  return { s, a, id, w };
}

export const jobTitle = (j: Job) => j.title ?? j.service;
export const firstName = (n: string) => n.split(' ')[0] ?? n;

/** The job's owning dispatcher (canvas 2.12.1). */
export function dispatcherOf(s: State, j?: Job) {
  const acc = s.accounts.find((x) => x.id === (j?.ownerId ?? 'a_disp')) ?? s.accounts.find((x) => x.role === 'dispatcher');
  return { name: acc?.name ?? 'Dispatcher', phone: acc?.phone ?? '' };
}
export const phoneOfWorker = (s: State, workerId: string) =>
  s.workers.find((w) => w.id === workerId)?.phone ?? s.accounts.find((x) => x.workerId === workerId)?.phone ?? '';

export const crewPhrase = (j: Job) => (j.seats <= 1 ? 'Solo' : `${j.seats}-person crew`);
export const stopsPhrase = (n: number) => `${n} ${n === 1 ? 'stop' : 'stops'}`;

/** "3:00 PM" → "2:00 PM": the time an hour before the first time in an arrival string. */
export function hourBefore(arrival: string): string | null {
  const m = arrival.match(/(\d{1,2}):(\d{2})\s*([AP]M)?/i);
  if (!m) return null;
  let h = Number(m[1]);
  const ap = (m[3] ?? (arrival.match(/[AP]M/i)?.[0] ?? 'PM')).toUpperCase();
  h = h - 1;
  let suffix = ap;
  if (h === 0) h = 12;
  if (h === 11 && ap === 'PM') suffix = 'AM';
  if (h === 11 && ap === 'AM') suffix = 'PM';
  return `${h}:${m[2]} ${suffix}`;
}

export function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

/** Fill a worker text template. */
export function fillTemplate(tpl: string, v: { dispatcher: string; me: string; job: Job; minutes?: string }) {
  return tpl
    .replace('{dispatcher}', firstName(v.dispatcher))
    .replace('{me}', firstName(v.me))
    .replace('{job}', `#${v.job.number.replace(/\D/g, '').replace(/^0+/, '')}`)
    .replace('{when}', `${v.job.date} ${v.job.arrival}`)
    .replace('{minutes}', v.minutes ?? '15');
}

/** Worker / Take · Are you absolutely sure? (Figma 57:67) */
export function TakeSheet({ job, rating, onYes, onClose }: { job: Job | null; rating: number; onYes: () => void; onClose: () => void }) {
  return (
    <Sheet visible={!!job} onClose={onClose}>
      {job && (
        <>
          <SheetTitle>Are you absolutely sure?</SheetTitle>
          <T s={14} c={K.muted}>{`${jobTitle(job)} · ${job.date}, arrive ${job.arrival} · ${job.zone}`}</T>
          <View style={{ backgroundColor: K.pill, borderRadius: 14, padding: 14, gap: 6 }}>
            <Eyebrow>YOU NEED TO BRING</Eyebrow>
            {(job.needs.length ? job.needs : ['Nothing special']).map((n) => (
              <T key={n} s={15} w="m">{`•  ${n}`}</T>
            ))}
          </View>
          <View style={{ backgroundColor: K.amberBg, borderRadius: 14, padding: 14, gap: 4 }}>
            <T s={14} w="s" c={K.amber}>Giving this job back later lowers your rating.</T>
            <T s={13} c={K.amber}>{`Your rating is ${rating.toFixed(1)}. Keep it at 8 or above to keep getting offers.`}</T>
          </View>
          <Btn label="Yes, take it" onPress={onYes} />
          <Btn kind="secondary" label="Go back" onPress={onClose} />
        </>
      )}
    </Sheet>
  );
}

/** Shown when someone else filled the last seat a moment earlier (no Figma frame; same sheet style). */
export function GoneSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Sheet visible={visible} onClose={onClose}>
      <SheetTitle>Already taken</SheetTitle>
      <T s={14} c={K.muted}>Someone took the last seat a moment before you.</T>
      <Btn label="OK" onPress={onClose} />
    </Sheet>
  );
}

/** Take flow shared by Home and the offer detail. */
export function useTake() {
  const { s, a, id, w } = useMe();
  const [confirm, setConfirm] = useState<Job | null>(null);
  const [won, setWon] = useState(false);
  const [gone, setGone] = useState(false);
  const yes = () => {
    const j = confirm && s.jobs.find((x) => x.id === confirm.id);
    setConfirm(null);
    if (!j || j.crew.length >= j.seats) return setGone(true);
    a.takeOffer(j.id, id);
    setWon(true);
  };
  const sheets = (
    <>
      <TakeSheet job={confirm} rating={w.rating} onYes={yes} onClose={() => setConfirm(null)} />
      <GoneSheet visible={gone} onClose={() => setGone(false)} />
    </>
  );
  return { ask: setConfirm, won, clearWon: () => setWon(false), sheets };
}
