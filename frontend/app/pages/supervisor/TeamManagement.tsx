// pages/supervisor/TeamManagement.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  RefreshControl,
  Modal,
  TextInput,
  Pressable,
  Image
} from "react-native";
import axios from "axios";
import * as SecureStore from "expo-secure-store";
import getBaseUrl from "../../baseurl";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

type TeamMember = {
  _id: string;
  name: string;
  email: string;
  role: string;
  phone: string;
  position: string;
  todayAttendance: string;
  checkInTime: string;
  checkOutTime: string;
  assignedTasks: number;
  completedTasks: number;
  safetyViolations: number;
  status: string;
  lastActive: string;
};

type TeamStats = {
  totalMembers: number;
  activeMembers: number;
  presentToday: number;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  safetyViolations: number;
  completionRate: number;
  attendanceRate: number;
};

type AttendanceStats = {
  date: string;
  present: number;
  absent: number;
  late: number;
  total: number;
  attendanceRate: number;
};

export default function TeamManagementPage() {
  const router = useRouter();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [stats, setStats] = useState<TeamStats>({
    totalMembers: 0,
    activeMembers: 0,
    presentToday: 0,
    totalTasks: 0,
    completedTasks: 0,
    overdueTasks: 0,
    safetyViolations: 0,
    completionRate: 0,
    attendanceRate: 0
  });
  const [attendance, setAttendance] = useState<AttendanceStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);

  useEffect(() => {
    fetchTeamData();
  }, []);

  const fetchTeamData = async () => {
    try {
      setLoading(true);
      const token = await SecureStore.getItemAsync("authToken");
      
      const [membersRes, statsRes, attendanceRes] = await Promise.all([
        axios.get(`${getBaseUrl()}/api/team/members`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${getBaseUrl()}/api/team/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${getBaseUrl()}/api/team/attendance`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      ]);

      setTeamMembers(membersRes.data);
      setStats(statsRes.data);
      setAttendance(attendanceRes.data);
      setLoading(false);
      setRefreshing(false);
    } catch (err) {
      console.log("Team data load error:", err);
      Alert.alert("Error", "Failed to load team data.");
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchTeamData();
  };

  const handleViewMember = async (member: TeamMember) => {
    try {
      const token = await SecureStore.getItemAsync("authToken");
      const res = await axios.get(`${getBaseUrl()}/api/team/members/${member._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      // Navigate to member detail page or show in modal
      setSelectedMember(member);
      setShowMemberModal(true);
    } catch (err) {
      console.log("Member detail error:", err);
      Alert.alert("Error", "Failed to load member details.");
    }
  };

  const getAttendanceColor = (status: string) => {
    switch (status) {
      case "present": return "#10b981";
      case "absent": return "#ef4444";
      case "late": return "#f59e0b";
      default: return "#6b7280";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "#10b981";
      case "inactive": return "#ef4444";
      case "on-leave": return "#f59e0b";
      default: return "#6b7280";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric'
    });
  };

  const renderMemberItem = ({ item }: { item: TeamMember }) => (
    <TouchableOpacity 
      style={styles.memberCard}
      onPress={() => handleViewMember(item)}
    >
      <View style={styles.memberHeader}>
        <View style={styles.memberAvatar}>
          <Ionicons name="person-circle-outline" size={40} color="#6b7280" />
        </View>
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>{item.name}</Text>
          <Text style={styles.memberPosition}>{item.position}</Text>
          <Text style={styles.memberEmail}>{item.email}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
        </View>
      </View>
      
      <View style={styles.memberStats}>
        <View style={styles.statItem}>
          <Ionicons name="checkmark-circle-outline" size={16} color={getAttendanceColor(item.todayAttendance)} />
          <Text style={styles.statText}>{item.todayAttendance.toUpperCase()}</Text>
        </View>
        
        <View style={styles.statItem}>
          <Ionicons name="list-outline" size={16} color="#3b82f6" />
          <Text style={styles.statText}>{item.assignedTasks} tasks</Text>
        </View>
        
        <View style={styles.statItem}>
          <Ionicons name="shield-outline" size={16} color="#ef4444" />
          <Text style={styles.statText}>{item.safetyViolations} violations</Text>
        </View>
      </View>
      
      {(item.checkInTime || item.checkOutTime) && (
        <View style={styles.timeContainer}>
          {item.checkInTime && (
            <View style={styles.timeItem}>
              <Ionicons name="log-in-outline" size={12} color="#10b981" />
              <Text style={styles.timeText}>In: {item.checkInTime}</Text>
            </View>
          )}
          {item.checkOutTime && (
            <View style={styles.timeItem}>
              <Ionicons name="log-out-outline" size={12} color="#ef4444" />
              <Text style={styles.timeText}>Out: {item.checkOutTime}</Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );

  const renderAttendanceItem = ({ item }: { item: AttendanceStats }) => (
    <View style={styles.attendanceCard}>
      <Text style={styles.attendanceDate}>{formatDate(item.date)}</Text>
      <View style={styles.attendanceStats}>
        <View style={styles.attendanceStat}>
          <Ionicons name="checkmark-circle" size={16} color="#10b981" />
          <Text style={styles.attendanceCount}>{item.present}</Text>
          <Text style={styles.attendanceLabel}>Present</Text>
        </View>
        <View style={styles.attendanceStat}>
          <Ionicons name="close-circle" size={16} color="#ef4444" />
          <Text style={styles.attendanceCount}>{item.absent}</Text>
          <Text style={styles.attendanceLabel}>Absent</Text>
        </View>
        <View style={styles.attendanceStat}>
          <Ionicons name="time-outline" size={16} color="#f59e0b" />
          <Text style={styles.attendanceCount}>{item.late}</Text>
          <Text style={styles.attendanceLabel}>Late</Text>
        </View>
      </View>
      <View style={styles.attendanceRate}>
        <Text style={styles.rateText}>{item.attendanceRate.toFixed(1)}%</Text>
        <Text style={styles.rateLabel}>Attendance Rate</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4f46e5" />
          <Text style={styles.loadingText}>Loading Team Data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.title}>Team Management</Text>
        <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color="#4f46e5" />
        </TouchableOpacity>
      </View>

      {/* Statistics Overview */}
      <TouchableOpacity 
        style={styles.statsOverview}
        onPress={() => setShowStatsModal(true)}
      >
        <View style={styles.statOverviewItem}>
          <Ionicons name="people-outline" size={20} color="#4f46e5" />
          <Text style={styles.statOverviewNumber}>{stats.totalMembers}</Text>
          <Text style={styles.statOverviewLabel}>Team Members</Text>
        </View>
        <View style={styles.statOverviewItem}>
          <Ionicons name="checkmark-circle-outline" size={20} color="#10b981" />
          <Text style={styles.statOverviewNumber}>{stats.presentToday}</Text>
          <Text style={styles.statOverviewLabel}>Present Today</Text>
        </View>
        <View style={styles.statOverviewItem}>
          <Ionicons name="alert-circle-outline" size={20} color="#ef4444" />
          <Text style={styles.statOverviewNumber}>{stats.safetyViolations}</Text>
          <Text style={styles.statOverviewLabel}>Safety Issues</Text>
        </View>
      </TouchableOpacity>

      {/* Team Members List */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Team Members ({teamMembers.length})</Text>
        <TouchableOpacity>
          <Ionicons name="filter-outline" size={20} color="#6b7280" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={teamMembers}
        keyExtractor={(item) => item._id}
        renderItem={renderMemberItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={handleRefresh} 
            colors={["#4f46e5"]}
            tintColor="#4f46e5"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyText}>No team members found</Text>
          </View>
        }
      />

      {/* Member Detail Modal */}
      <Modal
        visible={showMemberModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMemberModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Member Details</Text>
              <TouchableOpacity onPress={() => setShowMemberModal(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            
            {selectedMember && (
              <ScrollView>
                <View style={styles.memberDetailHeader}>
                  <Ionicons name="person-circle-outline" size={60} color="#6b7280" />
                  <Text style={styles.memberDetailName}>{selectedMember.name}</Text>
                  <Text style={styles.memberDetailPosition}>{selectedMember.position}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedMember.status) }]}>
                    <Text style={styles.statusText}>{selectedMember.status.toUpperCase()}</Text>
                  </View>
                </View>
                
                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>Contact Information</Text>
                  <View style={styles.detailItem}>
                    <Ionicons name="mail-outline" size={16} color="#6b7280" />
                    <Text style={styles.detailText}>{selectedMember.email}</Text>
                  </View>
                  {selectedMember.phone && (
                    <View style={styles.detailItem}>
                      <Ionicons name="call-outline" size={16} color="#6b7280" />
                      <Text style={styles.detailText}>{selectedMember.phone}</Text>
                    </View>
                  )}
                </View>
                
                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>Today's Status</Text>
                  <View style={styles.detailItem}>
                    <Ionicons name="checkmark-circle-outline" size={16} color={getAttendanceColor(selectedMember.todayAttendance)} />
                    <Text style={styles.detailText}>Attendance: {selectedMember.todayAttendance.toUpperCase()}</Text>
                  </View>
                  {selectedMember.checkInTime && (
                    <View style={styles.detailItem}>
                      <Ionicons name="log-in-outline" size={16} color="#10b981" />
                      <Text style={styles.detailText}>Check-in: {selectedMember.checkInTime}</Text>
                    </View>
                  )}
                  {selectedMember.checkOutTime && (
                    <View style={styles.detailItem}>
                      <Ionicons name="log-out-outline" size={16} color="#ef4444" />
                      <Text style={styles.detailText}>Check-out: {selectedMember.checkOutTime}</Text>
                    </View>
                  )}
                </View>
                
                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>Performance</Text>
                  <View style={styles.performanceStats}>
                    <View style={styles.performanceStat}>
                      <Text style={styles.performanceNumber}>{selectedMember.assignedTasks}</Text>
                      <Text style={styles.performanceLabel}>Assigned Tasks</Text>
                    </View>
                    <View style={styles.performanceStat}>
                      <Text style={styles.performanceNumber}>{selectedMember.completedTasks}</Text>
                      <Text style={styles.performanceLabel}>Completed</Text>
                    </View>
                    <View style={styles.performanceStat}>
                      <Text style={styles.performanceNumber}>{selectedMember.safetyViolations}</Text>
                      <Text style={styles.performanceLabel}>Violations</Text>
                    </View>
                  </View>
                </View>
                
                <TouchableOpacity 
                  style={styles.viewFullProfileButton}
                  onPress={() => {
                    setShowMemberModal(false);
                    router.push(`/pages/supervisor/MemberProfile/${selectedMember._id}`);
                  }}
                >
                  <Text style={styles.viewFullProfileText}>View Full Profile</Text>
                  <Ionicons name="arrow-forward" size={16} color="#4f46e5" />
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Statistics Modal */}
      <Modal
        visible={showStatsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowStatsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.statsModal]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Team Statistics</Text>
              <TouchableOpacity onPress={() => setShowStatsModal(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            
            <ScrollView>
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Ionicons name="people-outline" size={32} color="#4f46e5" />
                  <Text style={styles.statNumber}>{stats.totalMembers}</Text>
                  <Text style={styles.statLabel}>Total Members</Text>
                </View>
                <View style={styles.statCard}>
                  <Ionicons name="checkmark-circle-outline" size={32} color="#10b981" />
                  <Text style={styles.statNumber}>{stats.activeMembers}</Text>
                  <Text style={styles.statLabel}>Active</Text>
                </View>
                <View style={styles.statCard}>
                  <Ionicons name="checkmark-done-outline" size={32} color="#10b981" />
                  <Text style={styles.statNumber}>{stats.presentToday}</Text>
                  <Text style={styles.statLabel}>Present Today</Text>
                </View>
                <View style={styles.statCard}>
                  <Ionicons name="list-outline" size={32} color="#3b82f6" />
                  <Text style={styles.statNumber}>{stats.totalTasks}</Text>
                  <Text style={styles.statLabel}>Total Tasks</Text>
                </View>
                <View style={styles.statCard}>
                  <Ionicons name="checkmark-outline" size={32} color="#10b981" />
                  <Text style={styles.statNumber}>{stats.completedTasks}</Text>
                  <Text style={styles.statLabel}>Completed</Text>
                </View>
                <View style={styles.statCard}>
                  <Ionicons name="alert-circle-outline" size={32} color="#ef4444" />
                  <Text style={styles.statNumber}>{stats.overdueTasks}</Text>
                  <Text style={styles.statLabel}>Overdue</Text>
                </View>
                <View style={styles.statCard}>
                  <Ionicons name="shield-outline" size={32} color="#ef4444" />
                  <Text style={styles.statNumber}>{stats.safetyViolations}</Text>
                  <Text style={styles.statLabel}>Safety Issues</Text>
                </View>
                <View style={styles.statCard}>
                  <Ionicons name="trending-up-outline" size={32} color="#10b981" />
                  <Text style={styles.statNumber}>{stats.completionRate.toFixed(1)}%</Text>
                  <Text style={styles.statLabel}>Completion Rate</Text>
                </View>
                <View style={styles.statCard}>
                  <Ionicons name="calendar-outline" size={32} color="#3b82f6" />
                  <Text style={styles.statNumber}>{stats.attendanceRate.toFixed(1)}%</Text>
                  <Text style={styles.statLabel}>Attendance Rate</Text>
                </View>
              </View>
              
              <View style={styles.attendanceSection}>
                <Text style={styles.sectionTitle}>Attendance History (Last 7 Days)</Text>
                <FlatList
                  data={attendance}
                  keyExtractor={(item) => item.date}
                  renderItem={renderAttendanceItem}
                  scrollEnabled={false}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1f2937",
  },
  refreshButton: {
    padding: 4,
  },
  statsOverview: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 16,
    backgroundColor: "#fff",
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  statOverviewItem: {
    alignItems: "center",
  },
  statOverviewNumber: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1f2937",
    marginTop: 4,
  },
  statOverviewLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
    textAlign: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
  },
  listContent: {
    padding: 16,
  },
  memberCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  memberHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  memberAvatar: {
    marginRight: 12,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 2,
  },
  memberPosition: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 2,
  },
  memberEmail: {
    fontSize: 12,
    color: "#9ca3af",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "500",
    color: "#fff",
  },
  memberStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 12,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: "#6b7280",
  },
  timeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    paddingTop: 12,
  },
  timeItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  timeText: {
    fontSize: 12,
    color: "#6b7280",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "500",
    color: "#6b7280",
    marginTop: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    width: "100%",
    maxHeight: "80%",
  },
  statsModal: {
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1f2937",
  },
  memberDetailHeader: {
    alignItems: "center",
    marginBottom: 20,
  },
  memberDetailName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1f2937",
    marginTop: 8,
    marginBottom: 4,
  },
  memberDetailPosition: {
    fontSize: 16,
    color: "#6b7280",
    marginBottom: 8,
  },
  detailSection: {
    marginBottom: 20,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    marginBottom: 8,
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: "#374151",
  },
  performanceStats: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  performanceStat: {
    alignItems: "center",
  },
  performanceNumber: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1f2937",
  },
  performanceLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  viewFullProfileButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f3f4f6",
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  viewFullProfileText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#4f46e5",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    width: "30%",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    padding: 16,
    borderRadius: 8,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1f2937",
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
    textAlign: "center",
  },
  attendanceSection: {
    marginBottom: 20,
  },
  attendanceCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  attendanceDate: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 12,
  },
  attendanceStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 12,
  },
  attendanceStat: {
    alignItems: "center",
  },
  attendanceCount: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1f2937",
    marginTop: 4,
  },
  attendanceLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  attendanceRate: {
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    paddingTop: 12,
  },
  rateText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#10b981",
  },
  rateLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
});