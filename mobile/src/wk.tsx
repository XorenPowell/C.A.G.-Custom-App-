// Worker UI kit — every size, colour and spacing here is read from the Figma
// "Worker" page (file x2ZIOKdVOjLlaUh9L5dh5S). Change Figma first, then this.
import { ReactNode, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardTypeOptions,
  Linking,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleProp,
  Text,
  TextInput,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';

/* ---------- tokens (Figma) ---------- */
export const K = {
  bg: '#0e0f12',
  card: '#1b1d21',
  pill: '#292b30',
  text: '#f5f7fa',
  muted: '#99a1ad',
  lime: '#ccff00',
  ink: '#0a0d0f',
  amber: '#ffbe3c',
  amberBg: '#3a2c0e',
  red: '#ff6e6e',
  redBg: '#461014',
  blue: '#4d99f2',
  dim: 'rgba(6,7,9,0.94)',
};
const F = { r: 'Inter_400Regular', m: 'Inter_500Medium', s: 'Inter_600SemiBold', b: 'Inter_700Bold' } as const;
type W = keyof typeof F;

/** Text in Inter at an exact Figma size / weight / colour. */
export function T({ s = 14, w = 'r', c = K.text, style, children, lines, center }: { s?: number; w?: W; c?: string; style?: StyleProp<TextStyle>; children: ReactNode; lines?: number; center?: boolean }) {
  return (
    <Text numberOfLines={lines} style={[{ fontFamily: F[w], fontSize: s, color: c, lineHeight: Math.round(s * 1.25) }, center && { textAlign: 'center' }, style]}>
      {children}
    </Text>
  );
}
export const Eyebrow = ({ children, c = K.muted }: { children: string; c?: string }) => <T s={11} w="b" c={c}>{children}</T>;

/* ---------- layout ---------- */
/** Figma frame: 20 padding, 14 gap, bg #0e0f12. */
export function Page({ children, header, footer }: { children: ReactNode; header?: ReactNode; footer?: ReactNode }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: K.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {header}
        {children}
      </ScrollView>
      {footer}
    </SafeAreaView>
  );
}

/** Back (40×40, r12, card) + title 18/SemiBold, gap 12. */
export function BackHeader({ title }: { title: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, height: 40 }}>
      <Pressable onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: K.card, alignItems: 'center', justifyContent: 'center' }} hitSlop={6}>
        <T s={16} w="s">←</T>
      </Pressable>
      <T s={18} w="s">{title}</T>
    </View>
  );
}

/** Card: p16, r18, gap 8, #1b1d21. */
export function Card({ children, style, onPress, bg = K.card }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; bg?: string }) {
  const base: ViewStyle = { backgroundColor: bg, borderRadius: 18, padding: 16, gap: 8 };
  if (onPress) return <Pressable onPress={onPress} style={({ pressed }) => [base, style, pressed && { opacity: 0.85 }]}>{children}</Pressable>;
  return <View style={[base, style]}>{children}</View>;
}

/** Label 14/Regular muted ↔ value 14/SemiBold, space-between. */
export function KV({ k, v, vc = K.text, onPress }: { k: string; v: string; vc?: string; onPress?: () => void }) {
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
      <T s={14} c={K.muted} style={{ flexShrink: 1 }}>{k}</T>
      <T s={14} w="s" c={vc} style={{ flexShrink: 1, textAlign: 'right' }}>{v}</T>
    </Pressable>
  );
}

export const Row = ({ children, gap = 8, style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap }, style]}>{children}</View>
);

/* ---------- chips & buttons ---------- */
/** Chip: p5/10, r999, 11/SemiBold. */
export function Chip({ label, bg = K.pill, c = K.text, w = 's', onPress, self }: { label: string; bg?: string; c?: string; w?: W; onPress?: () => void; self?: 'flex-start' | 'center' }) {
  // No alignSelf by default so rows can centre chips; pass self="flex-start" inside a column.
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={{ backgroundColor: bg, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 10, alignSelf: self }}>
      <T s={11} w={w} c={c}>{label}</T>
    </Pressable>
  );
}
export const chipFor = {
  lime: { bg: K.lime, c: K.ink },
  pill: { bg: K.pill, c: K.text },
  pillMuted: { bg: K.pill, c: K.muted },
  amber: { bg: K.amberBg, c: K.amber },
  red: { bg: K.redBg, c: K.red },
  blue: { bg: K.blue, c: K.ink },
};

/** Button / Primary & Secondary: h48, r14, 15/SemiBold. */
export function Btn({ label, onPress, kind = 'primary', disabled, flex, h = 48, dark }: { label: string; onPress?: () => void; kind?: 'primary' | 'secondary'; disabled?: boolean; flex?: boolean; h?: number; dark?: boolean }) {
  // `dark` = the ink-coloured variants used on the lime offer card.
  const primary = kind === 'primary';
  const bg = dark ? (primary ? K.ink : 'transparent') : primary ? K.lime : 'transparent';
  const fg = dark ? (primary ? K.lime : K.ink) : primary ? K.ink : K.text;
  const border = dark ? K.ink : primary ? 'transparent' : K.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        { height: h, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: bg, borderWidth: primary && !dark ? 0 : 1.5, borderColor: border, opacity: disabled ? 0.4 : pressed ? 0.85 : 1 },
        flex && { flex: 1 },
      ]}
    >
      <T s={15} w="s" c={fg}>{label}</T>
    </Pressable>
  );
}

/** Small outlined pill button (Call / Text): p9/14, r999, stroke 1.5. */
export function PillBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ borderWidth: 1.5, borderColor: K.text, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 14, opacity: pressed ? 0.7 : 1 })}>
      <T s={13} w="s">{label}</T>
    </Pressable>
  );
}

/** Circle with initials on lime. */
export function Avatar({ name, size = 44, fs = 14 }: { name: string; size?: number; fs?: number }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('');
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: K.lime, alignItems: 'center', justifyContent: 'center' }}>
      <T s={fs} w="b" c={K.ink}>{initials}</T>
    </View>
  );
}

/** Card / Dispatcher contact. */
export function DispatcherCard({ name, phone, label = 'YOUR DISPATCHER', smsBody }: { name: string; phone: string; label?: string; smsBody?: string }) {
  const num = phone.replace(/\D/g, '');
  return (
    <View style={{ backgroundColor: K.card, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Avatar name={name} />
      <View style={{ flex: 1, gap: 2 }}>
        <Eyebrow>{label}</Eyebrow>
        <T s={16} w="s">{name}</T>
      </View>
      <PillBtn label="Call" onPress={() => Linking.openURL(`tel:${num}`)} />
      <PillBtn label="Text" onPress={() => Linking.openURL(`sms:${num}${smsBody ? `?body=${encodeURIComponent(smsBody)}` : ''}`)} />
    </View>
  );
}

/* ---------- inputs ---------- */
/** Field: label 13/Regular muted, gap 6; input #292b30, r14, p14, 15/Regular. */
export function Field({ label, value, onChangeText, placeholder, multiline, keyboardType, style }: { label: string; value: string; onChangeText: (t: string) => void; placeholder?: string; multiline?: boolean; keyboardType?: KeyboardTypeOptions; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ gap: 6 }, style]}>
      <T s={13} c={K.muted}>{label}</T>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={K.muted}
        multiline={multiline}
        keyboardType={keyboardType}
        style={{ backgroundColor: K.pill, borderRadius: 14, padding: 14, color: K.text, fontFamily: F.r, fontSize: 15, minHeight: multiline ? 96 : 48, textAlignVertical: multiline ? 'top' : 'center' }}
      />
    </View>
  );
}

/* ---------- sheet (floating card over a dimmed screen) ---------- */
/** Sheet: 20 from the sides and bottom, r24, p20, gap 12, #1b1d21. */
export function Sheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: K.dim }} onPress={onClose} />
      <View style={{ position: 'absolute', left: 20, right: 20, bottom: 20 + insets.bottom, maxHeight: '88%' }}>
        <ScrollView style={{ backgroundColor: K.card, borderRadius: 24 }} contentContainerStyle={{ padding: 20, gap: 12 }} keyboardShouldPersistTaps="handled" bounces={false}>
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}
export const SheetTitle = ({ children }: { children: string }) => <T s={22} w="b">{children}</T>;

/* ---------- slide bar ---------- */
const KNOB = 60;
/** Slide bar: 68 high, r34, lime→blue gradient, white knob 60. Locked: #292b30, knob #1b1d21. */
export function SlideBar({ label, onDone, locked, lockedLabel }: { label: string; onDone: () => void; locked?: boolean; lockedLabel?: string }) {
  const [width, setWidth] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const max = useRef(0);
  max.current = Math.max(0, width - KNOB - 8);
  const done = useRef(onDone);
  done.current = onDone;
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => x.setValue(Math.min(Math.max(0, g.dx), max.current)),
      onPanResponderRelease: (_, g) => {
        if (g.dx > max.current * 0.85) {
          Animated.timing(x, { toValue: max.current, duration: 120, useNativeDriver: true }).start(() => {
            done.current();
            x.setValue(0);
          });
        } else Animated.spring(x, { toValue: 0, useNativeDriver: true }).start();
      },
    }),
  ).current;

  if (locked)
    return (
      <View style={{ height: 68, borderRadius: 34, backgroundColor: K.pill, justifyContent: 'center', padding: 4 }}>
        <T s={16} w="b" c={K.muted} center style={{ position: 'absolute', left: 0, right: 0 }}>{lockedLabel ?? label}</T>
        <View style={{ width: KNOB, height: KNOB, borderRadius: 30, backgroundColor: K.card, alignItems: 'center', justifyContent: 'center' }}>
          <T s={22} w="b" c={K.muted}>•</T>
        </View>
      </View>
    );
  return (
    <LinearGradient colors={[K.lime, K.blue]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ height: 68, borderRadius: 34, justifyContent: 'center', padding: 4 }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <T s={16} w="b" c={K.ink} center style={{ position: 'absolute', left: 0, right: 0 }}>{label}</T>
      <Animated.View {...pan.panHandlers} style={{ width: KNOB, height: KNOB, borderRadius: 30, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', transform: [{ translateX: x }] }}>
        <T s={22} w="b" c={K.ink}>→</T>
      </Animated.View>
    </LinearGradient>
  );
}

/* ---------- "It's yours!" burst ---------- */
const CONFETTI = Array.from({ length: 48 }, (_, i) => ({
  x: (20 + i * 97) % 370,
  y: 60 + ((i * 53) % 330),
  w: [6, 8, 10, 12][i % 4]!,
  h: [6, 14, 10, 22][i % 4]!,
  round: i % 2 === 0,
  c: [K.lime, K.blue, K.text][i % 3]!,
}));
/** Banner "It's Yours!" with a confetti burst that falls ~220px (Figma 21:547 → 31:2). */
export function ItsYours({ visible, onDone }: { visible: boolean; onDone: () => void }) {
  const fall = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) return;
    fall.setValue(0);
    pop.setValue(0);
    Animated.parallel([
      Animated.timing(fall, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(pop, { toValue: 1, friction: 5, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(onDone, 1900);
    return () => clearTimeout(t);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!visible) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}>
      {CONFETTI.map((p, i) => (
        <Animated.View key={i} style={{
          position: 'absolute', left: p.x, top: p.y, width: p.w, height: p.h, borderRadius: p.round ? p.w / 2 : 2, backgroundColor: p.c,
          opacity: fall.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
          transform: [{ translateY: fall.interpolate({ inputRange: [0, 1], outputRange: [0, 220] }) }],
        }} />
      ))}
      <View style={{ position: 'absolute', top: 300, left: 0, right: 0, alignItems: 'center' }}>
        <Animated.View style={{ transform: [{ scale: pop }], shadowColor: '#d9b3ff', shadowOpacity: 0.55, shadowRadius: 16, shadowOffset: { width: 0, height: 0 }, elevation: 12 }}>
          <LinearGradient colors={['#e8b8f5', '#a8def7', '#c7fae0', '#fff7d6']} locations={[0, 0.35, 0.7, 1]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ borderRadius: 23, padding: 3 }}>
            <View style={{ backgroundColor: K.lime, borderRadius: 20, paddingVertical: 16, paddingHorizontal: 24 }}>
              <T s={24} w="b" c={K.ink}>It’s Yours!</T>
            </View>
          </LinearGradient>
        </Animated.View>
      </View>
    </View>
  );
}

/* ---------- menu drawer (Figma 58:349) ---------- */
const MENU = [
  ['Home', '/worker'],
  ['Jobs', '/worker/jobs'],
  ['Earnings', '/worker/earnings'],
  ['Paperwork', '/worker/paperwork'],
  ['My profile', '/worker/profile'],
  ['Settings', '/worker/profile'],
] as const;
export function MenuDrawer({ visible, onClose, name, rating, active, onSignOut }: { visible: boolean; onClose: () => void; name: string; rating: number; active: string; onSignOut: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <View style={{ width: 300, backgroundColor: K.card, paddingHorizontal: 20, paddingTop: 20 + insets.top, paddingBottom: 20, gap: 6 }}>
          <Row>
            <T s={16} w="s">{name}</T>
            <Chip label={rating.toFixed(1)} {...chipFor.lime} />
          </Row>
          {MENU.map(([label, href]) => {
            const on = label === active;
            return (
              <Pressable key={label} onPress={() => { onClose(); if (!on) router.navigate(href as never); }}
                style={({ pressed }) => ({ padding: 14, borderRadius: 12, backgroundColor: on ? K.pill : pressed ? K.pill : 'transparent' })}>
                <T s={15} w="m" c={on ? K.lime : K.text}>{label}</T>
              </Pressable>
            );
          })}
          <Pressable onPress={() => { onClose(); onSignOut(); }} style={{ padding: 14, marginTop: 4 }}>
            <T s={15} c={K.muted}>Sign out</T>
          </Pressable>
        </View>
        <Pressable style={{ flex: 1, backgroundColor: K.dim }} onPress={onClose} />
      </View>
    </Modal>
  );
}
