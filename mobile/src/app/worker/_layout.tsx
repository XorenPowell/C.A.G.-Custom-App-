import { Stack } from 'expo-router';
import { C } from '../../theme';

export default function WorkerLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }} />;
}
