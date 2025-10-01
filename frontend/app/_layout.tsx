import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";

export const unstable_settings = {
  initialRouteName: "index", // expo-router uses folder-based routing
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack initialRouteName="index">
           <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="pages/worker/workerhome" options={{ headerShown: false }} />
        <Stack.Screen name="pages/manager/managerHome" options={{ headerShown: false }} />
        <Stack.Screen name="pages/manager/attendance" options={{ headerShown: false }} />
        <Stack.Screen name="pages/manager/tasks" options={{ headerShown: false }} />
        <Stack.Screen name="pages/manager/safety" options={{ headerShown: false }} />
        <Stack.Screen name="pages/manager/emergency" options={{ headerShown: false }} />
        <Stack.Screen name="pages/supervisor/supervisorHome" options={{ headerShown: false }} />
        <Stack.Screen name="pages/supervisor/TasksReview" options={{ headerShown: false }} />
        <Stack.Screen name="pages/supervisor/Alerts" options={{ headerShown: false }} />
        <Stack.Screen name="pages/supervisor/AttendanceReview" options={{ headerShown: false }} />
        <Stack.Screen name="pages/supervisor/TeamManagement" options={{ headerShown: false }} />
        <Stack.Screen name="pages/supervisor/SafetyReports" options={{ headerShown: false }} />
        <Stack.Screen name="pages/supervisor/ProgressReports" options={{ headerShown: false }} />
        <Stack.Screen name="pages/supervisor/Newworkers" options={{ headerShown: false }} />
        <Stack.Screen name="pages/workers/workerHome" options={{ headerShown: false }} />
        <Stack.Screen name="pages/workers/Attendance" options={{ headerShown: false }} />
        <Stack.Screen name="pages/workers/Profile" options={{ headerShown: false }} />
        <Stack.Screen name="pages/workers/Safety" options={{ headerShown: false }} />
        <Stack.Screen name="pages/workers/Tasks" options={{ headerShown: false }} />
        <Stack.Screen name="pages/chat" options={{ headerShown: false }} />

        <Stack.Screen name="modal" options={{ presentation: "modal", title: "Modal" }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
