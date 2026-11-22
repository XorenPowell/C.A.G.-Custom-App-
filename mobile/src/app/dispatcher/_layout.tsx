import { Stack } from 'expo-router';
import { C } from '../../theme';

export default function DispatcherLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }} />;
}
