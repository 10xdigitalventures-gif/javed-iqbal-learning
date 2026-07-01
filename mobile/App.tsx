import React, { useEffect, useState } from "react";
import {
  AppState,
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
} from "react-native";
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
import { api } from "./src/api";

import HomeScreen from "./src/screens/HomeScreen";
import ExploreScreen from "./src/screens/ExploreScreen";
import LibraryScreen from "./src/screens/LibraryScreen";
import CommunityScreen from "./src/screens/CommunityScreen";
import MessagesScreen from "./src/screens/MessagesScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import NotificationSettingsScreen from "./src/screens/NotificationSettingsScreen";
import NotificationsScreen from "./src/screens/NotificationsScreen";
import SearchScreen from "./src/screens/SearchScreen";
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

// Instant screen transitions so navigating feels immediate (no slide delay).
const stackScreenOptions = { ...brandHeader, animation: "none" } as const;
const notifInboxOpts = { ...brandHeader, title: "Notifications" } as const;
const searchOpts = { ...brandHeader, title: "Search" } as const;

const bookDetailOpts = { title: "Book" } as const;
const audioBooksOpts = { ...brandHeader, title: "Audio Books" } as const;
const checkoutOpts = { title: "Checkout" } as const;
const hardCopyOpts = { title: "Order hard copy" } as const;
const coursesOpts = { ...brandHeader, title: "Courses" } as const;
const certificatesOpts = { ...brandHeader, title: "My Certificates" } as const;
const packagesOpts = { ...brandHeader, title: "Packages" } as const;
const meetingsOpts = { ...brandHeader, title: "My meetings" } as const;
const consultantsOpts = { ...brandHeader, title: "Find consultants" } as const;
const profileOpts = { ...brandHeader, title: "Profile" } as const;

const TAB_ICONS: Record<string, string> = {
  Home: "home",
  Explore: "compass",
  Library: "library",
  Community: "people",
  Messages: "chatbubbles",
  Profile: "person",
};

function NotifBell({ navigation }: any) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let alive = true;
    const loadCount = () =>
      api("/notifications/unread-count")
        .then((n: any) => {
          if (alive) setCount(typeof n === "number" ? n : n?.count || 0);
        })
        .catch(() => undefined);
    loadCount();
    const timer = setInterval(loadCount, 30000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);
  return (
    <TouchableOpacity
      onPress={() => navigation.navigate("Notifications")}
      style={bell.btn}
      activeOpacity={0.7}
    >
      <Ionicons name="notifications-outline" size={22} color={colors.text} />
      {count > 0 ? (
        <View style={bell.badge}>
          <Text style={bell.badgeText}>{count > 99 ? "99+" : count}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function HeaderIcons({ navigation }: any) {
  return (
    <View style={bell.row}>
      <TouchableOpacity
        onPress={() => navigation.navigate("Search")}
        style={bell.iconBtn}
        activeOpacity={0.7}
      >
        <Ionicons name="search-outline" size={22} color={colors.text} />
      </TouchableOpacity>
      <NotifBell navigation={navigation} />
    </View>
  );
}

const bell = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  iconBtn: { paddingHorizontal: 6, paddingVertical: 6 },
  btn: { paddingHorizontal: 8, paddingVertical: 6 },
  badge: {
    position: "absolute",
    right: 8,
    top: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
});

function ProfileAvatarButton({ navigation }: any) {
  const { user } = useAuth();
  const initials = (user?.name || "?")
    .trim()
    .split(" ")
    .map((p: string) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <TouchableOpacity
      onPress={() => navigation.navigate("Profile")}
      style={homeHead.avatarBtn}
      activeOpacity={0.7}
    >
      <View style={homeHead.avatar}>
        <Text style={homeHead.avatarText}>{initials || "?"}</Text>
      </View>
    </TouchableOpacity>
  );
}

function HomeHeaderTitle() {
  const { user } = useAuth();
  const first = (user?.name || "").trim().split(" ")[0] || "there";
  return (
    <View style={homeHead.titleWrap}>
      <Text style={homeHead.welcome}>Welcome</Text>
      <Text style={homeHead.name}>{first}</Text>
    </View>
  );
}

const homeHead = StyleSheet.create({
  avatarBtn: { paddingLeft: 16, paddingRight: 4 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  titleWrap: { justifyContent: "center" },
  welcome: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  name: { fontSize: 17, color: colors.text, fontWeight: "800" },
});

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
      screenOptions={({ route, navigation }) => ({
        headerStyle: { backgroundColor: colors.card },
        headerTitleStyle: { fontWeight: "700", color: colors.text },
        headerShadowVisible: false,
        headerRight: () => <HeaderIcons navigation={navigation} />,
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
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={({ navigation }) => ({
          headerTitleAlign: "left",
          headerTitle: () => <HomeHeaderTitle />,
          headerLeft: () => <ProfileAvatarButton navigation={navigation} />,
        })}
      />
      <Tab.Screen name="Library" component={LibraryScreen} />
      <Tab.Screen name="Explore" component={ExploreScreen as any} />
      <Tab.Screen name="Community" component={CommunityScreen} />
      <Tab.Screen name="Messages" component={MessagesScreen} />
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
    <Stack.Navigator screenOptions={stackScreenOptions}>
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
            name="Profile"
            component={ProfileScreen}
            options={profileOpts}
          />
          <Stack.Screen
            name="NotificationSettings"
            component={NotificationSettingsScreen}
            options={{ title: "Notifications" } as any}
          />
          <Stack.Screen
            name="Notifications"
            component={NotificationsScreen}
            options={notifInboxOpts}
          />
          <Stack.Screen
            name="Search"
            component={SearchScreen}
            options={searchOpts}
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
