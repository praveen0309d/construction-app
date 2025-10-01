import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
    Alert,
  SafeAreaView,
  StatusBar,
  Image,
  ActivityIndicator
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import axios from "axios";
import getBaseUrl from "../../baseurl";

type DashboardStats = {
  pendingTasks: number;
  pendingAlerts: number;
  todayAttendance: number;
  teamMembers: number;
};

export default function SupervisorHome() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    pendingTasks: 0,
    pendingAlerts: 0,
    todayAttendance: 0,
    teamMembers: 0
  });
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("Supervisor");

  useEffect(() => {
    loadProfile();
    loadStats();
  }, []);

  const loadProfile = async () => {
    try {
      const token = await SecureStore.getItemAsync("authToken");
      if (!token) return;

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
      // Simulate API call - replace with actual endpoints
      setStats({
        pendingTasks: 8,
        pendingAlerts: 3,
        todayAttendance: 12,
        teamMembers: 15
      });
      setLoading(false);
    } catch (err) {
      console.log("Stats load error:", err);
      setLoading(false);
    }
  };

  const DashboardCard = ({ 
    title, 
    value, 
    icon, 
    color, 
    onPress 
  }: { 
    title: string; 
    value: number; 
    icon: React.ReactNode; 
    color: string; 
    onPress: () => void; 
  }) => (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconContainer, { backgroundColor: color }]}>
          {icon}
        </View>
        <Text style={styles.cardValue}>{value}</Text>
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
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
  
  const ActionButton = ({ 
    title, 
    description, 
    icon, 
    onPress 
  }: { 
    title: string; 
    description: string; 
    icon: React.ReactNode; 
    onPress: () => void; 
  }) => (
    <TouchableOpacity style={styles.actionButton} onPress={onPress}>
      <View style={styles.actionIcon}>{icon}</View>
      <View style={styles.actionTextContainer}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionDescription}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#6b7280" />
                {/* <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
                  <Ionicons name="log-out-outline" size={24} color="#6b7280" />
                </TouchableOpacity> */}
    </TouchableOpacity>
  );

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
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.name}>{userName},Supervisor</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>

        {/* Stats Overview */}
        <View style={styles.statsContainer}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.statsGrid}>
            <DashboardCard
              title="Pending Tasks"
              value={stats.pendingTasks}
              icon={<Ionicons name="list-outline" size={20} color="#fff" />}
              color="#f59e0b"
              onPress={() => router.push("/pages/supervisor/TasksReview")}
            />
            <DashboardCard
              title="Pending Alerts"
              value={stats.pendingAlerts}
              icon={<Ionicons name="alert-circle-outline" size={20} color="#fff" />}
              color="#ef4444"
              onPress={() => router.push("/pages/supervisor/Alerts")}
            />
            <DashboardCard
              title="Today's Attendance"
              value={stats.todayAttendance}
              icon={<Ionicons name="people-outline" size={20} color="#fff" />}
              color="#10b981"
              onPress={() => router.push("/pages/supervisor/AttendanceReview")}
            />
            <DashboardCard
              title="Team Members"
              value={stats.teamMembers}
              icon={<Ionicons name="person-outline" size={20} color="#fff" />}
              color="#3b82f6"
              onPress={() => router.push("/pages/supervisor/TeamManagement")}
            />
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsContainer}>
            <ActionButton
              title="Review Tasks"
              description="Approve or reject completed tasks"
              icon={<Ionicons name="document-text-outline" size={24} color="#3b82f6" />}
              onPress={() => router.push("/pages/supervisor/TasksReview")}
            />
            <ActionButton
              title="Handle Alerts"
              description="Address safety and emergency alerts"
              icon={<Ionicons name="warning-outline" size={24} color="#ef4444" />}
              onPress={() => router.push("/pages/supervisor/Alerts")}
            />
            <ActionButton
              title="Attendance Review"
              description="Check team attendance records"
              icon={<Ionicons name="time-outline" size={24} color="#10b981" />}
              onPress={() => router.push("/pages/supervisor/AttendanceReview")}
            />
            <ActionButton
              title="Team Management"
              description="Manage your team members"
              icon={<Ionicons name="people-outline" size={24} color="#8b5cf6" />}
              onPress={() => router.push("/pages/supervisor/TeamManagement")}
            />
            <ActionButton
              title="Safety Reports"
              description="View safety compliance reports"
              icon={<Ionicons name="shield-checkmark-outline" size={24} color="#f59e0b" />}
              onPress={() => router.push("/pages/supervisor/SafetyReports")}
            />
            <ActionButton
              title="Progress Reports"
              description="Generate project progress reports"
              icon={<Ionicons name="bar-chart-outline" size={24} color="#06b6d4" />}
              onPress={() => router.push("/pages/supervisor/ProgressReports")}
            />
              <ActionButton
              title="Add New workers"
              description="add an new workers"
              icon={<Ionicons name="person-add-outline" size={24} color="#06b6d4" />

}
              onPress={() => router.push("/pages/supervisor/Newworkers")}
            />
              <ActionButton
              title="Chat Bot"
              description="Clear your doubt with chat bot"
              icon={<Ionicons name="chatbubble-ellipses-outline" size={24} color="#06b6d4" />}
              onPress={() => router.push("/pages/chat")}
            />
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <View style={styles.activityContainer}>
            <View style={styles.activityItem}>
              <View style={[styles.activityIcon, { backgroundColor: "rgba(59, 130, 246, 0.1)" }]}>
                <Ionicons name="checkmark-circle" size={16} color="#3b82f6" />
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityText}>Task completed: Foundation work</Text>
                <Text style={styles.activityTime}>2 hours ago</Text>
              </View>
            </View>
            <View style={styles.activityItem}>
              <View style={[styles.activityIcon, { backgroundColor: "rgba(239, 68, 68, 0.1)" }]}>
                <Ionicons name="alert-circle" size={16} color="#ef4444" />
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityText}>Safety alert: Missing helmet</Text>
                <Text style={styles.activityTime}>4 hours ago</Text>
              </View>
            </View>
            <View style={styles.activityItem}>
              <View style={[styles.activityIcon, { backgroundColor: "rgba(16, 185, 129, 0.1)" }]}>
                <Ionicons name="person-add" size={16} color="#10b981" />
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityText}>New team member added</Text>
                <Text style={styles.activityTime}>Yesterday</Text>
              </View>
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
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#6b7280",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 35,
    paddingBottom: 10,
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
  statsContainer: {
    padding: 20,
    paddingBottom: 10,
  },
  section: {
    padding: 20,
    paddingTop: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  card: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  cardValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1f2937",
  },
  cardTitle: {
    fontSize: 14,
    color: "#6b7280",
  },
  actionsContainer: {
    gap: 12,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 4,
  },
  actionDescription: {
    fontSize: 14,
    color: "#6b7280",
  },
  activityContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    fontSize: 14,
    color: "#374151",
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 12,
    color: "#9ca3af",
  },
});