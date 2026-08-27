import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Colors } from '../../constants/theme';
import { useMarketplace } from '../../providers/MarketplaceProvider';
import { useLocalization } from '../../providers/LocalizationProvider';

export default function TabsLayout() {
  const { profile } = useMarketplace();
  const { t } = useLocalization();
  const isProvider = profile?.accountType === 'provider';

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: Colors.surface },
        headerShadowVisible: false,
        headerTintColor: Colors.text,
        headerTitleStyle: { fontWeight: '800' },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSubtle,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '700', marginTop: 2 },
        tabBarStyle: {
          height: 70,
          paddingTop: 8,
          paddingBottom: 8,
          borderTopColor: Colors.border,
          backgroundColor: Colors.surface,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('Home'),
          headerShown: false,
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: t('Saved services'),
          tabBarLabel: t('Saved'),
          href: isProvider ? null : undefined,
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? 'heart' : 'heart-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: t('My requests'),
          tabBarLabel: t('Requests'),
          href: isProvider ? null : undefined,
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? 'receipt' : 'receipt-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="business"
        options={{
          title: t('Provider dashboard'),
          tabBarLabel: t('Business'),
          href: isProvider ? undefined : null,
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? 'briefcase' : 'briefcase-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('Profile'),
          headerShown: false,
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
