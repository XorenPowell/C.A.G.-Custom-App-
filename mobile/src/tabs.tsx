import { ColorValue, Text } from 'react-native';
import { C } from './theme';

/** Shared bottom-tab look for every role. Icons are plain glyphs so Expo Go needs no icon font. */
export const tabOptions = {
  headerShown: false,
  tabBarStyle: { backgroundColor: C.card, borderTopColor: C.line, height: 84, paddingTop: 8 },
  tabBarActiveTintColor: C.lime,
  tabBarInactiveTintColor: C.muted,
  tabBarLabelStyle: { fontSize: 11, fontWeight: '700' as const },
  sceneStyle: { backgroundColor: C.bg },
};

export const icon = (glyph: string) =>
  function TabIcon({ color }: { color: ColorValue }) {
    return <Text style={{ color, fontSize: 20 }}>{glyph}</Text>;
  };
