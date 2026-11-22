import { ReactNode, useRef, useState } from 'react';
import {
  Animated,
  KeyboardTypeOptions,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { C, R } from './theme';

/* ---------- text ---------- */
export const H1 = ({ children }: { children: ReactNode }) => <Text style={s.h1}>{children}</Text>;
export const H2 = ({ children }: { children: ReactNode }) => <Text style={s.h2}>{children}</Text>;
export const P = ({ children, color = C.muted, style }: { children: ReactNode; color?: string; style?: object }) => (
  <Text style={[s.p, { color }, style]}>{children}</Text>
);
export const Eyebrow = ({ children }: { children: string }) => <Text style={s.eyebrow}>{children.toUpperCase()}</Text>;

/* ---------- layout ---------- */
export function Screen({
  title,
  back,
  right,
  children,
  scroll = true,
  footer,
}: {
  title?: string;
  back?: boolean;
  right?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
  footer?: ReactNode;
}) {
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {(title || back) && (
        <View style={s.header}>
          {back && (
            <Pressable onPress={() => router.back()} style={s.back} hitSlop={8}>
              <Text style={s.backText}>←</Text>
            </Pressable>
          )}
          <Text style={s.title} numberOfLines={1}>
            {title}
          </Text>
          {right}
        </View>
      )}
      {scroll ? (
        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[s.body, { flex: 1 }]}>{children}</View>
      )}
      {footer && <View style={s.footer}>{footer}</View>}
    </SafeAreaView>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  if (onPress)
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [s.card, style, pressed && { opacity: 0.8 }]}>
        {children}
      </Pressable>
    );
  return <View style={[s.card, style]}>{children}</View>;
}

export function Row({ title, sub, right, onPress, tone }: { title: string; sub?: string; right?: ReactNode; onPress?: () => void; tone?: 'red' }) {
  return (
    <Card onPress={onPress} style={[s.row, tone === 'red' && { borderColor: C.red, borderWidth: 1 }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={s.rowTitle}>{title}</Text>
        {sub ? <Text style={s.rowSub}>{sub}</Text> : null}
      </View>
      {right}
      {onPress && !right ? <Text style={{ color: C.muted, fontSize: 18 }}>›</Text> : null}
    </Card>
  );
}

export function KV({ k, v, color = C.text }: { k: string; v: string; color?: string }) {
  return (
    <View style={s.kv}>
      <Text style={s.kvK}>{k}</Text>
      <Text style={[s.kvV, { color }]}>{v}</Text>
    </View>
  );
}

export const Gap = ({ h = 8 }: { h?: number }) => <View style={{ height: h }} />;

export function Empty({ text }: { text: string }) {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
      <P>{text}</P>
    </Card>
  );
}

/* ---------- chips ---------- */
type Tone = 'default' | 'lime' | 'red' | 'amber' | 'green' | 'blue';
const toneColors: Record<Tone, [string, string]> = {
  default: [C.pill, C.text],
  lime: [C.lime, C.ink],
  red: [C.redBg, C.red],
  amber: [C.amberBg, C.amber],
  green: [C.greenBg, C.green],
  blue: [C.blueBg, C.blue],
};
export function Chip({ label, tone = 'default', onPress }: { label: string; tone?: Tone; onPress?: () => void }) {
  const [bg, fg] = toneColors[tone];
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={[s.chip, { backgroundColor: bg }]}>
      <Text style={[s.chipText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}
export function ChipRow<T extends string>({ options, value, onChange, wrap = true }: { options: readonly T[]; value: T | null; onChange: (v: T) => void; wrap?: boolean }) {
  const chips = options.map((o) => <Chip key={o} label={o} tone={o === value ? 'lime' : 'default'} onPress={() => onChange(o)} />);
  if (wrap) return <View style={s.chipRow}>{chips}</View>;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {chips}
    </ScrollView>
  );
}

/* ---------- buttons ---------- */
export function Btn({ label, onPress, kind = 'primary', disabled, small }: { label: string; onPress: () => void; kind?: 'primary' | 'secondary' | 'danger'; disabled?: boolean; small?: boolean }) {
  const bg = kind === 'primary' ? C.lime : kind === 'danger' ? C.redBg : C.pill;
  const fg = kind === 'primary' ? C.ink : kind === 'danger' ? C.red : C.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [s.btn, small && s.btnSmall, { backgroundColor: bg, opacity: disabled ? 0.35 : pressed ? 0.8 : 1 }]}
    >
      <Text style={[s.btnText, small && { fontSize: 14 }, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

/* ---------- inputs ---------- */
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
  secure,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  secure?: boolean;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.muted}
        multiline={multiline}
        keyboardType={keyboardType}
        secureTextEntry={secure}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
        style={[s.input, multiline && { minHeight: 90, textAlignVertical: 'top' }]}
      />
    </View>
  );
}

export function Check({ label, sub, checked, onToggle }: { label: string; sub?: string; checked: boolean; onToggle: () => void }) {
  return (
    <Pressable onPress={onToggle} style={s.check}>
      <View style={[s.box, checked && { backgroundColor: C.lime, borderColor: C.lime }]}>
        {checked && <Text style={{ color: C.ink, fontWeight: '800', fontSize: 14 }}>✓</Text>}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={s.rowTitle}>{label}</Text>
        {sub ? <Text style={s.rowSub}>{sub}</Text> : null}
      </View>
    </Pressable>
  );
}

export function Stepper({ label, value, onChange, min = 1, max = 10 }: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  return (
    <View style={[s.kv, { alignItems: 'center' }]}>
      <Text style={s.kvK}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Chip label="−" onPress={() => onChange(Math.max(min, value - 1))} />
        <Text style={[s.rowTitle, { minWidth: 20, textAlign: 'center' }]}>{value}</Text>
        <Chip label="+" onPress={() => onChange(Math.min(max, value + 1))} />
      </View>
    </View>
  );
}

/* ---------- bottom sheet ---------- */
export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.dim} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.grab} />
        <Text style={s.h2}>{title}</Text>
        <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}

/* ---------- slide to confirm ---------- */
const KNOB = 56;
export function Slide({ label, onDone, disabled }: { label: string; onDone: () => void; disabled?: boolean }) {
  const [width, setWidth] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const max = Math.max(0, width - KNOB - 8);
  const maxRef = useRef(0);
  maxRef.current = max;
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, g) => x.setValue(Math.min(Math.max(0, g.dx), maxRef.current)),
      onPanResponderRelease: (_, g) => {
        if (g.dx > maxRef.current * 0.85) {
          Animated.timing(x, { toValue: maxRef.current, duration: 120, useNativeDriver: false }).start(() => {
            doneRef.current();
            x.setValue(0);
          });
        } else {
          Animated.spring(x, { toValue: 0, useNativeDriver: false }).start();
        }
      },
    }),
  ).current;
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={[s.slide, disabled && { opacity: 0.35 }]} pointerEvents={disabled ? 'none' : 'auto'}>
      <Text style={s.slideText}>{label}</Text>
      <Animated.View {...pan.panHandlers} style={[s.knob, { transform: [{ translateX: x }] }]}>
        <Text style={{ color: C.ink, fontSize: 22, fontWeight: '800' }}>→</Text>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  back: { backgroundColor: C.card, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  backText: { color: C.text, fontSize: 16, fontWeight: '600' },
  title: { color: C.text, fontSize: 20, fontWeight: '700', flex: 1 },
  body: { padding: 20, gap: 12, paddingBottom: 40 },
  footer: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, gap: 8, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.bg },
  h1: { color: C.text, fontSize: 28, fontWeight: '800' },
  h2: { color: C.text, fontSize: 18, fontWeight: '700' },
  p: { fontSize: 14, lineHeight: 20 },
  eyebrow: { color: C.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, marginTop: 6 },
  card: { backgroundColor: C.card, borderRadius: R.card, padding: 16, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  rowTitle: { color: C.text, fontSize: 15, fontWeight: '600' },
  rowSub: { color: C.muted, fontSize: 13 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  kvK: { color: C.muted, fontSize: 14, flexShrink: 1 },
  kvV: { fontSize: 14, fontWeight: '600', textAlign: 'right', flexShrink: 1 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: R.pill, alignSelf: 'flex-start' },
  chipText: { fontSize: 12, fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  btn: { height: 50, borderRadius: R.input, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  btnSmall: { height: 38, borderRadius: 12 },
  btnText: { fontSize: 16, fontWeight: '700' },
  label: { color: C.muted, fontSize: 12, fontWeight: '600' },
  input: { backgroundColor: C.pill, borderRadius: R.input, padding: 14, color: C.text, fontSize: 15 },
  check: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: C.card, borderRadius: R.card, padding: 14 },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: C.muted, alignItems: 'center', justifyContent: 'center' },
  dim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 12, maxHeight: '85%' },
  grab: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.pill, alignSelf: 'center' },
  slide: { height: 64, borderRadius: 32, backgroundColor: C.pill, justifyContent: 'center', padding: 4 },
  slideText: { position: 'absolute', alignSelf: 'center', color: C.text, fontSize: 15, fontWeight: '700' },
  knob: { width: KNOB, height: KNOB, borderRadius: KNOB / 2, backgroundColor: C.lime, alignItems: 'center', justifyContent: 'center' },
});
