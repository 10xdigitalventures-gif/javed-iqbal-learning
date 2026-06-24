import React, { useEffect } from "react";
import { AppState } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { AuthProvider, useAuth } from "./src/auth";
import { Loading } from "./src/components";
import { colors } from "./src/theme";
import { syncActivity } from "./src/activity";

import HomeScreen from "./src/screens/HomeScreen";
import LibraryScreen from "./src/screens/LibraryScreen";
import MyLearningScreen from "./src/screens/MyLearningScreen";
import CommunityScreen from "./src/screens/CommunityScreen";
import MessagesScreen from "./src/screens/MessagesScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import BookDetailScreen from "./src/screens/BookDetailScreen";
import ReaderScreen from "./src/screens/ReaderScreen";
import CheckoutScreen from "./src/screens/CheckoutScreen";
import HardCopyOrderScreen from "./src/screens/HardCopyOrderScreen";
import ChatScreen from "./src/screens/ChatScreen";
import LoginScreen from "./src/screens/LoginScreen";

import CoursesScreen from "./src/screens/CoursesScreen";
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
const checkoutOpts = { title: "Checkout" } as const;
const hardCopyOpts = { title: "Order hard copy" } as const;

const TAB_ICONS: Record<string, string> = {
  Home: "home",
  Library: "library",
  "My Learning": "school",
  Community: "people",
  Messages: "chatbubbles",
  Profile: "person",
};

function Tabs() {
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
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarIcon: ({ color, size, focused }) => {
          const base = TAB_ICONS[route.name] || "ellipse";
          const name = focused ? base : base + "-outline";
          return <Ionicons name={name as any} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Library" component={LibraryScreen} />
      <Tab.Screen name="My Learning" component={MyLearningScreen} />
      <Tab.Screen
        name="Courses"
        component={CoursesScreen as any}
        options={{
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "school" : "school-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen name="Community" component={CommunityScreen} />
      <Tab.Screen name="Messages" component={MessagesScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function Root() {
  const { user, loading } = useAuth();

  // Flush any queued offline activity whenever the app comes to the foreground.
  useEffect(() => {
    if (!user) return;
    syncActivity();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") syncActivity();
    });
    return () => sub.remove();
  }, [user]);

  if (loading) return <Loading />;
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
            name="Checkout"
            component={CheckoutScreen}
            options={checkoutOpts}
          />
          <Stack.Screen
            name="HardCopyOrder"
            component={HardCopyOrderScreen}
            options={hardCopyOpts}
          />
          <Stack.Screen name="Chat" component={ChatScreen} />
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
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} options={noHeader} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        <Root />
      </NavigationContainer>
    </AuthProvider>
  );
}
