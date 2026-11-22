import { Tabs } from 'expo-router';
import { icon, tabOptions } from '../../../tabs';

export default function CustomerTabs() {
  return (
    <Tabs screenOptions={tabOptions}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('⌂') }} />
      <Tabs.Screen name="jobs" options={{ title: 'My jobs', tabBarIcon: icon('☰') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('◉') }} />
    </Tabs>
  );
}
