import React, { useEffect, useState } from "react";
import { AppState } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { AuthProvider, useAuth } from "./src/auth";
import { Loading } from "./src/components";
import { colors } from "./src/theme";
import { syncActivity } from "./src/activity";

import HomeScreen from "./src/screens/HomeScreen";
import ExploreScreen from "./src/screens/ExploreScreen";
import LibraryScreen from "./src/screens/LibraryScreen";
import CommunityScreen from "./src/screens/CommunityScreen";
import MessagesScreen from "./src/screens/MessagesScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import NotificationSettingsScreen from "./src/screens/NotificationSettingsScreen";
import DevicesScreen from "./src/screens/DevicesScreen";
import BookDetailScreen from "./src/screens/BookDetailScreen";
import ReaderScreen from "./src/screens/ReaderScreen";
import AudioBooksScreen from "./src/screens/AudioBooksScreen";
import CheckoutScreen from "./src/screens/CheckoutScreen";
import HardCopyOrderScreen from "./src/screens/HardCopyOrderScreen";
import BankTransferScreen from "./src/screens/BankTransferScreen";
import ChatScreen from "./src/screens/ChatScreen";
import LoginScreen from "./src/screens/LoginScreen";
import PackagesScreen from "./src/screens/PackagesScreen";
import MeetingsScreen from "./src/screens/MeetingsScreen";
import ConsultantsScreen from "./src/screens/ConsultantsScreen";

import CoursesScreen from "./src/screens/CoursesScreen";
import CertificatesScreen from "./src/screens/CertificatesScreen";
import CourseDetailScreen from "./src/screens/CourseDetailScreen";
import LessonDetailScreen from "./src/screens/LessonDetailScreen";
import QuizDetailScreen from "./src/screens/QuizDetailScreen";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const noHeader = { headerShown: false } as const;
const brandHeader = {
  headerStyle: { backgroundColor: colors.card },
  headerTintColor: colors.text,
  headerTitleStyle: { fontWeight: "700" as const },
} as const;

const bookDetailOpts = { title: "Book" } as const;
const audioBooksOpts = { ...brandHeader, title: "Audio Books" } as const;
const checkoutOpts = { title: "Checkout" } as const;
const hardCopyOpts = { title: "Order hard copy" } as const;
const coursesOpts = { ...brandHeader, title: "Courses" } as const;
const certificatesOpts = { ...brandHeader, title: "My Certificates" } as const;
const packagesOpts = { ...brandHeader, title: "Packages" } as const;
const meetingsOpts = { ...brandHeader, title: "My meetings" } as const;
const consultantsOpts = { ...brandHeader, title: "Find consultants" } as const;

const TAB_ICONS: Record<string, string> = {
  Home: "home",
  Explore: "compass",
  Library: "library",
  Community: "people",
  Messages: "chatbubbles",
  Profile: "person",
};

function Tabs() {
  // Add the device's bottom safe-area inset (home indicator / gesture bar) so
  // the tab bar is never clipped and the tabs stay comfortably tappable.
  const insets = useSafeAreaInsets();
  // Always keep a comfortable gap below the tabs on top of the device's bottom
  // safe-area inset, so tabs are never clipped and stay easy to tap on phones
  // both with and without a gesture bar.
  // Comfortable gap below the tabs on top of the device's bottom safe-area
  // inset. Kept roughly half of the previous value so the tab bar no longer
  // leaves a large empty band at the bottom of the screen.
  const bottomInset = Math.max(insets.bottom, 16) + 8;
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.card },
        headerTitleStyle: { fontWeight: "700", color: colors.text },
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          borderTopColor: colors.border,
          height: 64 + bottomInset,
          paddingBottom: bottomInset,
          paddingTop: 10,
        },
        tabBarItemStyle: { paddingVertical: 4 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600", marginBottom: 6 },
        tabBarIcon: ({ color, size, focused }) => {
          const base = TAB_ICONS[route.name] || "ellipse";
          const name = focused ? base : base + "-outline";
          return <Ionicons name={name as any} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Explore" component={ExploreScreen as any} />
      <Tab.Screen name="Library" component={LibraryScreen} />
      <Tab.Screen name="Community" component={CommunityScreen} />
      <Tab.Screen name="Messages" component={MessagesScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function Root() {
  const { user, loading } = useAuth();
  // Keep the branded loading screen up for at least 3 seconds on launch.
  const [minSplash, setMinSplash] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setMinSplash(false), 3000);
    return () => clearTimeout(t);
  }, []);

  // Flush any queued offline activity whenever the app comes to the foreground.
  useEffect(() => {
    if (!user) return;
    syncActivity();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") syncActivity();
    });
    return () => sub.remove();
  }, [user]);

  if (loading || minSplash) return <Loading />;
  return (
    <Stack.Navigator screenOptions={brandHeader}>
      {user ? (
        <>
          <Stack.Screen name="Tabs" component={Tabs} options={noHeader} />
          <Stack.Screen
            name="BookDetail"
            component={BookDetailScreen}
            options={bookDetailOpts}
          />
          <Stack.Screen
            name="Reader"
            component={ReaderScreen}
            options={noHeader}
          />
          <Stack.Screen
            name="AudioBooks"
            component={AudioBooksScreen as any}
            options={audioBooksOpts}
          />
          <Stack.Screen
            name="Checkout"
            component={CheckoutScreen}
            options={checkoutOpts}
          />
          <Stack.Screen
            name="HardCopyOrder"
            component={HardCopyOrderScreen}
            options={hardCopyOpts}
          />
          <Stack.Screen
            name="BankTransfer"
            component={BankTransferScreen}
            options={{ title: "Bank transfer" } as any}
          />
          <Stack.Screen name="Chat" component={ChatScreen} />
          <Stack.Screen
            name="NotificationSettings"
            component={NotificationSettingsScreen}
            options={{ title: "Notifications" } as any}
          />
          <Stack.Screen
            name="Devices"
            component={DevicesScreen}
            options={{ title: "Devices" } as any}
          />
          <Stack.Screen
            name="Certificates"
            component={CertificatesScreen}
            options={certificatesOpts}
          />
          <Stack.Screen
            name="Courses"
            component={CoursesScreen as any}
            options={coursesOpts}
          />
          <Stack.Screen
            name="CourseDetail"
            component={CourseDetailScreen as any}
            options={brandHeader}
          />
          <Stack.Screen
            name="LessonDetail"
            component={LessonDetailScreen as any}
            options={noHeader}
          />
          <Stack.Screen
            name="QuizDetail"
            component={QuizDetailScreen as any}
            options={{ title: "Quiz" } as any}
          />
          <Stack.Screen
            name="Packages"
            component={PackagesScreen as any}
            options={packagesOpts}
          />
          <Stack.Screen
            name="Meetings"
            component={MeetingsScreen as any}
            options={meetingsOpts}
          />
          <Stack.Screen
            name="Consultants"
            component={ConsultantsScreen as any}
            options={consultantsOpts}
          />
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} options={noHeader} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <StatusBar style="dark" />
          <Root />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
