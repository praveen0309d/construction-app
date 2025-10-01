import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import axios from "axios";
import getBaseUrl from "../../baseurl";

type WorkerStats = {
  tasksPending: number;
  tasksCompleted: number;
  attendancePresent: number;
  safetyScore: number;
};

export default function WorkerHome() {
  const router = useRouter();
  const [userName, setUserName] = useState("Worker");
  const [stats, setStats] = useState<WorkerStats>({
    tasksPending: 0,
    tasksCompleted: 0,
    attendancePresent: 0,
    safetyScore: 95
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
    loadStats();
  }, []);

  const loadProfile = async () => {
    try {
      const token = await SecureStore.getItemAsync("authToken");
      const res = await axios.get(`${getBaseUrl()}/api/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUserName(res.data.name);
    } catch (err) {
      console.log("Profile load error:", err);
    }
  };

  const loadStats = async () => {
    try {
      // Simulate API calls
      setStats({
        tasksPending: 3,
        tasksCompleted: 12,
        attendancePresent: 22,
        safetyScore: 95
      });
      setLoading(false);
    } catch (err) {
      console.log("Stats load error:", err);
      setLoading(false);
    }
  };

  const QuickActionButton = ({ 
    title, 
    icon, 
    color, 
    onPress 
  }: { 
    title: string; 
    icon: React.ReactNode; 
    color: string; 
    onPress: () => void; 
  }) => (
    <TouchableOpacity style={[styles.actionButton, { borderLeftColor: color }]} onPress={onPress}>
      <View style={styles.actionIcon}>{icon}</View>
      <Text style={styles.actionText}>{title}</Text>
    </TouchableOpacity>
  );

      const handleLogout = async () => {
        Alert.alert(
          "Confirm Logout",
          "Are you sure you want to logout?",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Logout",
              style: "destructive",
              onPress: async () => {
                await SecureStore.deleteItemAsync("authToken");
                await SecureStore.deleteItemAsync("role");
                router.replace("/");
              }
            }
          ]
        );
      };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4f46e5" />
          <Text style={styles.loadingText}>Loading Dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
      
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.name}>{userName},Worker</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Ionicons name="list-outline" size={20} color="#f59e0b" />
            <Text style={styles.statNumber}>{stats.tasksPending}</Text>
            <Text style={styles.statLabel}>Pending Tasks</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="checkmark-done-outline" size={20} color="#10b981" />
            <Text style={styles.statNumber}>{stats.tasksCompleted}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="calendar-outline" size={20} color="#3b82f6" />
            <Text style={styles.statNumber}>{stats.attendancePresent}</Text>
            <Text style={styles.statLabel}>Days Present</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="shield-checkmark-outline" size={20} color="#ef4444" />
            <Text style={styles.statNumber}>{stats.safetyScore}%</Text>
            <Text style={styles.statLabel}>Safety Score</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <QuickActionButton
              title="Mark Attendance"
              icon={<Ionicons name="qr-code-outline" size={24} color="#3b82f6" />}
              color="#3b82f6"
              onPress={() => router.push("/pages/workers/Attendance")}
            />
            <QuickActionButton
              title="View Tasks"
              icon={<Ionicons name="document-text-outline" size={24} color="#f59e0b" />}
              color="#f59e0b"
              onPress={() => router.push("/pages/workers/Tasks")}
            />
            <QuickActionButton
              title="Safety Check"
              icon={<Ionicons name="shield-checkmark-outline" size={24} color="#ef4444" />}
              color="#ef4444"
              onPress={() => router.push("/pages/workers/Safety")}
            />
            <QuickActionButton
              title="My Profile"
              icon={<Ionicons name="person-outline" size={24} color="#10b981" />}
              color="#10b981"
              onPress={() => router.push("/pages/workers/Profile")}
            />
            <QuickActionButton
              title="Chat Bot"
              icon={<Ionicons name="chatbubble-ellipses-outline" size={24} color="#10b981" />}
              color="#10b981"
              onPress={() => router.push("/pages/chat")}
            />
          </View>
        </View>

        {/* Today's Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's Overview</Text>
          <View style={styles.todayContainer}>
            <View style={styles.todayItem}>
              <Ionicons name="time-outline" size={20} color="#6b7280" />
              <Text style={styles.todayText}>Check-in: 08:15 AM</Text>
            </View>
            <View style={styles.todayItem}>
              <Ionicons name="checkmark-circle-outline" size={20} color="#10b981" />
              <Text style={styles.todayText}>Safety: Compliant</Text>
            </View>
            <View style={styles.todayItem}>
              <Ionicons name="alert-circle-outline" size={20} color="#f59e0b" />
              <Text style={styles.todayText}>Tasks Due: 2</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#6b7280",
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 20,
    backgroundColor: "#fff",
  },
  greeting: {
    fontSize: 16,
    color: "#6b7280",
  },
  name: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1f2937",
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(79, 70, 229, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  roleText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#4f46e5",
  },
      logoutButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#fff",
    marginBottom: 8,
  },
  statItem: {
    width: "48%",
    alignItems: "center",
    padding: 12,
    marginBottom: 12,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1f2937",
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  section: {
    padding: 20,
    backgroundColor: "#fff",
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 16,
  },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  actionButton: {
    width: "48%",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  actionIcon: {
    marginBottom: 8,
  },
  actionText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    textAlign: "center",
  },
  todayContainer: {
    gap: 12,
  },
  todayItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    gap: 8,
  },
  todayText: {
    fontSize: 14,
    color: "#374151",
  },
});