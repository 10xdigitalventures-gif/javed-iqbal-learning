import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from './src/theme';
import HomeScreen from './src/screens/HomeScreen';
import ExpertDetailScreen from './src/screens/ExpertDetailScreen';
import WebViewScreen from './src/screens/WebViewScreen';

const Stack = createNativeStackNavigator();

const brandHeader = {
  headerStyle: { backgroundColor: colors.card },
  headerTintColor: colors.text,
  headerTitleStyle: { fontWeight: '700' as const },
  headerShadowVisible: false,
} as const;

const homeOpts = {
  title: '10X Marketplace',
  headerStyle: { backgroundColor: colors.brand },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: '800' as const },
} as const;

function expertDetailOpts({ route }: any) {
  return { title: (route.params as any)?.expertName || 'Expert' };
}

function webViewOpts({ route }: any) {
  return { title: (route.params as any)?.title || 'Storefront' };
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        <Stack.Navigator screenOptions={brandHeader}>
          <Stack.Screen name="Home" component={HomeScreen} options={homeOpts} />
          <Stack.Screen
            name="ExpertDetail"
            component={ExpertDetailScreen}
            options={expertDetailOpts}
          />
          <Stack.Screen
            name="WebView"
            component={WebViewScreen}
            options={webViewOpts}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
