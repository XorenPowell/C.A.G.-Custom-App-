import { Tabs } from 'expo-router';
import { icon, tabOptions } from '../../../tabs';

export default function AdminTabs() {
  return (
    <Tabs screenOptions={tabOptions}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('⌂') }} />
      <Tabs.Screen name="accounts" options={{ title: 'Accounts', tabBarIcon: icon('◉') }} />
      <Tabs.Screen name="payouts" options={{ title: 'Payouts', tabBarIcon: icon('$') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: icon('⚙') }} />
    </Tabs>
  );
}
