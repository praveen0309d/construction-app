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
  Pressable
} from "react-native";
import axios from "axios";
import * as SecureStore from "expo-secure-store";
import getBaseUrl from "../../baseurl";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

type Worker = {
  _id: string;
  name: string;
  email: string;
  phone: string;
  position: string;
  team: string;
  status: "active" | "inactive";
  created_at: string;
  days_since_join: number;
  supervisor: string;
  shift: string;
  hourly_rate: number;
  emergency_contact: {
    name: string;
    phone: string;
    relationship: string;
  };
  skills: string[];
  certifications: string[];
  onboarding_status: "pending" | "in-progress" | "completed";
  training_completed: boolean;
  safety_training_date: string;
  notes: string;
};

type WorkerStats = {
  totalNewWorkers: number;
  activeWorkers: number;
  inactiveWorkers: number;
  teamDistribution: { _id: string; count: number }[];
  onboardingStatus: { _id: string; count: number }[];
  weeklyTrends: {
    week: string;
    startDate: string;
    endDate: string;
    count: number;
  }[];
  timeRange: {
    startDate: string;
    days: number;
  };
};

type OnboardingTask = {
  id: number;
  task: string;
  description: string;
  required: boolean;
  department: string;
};

type WorkerFilter = "all" | "active" | "inactive";

export default function NewWorkersPage() {
  const router = useRouter();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [filteredWorkers, setFilteredWorkers] = useState<Worker[]>([]);
  const [stats, setStats] = useState<WorkerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<WorkerFilter>("all");
  const [showModal, setShowModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [onboardingChecklist, setOnboardingChecklist] = useState<OnboardingTask[]>([]);

  // New worker form state
  const [newWorker, setNewWorker] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    position: "Construction Worker",
    team: "General",
    status: "active" as "active" | "inactive",
    supervisor: "",
    shift: "Day" as "Day" | "Night" | "Swing",
    hourly_rate: "20",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    emergency_contact_relationship: "",
    skills: "",
    certifications: "",
    notes: ""
  });

  useEffect(() => {
    fetchNewWorkers();
    fetchOnboardingChecklist();
  }, []);

  useEffect(() => {
    filterWorkers();
  }, [workers, statusFilter]);

  const fetchNewWorkers = async () => {
    try {
      setLoading(true);
      const token = await SecureStore.getItemAsync("authToken");
      const res = await axios.get(`${getBaseUrl()}/api/new-workers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setWorkers(res.data);
      setLoading(false);
      setRefreshing(false);
    } catch (err) {
      console.log("New workers load error:", err);
      Alert.alert("Error", "Failed to load new workers data.");
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchWorkerStats = async () => {
    try {
      const token = await SecureStore.getItemAsync("authToken");
      const res = await axios.get(`${getBaseUrl()}/api/new-workers/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStats(res.data);
      setShowStatsModal(true);
    } catch (err) {
      console.log("Worker stats load error:", err);
      Alert.alert("Error", "Failed to load worker statistics.");
    }
  };

  const fetchOnboardingChecklist = async () => {
    try {
      const token = await SecureStore.getItemAsync("authToken");
      const res = await axios.get(`${getBaseUrl()}/api/new-workers/onboarding-checklist`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setOnboardingChecklist(res.data);
    } catch (err) {
      console.log("Onboarding checklist load error:", err);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchNewWorkers();
  };

  const filterWorkers = () => {
    if (statusFilter === "all") {
      setFilteredWorkers(workers);
    } else {
      setFilteredWorkers(workers.filter(worker => worker.status === statusFilter));
    }
  };

  const handleCreateWorker = async () => {
    try {
      const token = await SecureStore.getItemAsync("authToken");
      await axios.post(`${getBaseUrl()}/api/new-workers`, {
        name: newWorker.name,
        email: newWorker.email,
        password: newWorker.password,
        phone: newWorker.phone,
        position: newWorker.position,
        team: newWorker.team,
        status: newWorker.status,
        supervisor: newWorker.supervisor,
        shift: newWorker.shift,
        hourly_rate: parseFloat(newWorker.hourly_rate),
        emergency_contact: {
          name: newWorker.emergency_contact_name,
          phone: newWorker.emergency_contact_phone,
          relationship: newWorker.emergency_contact_relationship
        },
        skills: newWorker.skills.split(',').map(skill => skill.trim()).filter(skill => skill),
        certifications: newWorker.certifications.split(',').map(cert => cert.trim()).filter(cert => cert),
        notes: newWorker.notes
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      Alert.alert("Success", "New worker created successfully");
      setShowModal(false);
      setNewWorker({
        name: "",
        email: "",
        password: "",
        phone: "",
        position: "Construction Worker",
        team: "General",
        status: "active",
        supervisor: "",
        shift: "Day",
        hourly_rate: "20",
        emergency_contact_name: "",
        emergency_contact_phone: "",
        emergency_contact_relationship: "",
        skills: "",
        certifications: "",
        notes: ""
      });
      fetchNewWorkers();
    } catch (err: any) {
      console.log("Worker creation error:", err);
      Alert.alert("Error", err.response?.data?.error || "Failed to create new worker");
    }
  };

  const handleUpdateWorkerStatus = async (workerId: string, newStatus: "active" | "inactive") => {
    try {
      const token = await SecureStore.getItemAsync("authToken");
      await axios.put(`${getBaseUrl()}/api/new-workers/${workerId}`, {
        status: newStatus
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      Alert.alert("Success", `Worker status updated to ${newStatus}`);
      fetchNewWorkers();
    } catch (err: any) {
      console.log("Status update error:", err);
      Alert.alert("Error", err.response?.data?.error || "Failed to update worker status");
    }
  };

  const handleDeleteWorker = async (workerId: string) => {
    Alert.alert(
      "Confirm Delete",
      "Are you sure you want to delete this worker?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const token = await SecureStore.getItemAsync("authToken");
              await axios.delete(`${getBaseUrl()}/api/new-workers/${workerId}`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              
              Alert.alert("Success", "Worker deleted successfully");
              fetchNewWorkers();
            } catch (err: any) {
              console.log("Worker deletion error:", err);
              Alert.alert("Error", err.response?.data?.error || "Failed to delete worker");
            }
          }
        }
      ]
    );
  };

  const getStatusColor = (status: string) => {
    return status === "active" ? "#10b981" : "#ef4444";
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const renderWorkerItem = ({ item }: { item: Worker }) => (
    <TouchableOpacity 
      style={styles.card}
      onPress={() => setSelectedWorker(item)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.workerInfo}>
          <Text style={styles.workerName}>{item.name}</Text>
          <Text style={styles.workerEmail}>{item.email}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
        </View>
      </View>
      
      <View style={styles.workerDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="briefcase-outline" size={16} color="#6b7280" />
          <Text style={styles.detailText}>{item.position}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Ionicons name="people-outline" size={16} color="#6b7280" />
          <Text style={styles.detailText}>Team: {item.team}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={16} color="#6b7280" />
          <Text style={styles.detailText}>
            Joined: {formatDate(item.created_at)} ({item.days_since_join} days ago)
          </Text>
        </View>
        
        <View style={styles.detailRow}>
          <Ionicons name="person-outline" size={16} color="#6b7280" />
          <Text style={styles.detailText}>Supervisor: {item.supervisor || "Not assigned"}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={16} color="#6b7280" />
          <Text style={styles.detailText}>Shift: {item.shift}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Ionicons name="cash-outline" size={16} color="#6b7280" />
          <Text style={styles.detailText}>Rate: ${item.hourly_rate}/hr</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Ionicons name="checkmark-circle-outline" size={16} color="#6b7280" />
          <Text style={styles.detailText}>
            Onboarding: {item.onboarding_status}
          </Text>
        </View>
      </View>
      
      <View style={styles.cardActions}>
        <TouchableOpacity 
          style={[styles.actionButton, item.status === "active" ? styles.deactivateButton : styles.activateButton]}
          onPress={() => handleUpdateWorkerStatus(item._id, item.status === "active" ? "inactive" : "active")}
        >
          <Ionicons 
            name={item.status === "active" ? "pause-circle-outline" : "play-circle-outline"} 
            size={16} 
            color={item.status === "active" ? "#ef4444" : "#10b981"} 
          />
          <Text style={[styles.actionText, { color: item.status === "active" ? "#ef4444" : "#10b981" }]}>
            {item.status === "active" ? "Deactivate" : "Activate"}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDeleteWorker(item._id)}
        >
          <Ionicons name="trash-outline" size={16} color="#ef4444" />
          <Text style={[styles.actionText, { color: "#ef4444" }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const FilterButton = ({ 
    label, 
    value, 
    currentValue, 
    onPress 
  }: { 
    label: string; 
    value: WorkerFilter; 
    currentValue: WorkerFilter; 
    onPress: (value: WorkerFilter) => void; 
  }) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        currentValue === value && styles.filterButtonActive
      ]}
      onPress={() => onPress(value)}
    >
      <Text
        style={[
          styles.filterButtonText,
          currentValue === value && styles.filterButtonTextActive
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4f46e5" />
          <Text style={styles.loadingText}>Loading New Workers...</Text>
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
        <Text style={styles.title}>New Workers Management</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            onPress={fetchWorkerStats} 
            style={styles.statsButton}
          >
            <Ionicons name="stats-chart-outline" size={20} color="#4f46e5" />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setShowModal(true)} 
            style={styles.addButton}
          >
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filterContainer}>
        <Text style={styles.filterLabel}>Filter:</Text>
        <FilterButton 
          label="All Workers" 
          value="all" 
          currentValue={statusFilter} 
          onPress={setStatusFilter} 
        />
        <FilterButton 
          label="Active" 
          value="active" 
          currentValue={statusFilter} 
          onPress={setStatusFilter} 
        />
        <FilterButton 
          label="Inactive" 
          value="inactive" 
          currentValue={statusFilter} 
          onPress={setStatusFilter} 
        />
      </View>

      {/* Summary */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNumber}>{workers.length}</Text>
          <Text style={styles.summaryLabel}>Total</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryNumber, { color: "#10b981" }]}>
            {workers.filter(w => w.status === "active").length}
          </Text>
          <Text style={styles.summaryLabel}>Active</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryNumber, { color: "#ef4444" }]}>
            {workers.filter(w => w.status === "inactive").length}
          </Text>
          <Text style={styles.summaryLabel}>Inactive</Text>
        </View>
        <View style={styles.summaryItem}>
          <TouchableOpacity onPress={() => setShowOnboardingModal(true)}>
            <Ionicons name="list-circle-outline" size={24} color="#4f46e5" />
            <Text style={styles.summaryLabel}>Checklist</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Workers List */}
      <FlatList
        data={filteredWorkers}
        keyExtractor={(item) => item._id}
        renderItem={renderWorkerItem}
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
            <Text style={styles.emptyText}>No new workers found</Text>
            <Text style={styles.emptySubtext}>
              {statusFilter === "all" 
                ? "Add your first new worker to get started" 
                : `No ${statusFilter} workers found`}
            </Text>
          </View>
        }
      />

      {/* Add Worker Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Worker</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              value={newWorker.name}
              onChangeText={(text) => setNewWorker({...newWorker, name: text})}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Email Address"
              value={newWorker.email}
              onChangeText={(text) => setNewWorker({...newWorker, email: text})}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            
            <TextInput
              style={styles.input}
              placeholder="Password"
              value={newWorker.password}
              onChangeText={(text) => setNewWorker({...newWorker, password: text})}
              secureTextEntry
            />
            
            <TextInput
              style={styles.input}
              placeholder="Phone Number"
              value={newWorker.phone}
              onChangeText={(text) => setNewWorker({...newWorker, phone: text})}
              keyboardType="phone-pad"
            />
            
            <TextInput
              style={styles.input}
              placeholder="Position"
              value={newWorker.position}
              onChangeText={(text) => setNewWorker({...newWorker, position: text})}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Team"
              value={newWorker.team}
              onChangeText={(text) => setNewWorker({...newWorker, team: text})}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Supervisor"
              value={newWorker.supervisor}
              onChangeText={(text) => setNewWorker({...newWorker, supervisor: text})}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Hourly Rate"
              value={newWorker.hourly_rate}
              onChangeText={(text) => setNewWorker({...newWorker, hourly_rate: text})}
              keyboardType="numeric"
            />
            
            <Text style={styles.sectionTitle}>Emergency Contact</Text>
            <TextInput
              style={styles.input}
              placeholder="Emergency Contact Name"
              value={newWorker.emergency_contact_name}
              onChangeText={(text) => setNewWorker({...newWorker, emergency_contact_name: text})}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Emergency Contact Phone"
              value={newWorker.emergency_contact_phone}
              onChangeText={(text) => setNewWorker({...newWorker, emergency_contact_phone: text})}
              keyboardType="phone-pad"
            />
            
            <TextInput
              style={styles.input}
              placeholder="Relationship"
              value={newWorker.emergency_contact_relationship}
              onChangeText={(text) => setNewWorker({...newWorker, emergency_contact_relationship: text})}
            />
            
            <Text style={styles.sectionTitle}>Skills & Certifications</Text>
            <TextInput
              style={styles.input}
              placeholder="Skills (comma-separated)"
              value={newWorker.skills}
              onChangeText={(text) => setNewWorker({...newWorker, skills: text})}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Certifications (comma-separated)"
              value={newWorker.certifications}
              onChangeText={(text) => setNewWorker({...newWorker, certifications: text})}
            />
            
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Notes"
              multiline
              numberOfLines={3}
              value={newWorker.notes}
              onChangeText={(text) => setNewWorker({...newWorker, notes: text})}
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.createButton]}
                onPress={handleCreateWorker}
                disabled={!newWorker.name || !newWorker.email || !newWorker.password}
              >
                <Text style={styles.createButtonText}>Add Worker</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Statistics Modal */}
      {stats && (
        <Modal
          visible={showStatsModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowStatsModal(false)}
        >
          <View style={styles.modalOverlay}>
            <ScrollView style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>New Workers Statistics</Text>
                <TouchableOpacity onPress={() => setShowStatsModal(false)}>
                  <Ionicons name="close" size={24} color="#6b7280" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Text style={styles.statNumber}>{stats.totalNewWorkers}</Text>
                  <Text style={styles.statLabel}>Total New Workers</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={[styles.statNumber, { color: "#10b981" }]}>{stats.activeWorkers}</Text>
                  <Text style={styles.statLabel}>Active</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={[styles.statNumber, { color: "#ef4444" }]}>{stats.inactiveWorkers}</Text>
                  <Text style={styles.statLabel}>Inactive</Text>
                </View>
              </View>
              
              <Text style={styles.sectionTitle}>Team Distribution</Text>
              {stats.teamDistribution.map((team, index) => (
                <View key={index} style={styles.distributionItem}>
                  <Text style={styles.distributionLabel}>{team._id || "Unassigned"}</Text>
                  <Text style={styles.distributionCount}>{team.count} workers</Text>
                </View>
              ))}
              
              <Text style={styles.sectionTitle}>Onboarding Status</Text>
              {stats.onboardingStatus.map((status, index) => (
                <View key={index} style={styles.distributionItem}>
                  <Text style={styles.distributionLabel}>{status._id || "Not set"}</Text>
                  <Text style={styles.distributionCount}>{status.count} workers</Text>
                </View>
              ))}
              
              <Text style={styles.sectionTitle}>Weekly Trends</Text>
              {stats.weeklyTrends.map((week, index) => (
                <View key={index} style={styles.trendItem}>
                  <Text style={styles.trendWeek}>{week.week}</Text>
                  <Text style={styles.trendCount}>{week.count} new workers</Text>
                  <Text style={styles.trendDate}>
                    {formatDate(week.startDate)} - {formatDate(week.endDate)}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </Modal>
      )}

      {/* Onboarding Checklist Modal */}
      <Modal
        visible={showOnboardingModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowOnboardingModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Onboarding Checklist</Text>
              <TouchableOpacity onPress={() => setShowOnboardingModal(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            
            {onboardingChecklist.map((task) => (
              <View key={task.id} style={styles.checklistItem}>
                <View style={styles.checklistHeader}>
                  <Text style={styles.checklistTask}>{task.task}</Text>
                  {task.required && (
                    <View style={styles.requiredBadge}>
                      <Text style={styles.requiredText}>Required</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.checklistDescription}>{task.description}</Text>
                <Text style={styles.checklistDepartment}>Department: {task.department}</Text>
              </View>
            ))}
          </ScrollView>
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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statsButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
  },
  addButton: {
    backgroundColor: "#4f46e5",
    padding: 8,
    borderRadius: 8,
  },
  filterContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginRight: 12,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#f3f4f6",
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: "#4f46e5",
  },
  filterButtonText: {
    fontSize: 14,
    color: "#6b7280",
  },
  filterButtonTextActive: {
    color: "#fff",
    fontWeight: "500",
  },
  summaryContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 16,
    backgroundColor: "#fff",
    marginBottom: 8,
  },
  summaryItem: {
    alignItems: "center",
  },
  summaryNumber: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1f2937",
  },
  summaryLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
  },
  listContent: {
    padding: 16,
  },
  card: {
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
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  workerInfo: {
    flex: 1,
  },
  workerName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 4,
  },
  workerEmail: {
    fontSize: 14,
    color: "#6b7280",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#fff",
  },
  workerDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  detailText: {
    fontSize: 14,
    color: "#6b7280",
    marginLeft: 6,
  },
  cardActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    paddingTop: 12,
    gap: 8,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  activateButton: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
  },
  deactivateButton: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
  },
  deleteButton: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
  },
  actionText: {
    fontSize: 12,
    fontWeight: "500",
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
  emptySubtext: {
    fontSize: 14,
    color: "#9ca3af",
    marginTop: 8,
    textAlign: "center",
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: "top",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 16,
    gap: 8,
  },
  modalButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  cancelButton: {
    backgroundColor: "#f3f4f6",
  },
  cancelButtonText: {
    color: "#374151",
    fontWeight: "500",
  },
  createButton: {
    backgroundColor: "#4f46e5",
  },
  createButtonText: {
    color: "#fff",
    fontWeight: "500",
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  statCard: {
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    padding: 16,
    flex: 1,
    marginHorizontal: 4,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1f2937",
  },
  statLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
  },
  distributionItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  distributionLabel: {
    fontSize: 14,
    color: "#374151",
  },
  distributionCount: {
    fontSize: 14,
    fontWeight: "500",
    color: "#4f46e5",
  },
  trendItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  trendWeek: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  trendCount: {
    fontSize: 14,
    color: "#4f46e5",
    marginTop: 2,
  },
  trendDate: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  checklistItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  checklistHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  checklistTask: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    flex: 1,
  },
  requiredBadge: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  requiredText: {
    fontSize: 12,
    color: "#fff",
    fontWeight: "500",
  },
  checklistDescription: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 4,
  },
  checklistDepartment: {
    fontSize: 12,
    color: "#9ca3af",
    fontStyle: "italic",
  },
});