import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  StatusBar,
  SafeAreaView,
  ActivityIndicator
} from "react-native";

import { RefreshControl } from "react-native";
import * as SecureStore from "expo-secure-store";
import { useRouter } from "expo-router";
import axios from "axios";
import getBaseUrl from "../../baseurl";
import { Ionicons } from "@expo/vector-icons";

// Define types for our data
type DashboardStats = {
  pendingTasks: number;
  todayAttendance: number;
  safetyIssues: number;
  activeEmergencies: number;
};

type UserProfile = {
  name: string;
  email: string;
  role: string;
};

export default function ManagerHome() {
  const router = useRouter();
  const [name, setName] = useState<string>("Manager");
  const [stats, setStats] = useState<DashboardStats>({
    pendingTasks: 0,
    todayAttendance: 0,
    safetyIssues: 0,
    activeEmergencies: 0
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadProfile(), loadStats()]);
    } catch (err) {
      console.log("Data load error:", err);
      Alert.alert("Error", "Failed to load data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const loadProfile = async () => {
    try {
      const token = await SecureStore.getItemAsync("authToken");
      if (!token) return;

      const res = await axios.get(`${getBaseUrl()}/api/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setName(res.data.name);
    } catch (err) {
      console.log("Profile load error:", err);
      throw err;
    }
  };

  const loadStats = async () => {
    try {
      const token = await SecureStore.getItemAsync("authToken");
      if (!token) return;

      const res = await axios.get(`${getBaseUrl()}/api/dashboard/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setStats(res.data);
    } catch (err) {
      console.log("Stats load error:", err);
      throw err;
    }
  };

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

  const DashboardCard = ({ 
    title, 
    icon, 
    count, 
    onPress, 
    color 
  }: { 
    title: string; 
    icon: React.ReactNode; 
    count?: number; 
    onPress: () => void; 
    color: string; 
  }) => (
    <TouchableOpacity 
      style={[styles.card, { borderLeftColor: color }]} 
      onPress={onPress}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.iconContainer, { backgroundColor: color }]}>
          {icon}
        </View>
        {count !== undefined && count > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{count}</Text>
          </View>
        )}
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
      <View style={styles.cardFooter}>
        <Text style={styles.viewText}>View Details</Text>
        <Ionicons name="chevron-forward" size={16} color="#6b7280" />
      </View>
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
      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={handleRefresh} 
            colors={["#4f46e5"]}
            tintColor="#4f46e5"
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.name}>{name},Manager</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>

        {/* Stats Overview */}
        <View style={styles.statsContainer}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: "rgba(79, 70, 229, 0.1)" }]}>
                <Ionicons name="time-outline" size={20} color="#4f46e5" />
              </View>
              <Text style={styles.statNumber}>{stats.todayAttendance}</Text>
              <Text style={styles.statLabel}>Attendance Today</Text>
            </View>
            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: "rgba(239, 68, 68, 0.1)" }]}>
                <Ionicons name="alert-circle-outline" size={20} color="#ef4444" />
              </View>
              <Text style={styles.statNumber}>{stats.pendingTasks}</Text>
              <Text style={styles.statLabel}>Pending Tasks</Text>
            </View>
            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: "rgba(249, 115, 22, 0.1)" }]}>
                <Ionicons name="shield-checkmark-outline" size={20} color="#f97316" />
              </View>
              <Text style={styles.statNumber}>{stats.safetyIssues}</Text>
              <Text style={styles.statLabel}>Safety Issues</Text>
            </View>
            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: "rgba(16, 185, 129, 0.1)" }]}>
                <Ionicons name="warning-outline" size={20} color="#10b981" />
              </View>
              <Text style={styles.statNumber}>{stats.activeEmergencies}</Text>
              <Text style={styles.statLabel}>Active Emergencies</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push("/pages/manager/attendance")}
            >
              <View style={[styles.actionIcon, { backgroundColor: "#4f46e5" }]}>
                <Ionicons name="time-outline" size={24} color="white" />
              </View>
              <Text style={styles.actionText}>Attendance</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push("/pages/manager/tasks")}
            >
              <View style={[styles.actionIcon, { backgroundColor: "#f97316" }]}>
                <Ionicons name="list-outline" size={24} color="white" />
              </View>
              <Text style={styles.actionText}>Tasks</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push("/pages/manager/safety")}
            >
              <View style={[styles.actionIcon, { backgroundColor: "#10b981" }]}>
                <Ionicons name="shield-checkmark-outline" size={24} color="white" />
              </View>
              <Text style={styles.actionText}>Safety</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push("/pages/manager/emergency")}
            >
              <View style={[styles.actionIcon, { backgroundColor: "#ef4444" }]}>
                <Ionicons name="warning-outline" size={24} color="white" />
              </View>
              <Text style={styles.actionText}>Emergency</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Dashboard Modules */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Management Modules</Text>
          
          <DashboardCard
            title="Attendance Tracking"
            icon={<Ionicons name="time-outline" size={24} color="white" />}
            count={stats.todayAttendance}
            onPress={() => router.push("/pages/manager/attendance")}
            color="#4f46e5"
          />
          
          <DashboardCard
            title="Task Management"
            icon={<Ionicons name="list-outline" size={24} color="white" />}
            count={stats.pendingTasks}
            onPress={() => router.push("/pages/manager/tasks")}
            color="#f97316"
          />
          
          <DashboardCard
            title="Safety & Compliance"
            icon={<Ionicons name="shield-checkmark-outline" size={24} color="white" />}
            count={stats.safetyIssues}
            onPress={() => router.push("/pages/manager/safety")}
            color="#10b981"
          />
          
          <DashboardCard
            title="Emergency / Incidents"
            icon={<Ionicons name="warning-outline" size={24} color="white" />}
            count={stats.activeEmergencies}
            onPress={() => router.push("/pages/manager/emergency")}
            color="#ef4444"
          />
<DashboardCard
  title="Chatbot"
  icon={<Ionicons name="chatbox-ellipses-outline" size={24} color="white" />}
  count={stats.totalChats} // you can replace this with the relevant chat count
  onPress={() => router.push("/pages/chat")}
  color="#10b981" // green to match chat/bot theme
/>

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
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
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
  statItem: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: "#6b7280",
  },
  actionsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  actionButton: {
    alignItems: "center",
    width: "23%",
  },
  actionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  actionText: {
    fontSize: 12,
    textAlign: "center",
    color: "#4b5563",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  countBadge: {
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  countText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#4b5563",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    paddingTop: 12,
  },
  viewText: {
    fontSize: 14,
    color: "#6b7280",
  },
});

// Add RefreshControl import at the top