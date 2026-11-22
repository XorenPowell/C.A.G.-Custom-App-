import { Tabs } from 'expo-router';
import { icon, tabOptions } from '../../../tabs';

export default function DispatcherTabs() {
  return (
    <Tabs screenOptions={tabOptions}>
      <Tabs.Screen name="index" options={{ title: 'Queue', tabBarIcon: icon('✓') }} />
      <Tabs.Screen name="jobs" options={{ title: 'Jobs', tabBarIcon: icon('☰') }} />
      <Tabs.Screen name="field" options={{ title: 'Field', tabBarIcon: icon('⌖') }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: icon('⋯') }} />
    </Tabs>
  );
}
