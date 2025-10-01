import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
  ActivityIndicator
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import axios from "axios";
import getBaseUrl from "../../baseurl";

type UserProfile = {
  name: string;
  email: string;
  role: string;
  workerId: string;
  phone?: string;
  joinDate: string;
};

type Stats = {
  totalTasks: number;
  completedTasks: number;
  attendanceRate: number;
  safetyScore: number;
};

export default function Profile() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
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
      
      // Generate a worker ID if not provided
      const workerId = res.data.workerId || `WRK-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      
      setProfile({
        ...res.data,
        workerId,
        joinDate: "2024-01-15" // Mock join date
      });
    } catch (err) {
      console.log("Profile load error:", err);
    }
  };

  const loadStats = async () => {
    try {
      // Simulate API calls
      setStats({
        totalTasks: 25,
        completedTasks: 22,
        attendanceRate: 95,
        safetyScore: 92
      });
      setLoading(false);
    } catch (err) {
      console.log("Stats load error:", err);
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            await SecureStore.deleteItemAsync("authToken");
            await SecureStore.deleteItemAsync("role");
            router.replace("/logsign/login");
          }
        }
      ]
    );
  };

  const StatCard = ({ title, value, icon, color }: any) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={styles.statIcon}>{icon}</View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{title}</Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4f46e5" />
          <Text style={styles.loadingText}>Loading Profile...</Text>
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
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1f2937" />
          </TouchableOpacity>
          <Text style={styles.title}>My Profile</Text>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={24} color="#ef4444" />
          </TouchableOpacity>
        </View>

        {/* Profile Card */}
        {profile && (
          <View style={styles.profileCard}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                <Ionicons name="person" size={40} color="#4f46e5" />
              </View>
            </View>
            
            <Text style={styles.profileName}>{profile.name}</Text>
            <Text style={styles.profileRole}>{profile.role}</Text>
            
            <View style={styles.profileDetails}>
              <View style={styles.detailRow}>
                <Ionicons name="id-card-outline" size={16} color="#6b7280" />
                <Text style={styles.detailText}>ID: {profile.workerId}</Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="mail-outline" size={16} color="#6b7280" />
                <Text style={styles.detailText}>{profile.email}</Text>
              </View>
              {profile.phone && (
                <View style={styles.detailRow}>
                  <Ionicons name="call-outline" size={16} color="#6b7280" />
                  <Text style={styles.detailText}>{profile.phone}</Text>
                </View>
              )}
              <View style={styles.detailRow}>
                <Ionicons name="calendar-outline" size={16} color="#6b7280" />
                <Text style={styles.detailText}>
                  Joined: {new Date(profile.joinDate).toLocaleDateString()}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Statistics */}
        {stats && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Performance Statistics</Text>
            <View style={styles.statsGrid}>
              <StatCard
                title="Tasks Completed"
                value={`${stats.completedTasks}/${stats.totalTasks}`}
                icon={<Ionicons name="checkmark-done-outline" size={20} color="#10b981" />}
                color="#10b981"
              />
              <StatCard
                title="Attendance Rate"
                value={`${stats.attendanceRate}%`}
                icon={<Ionicons name="calendar-outline" size={20} color="#3b82f6" />}
                color="#3b82f6"
              />
              <StatCard
                title="Safety Score"
                value={`${stats.safetyScore}%`}
                icon={<Ionicons name="shield-checkmark-outline" size={20} color="#ef4444" />}
                color="#ef4444"
              />
              <StatCard
                title="Work Days"
                value="45"
                icon={<Ionicons name="construct-outline" size={20} color="#f59e0b" />}
                color="#f59e0b"
              />
            </View>
          </View>
        )}

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <View style={styles.activityList}>
            <View style={styles.activityItem}>
              <Ionicons name="checkmark-circle" size={16} color="#10b981" />
              <Text style={styles.activityText}>Completed task: Site cleaning</Text>
              <Text style={styles.activityTime}>2 hours ago</Text>
            </View>
            <View style={styles.activityItem}>
              <Ionicons name="time" size={16} color="#3b82f6" />
              <Text style={styles.activityText}>Checked in at 08:15 AM</Text>
              <Text style={styles.activityTime}>Today</Text>
            </View>
            <View style={styles.activityItem}>
              <Ionicons name="shield-checkmark" size={16} color="#10b981" />
              <Text style={styles.activityText}>Safety check passed</Text>
              <Text style={styles.activityTime}>Yesterday</Text>
            </View>
          </View>
        </View>

        {/* Account Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="pencil-outline" size={20} color="#4f46e5" />
            <Text style={styles.actionText}>Edit Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="notifications-outline" size={20} color="#4f46e5" />
            <Text style={styles.actionText}>Notification Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="lock-closed-outline" size={20} color="#4f46e5" />
            <Text style={styles.actionText}>Change Password</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.logoutAction]} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#ef4444" />
            <Text style={[styles.actionText, styles.logoutText]}>Logout</Text>
          </TouchableOpacity>
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
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    marginTop: 20,
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1f2937",
  },
  logoutButton: {
    padding: 4,
  },
  profileCard: {
    alignItems: "center",
    padding: 24,
    backgroundColor: "#fff",
    marginBottom: 8,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#e5e7eb",
    justifyContent: "center",
    alignItems: "center",
  },
  profileName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 4,
  },
  profileRole: {
    fontSize: 16,
    color: "#6b7280",
    marginBottom: 20,
    textTransform: "capitalize",
  },
  profileDetails: {
    width: "100%",
    gap: 12,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    backgroundColor: "#f9fafb",
    borderRadius: 8,
  },
  detailText: {
    fontSize: 14,
    color: "#374151",
  },
  section: {
    padding: 16,
    backgroundColor: "#fff",
    marginBottom: 8,
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
    gap: 12,
  },
  statCard: {
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
  statIcon: {
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#6b7280",
    textAlign: "center",
  },
  activityList: {
    gap: 12,
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    gap: 12,
  },
  activityText: {
    flex: 1,
    fontSize: 14,
    color: "#374151",
  },
  activityTime: {
    fontSize: 12,
    color: "#9ca3af",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    gap: 12,
  },
  actionText: {
    fontSize: 16,
    color: "#374151",
  },
  logoutAction: {
    borderBottomWidth: 0,
  },
  logoutText: {
    color: "#ef4444",
  },
});