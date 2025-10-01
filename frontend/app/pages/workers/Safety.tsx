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
  TextInput
} from "react-native";
import axios from "axios";
import * as SecureStore from "expo-secure-store";
import getBaseUrl from "../../baseurl";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

type SafetyCheck = {
  _id: string;
  workerId: string;
  workerName: string;
  helmet: boolean;
  vest: boolean;
  violations: string[];
  timestamp: string;
  status: string;
  resolved?: boolean;
  resolution?: string;
};

type SafetyFilter = "all" | "pending" | "resolved";

export default function SafetyPage() {
  const router = useRouter();
  const [safetyChecks, setSafetyChecks] = useState<SafetyCheck[]>([]);
  const [filteredChecks, setFilteredChecks] = useState<SafetyCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<SafetyFilter>("all");
  const [showModal, setShowModal] = useState(false);
  const [newCheck, setNewCheck] = useState({
    helmet: true,
    vest: true,
    notes: ""
  });

  useEffect(() => {
    fetchSafetyChecks();
  }, []);

  useEffect(() => {
    filterChecks();
  }, [safetyChecks, statusFilter]);

  const fetchSafetyChecks = async () => {
    try {
      setLoading(true);
      const token = await SecureStore.getItemAsync("authToken");
      const res = await axios.get(`${getBaseUrl()}/api/safety/compliance`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Filter to show only current worker's safety checks
      const userRes = await axios.get(`${getBaseUrl()}/api/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const userEmail = userRes.data.email;
      
      const workerChecks = res.data.filter((check: SafetyCheck) => 
        check.workerId === userEmail || check.workerName === userRes.data.name
      );
      
      setSafetyChecks(workerChecks);
      setLoading(false);
      setRefreshing(false);
    } catch (err) {
      console.log("Safety checks load error:", err);
      Alert.alert("Error", "Failed to load safety check data.");
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchSafetyChecks();
  };

  const filterChecks = () => {
    let filtered = [...safetyChecks];
    
    switch (statusFilter) {
      case "pending":
        filtered = filtered.filter(check => !check.resolved);
        break;
      case "resolved":
        filtered = filtered.filter(check => check.resolved);
        break;
      default:
        // "all" - no filtering
        break;
    }
    
    setFilteredChecks(filtered);
  };

  const handleSubmitSafetyCheck = async () => {
    try {
      const token = await SecureStore.getItemAsync("authToken");
      
      // Get current user info
      const userRes = await axios.get(`${getBaseUrl()}/api/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      await axios.post(`${getBaseUrl()}/api/safety/compliance`, {
        workerId: userRes.data.email,
        helmet: newCheck.helmet,
        vest: newCheck.vest,
        notes: newCheck.notes
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      Alert.alert("Success", "Safety check submitted successfully");
      setShowModal(false);
      setNewCheck({
        helmet: true,
        vest: true,
        notes: ""
      });
      fetchSafetyChecks();
    } catch (err: any) {
      console.log("Safety check submission error:", err);
      Alert.alert("Error", err.response?.data?.error || "Failed to submit safety check");
    }
  };

  const getStatusColor = (resolved: boolean) => {
    return resolved ? "#10b981" : "#ef4444";
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderSafetyItem = ({ item }: { item: SafetyCheck }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.checkTitle}>Safety Compliance Check</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.resolved || false) }]}>
          <Text style={styles.statusText}>{item.resolved ? "Resolved" : "Pending"}</Text>
        </View>
      </View>
      
      <Text style={styles.timestamp}>{formatDate(item.timestamp)}</Text>
      
      <View style={styles.complianceDetails}>
        <View style={styles.complianceRow}>
          <Ionicons 
            name={item.helmet ? "checkmark-circle" : "close-circle"} 
            size={20} 
            color={item.helmet ? "#10b981" : "#ef4444"} 
          />
          <Text style={styles.complianceText}>Helmet: {item.helmet ? "Compliant" : "Non-compliant"}</Text>
        </View>
        
        <View style={styles.complianceRow}>
          <Ionicons 
            name={item.vest ? "checkmark-circle" : "close-circle"} 
            size={20} 
            color={item.vest ? "#10b981" : "#ef4444"} 
          />
          <Text style={styles.complianceText}>Vest: {item.vest ? "Compliant" : "Non-compliant"}</Text>
        </View>
        
        {item.violations.length > 0 && (
          <View style={styles.violationsContainer}>
            <Text style={styles.violationsTitle}>Violations:</Text>
            {item.violations.map((violation, index) => (
              <Text key={index} style={styles.violationText}>• {violation}</Text>
            ))}
          </View>
        )}
        
        {item.resolution && (
          <View style={styles.resolutionContainer}>
            <Text style={styles.resolutionTitle}>Resolution:</Text>
            <Text style={styles.resolutionText}>{item.resolution}</Text>
          </View>
        )}
      </View>
    </View>
  );

  const FilterButton = ({ 
    label, 
    value, 
    currentValue, 
    onPress 
  }: { 
    label: string; 
    value: SafetyFilter; 
    currentValue: SafetyFilter; 
    onPress: (value: SafetyFilter) => void; 
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
          <Text style={styles.loadingText}>Loading Safety Checks...</Text>
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
        <Text style={styles.title}>Safety Checks</Text>
        <TouchableOpacity 
          onPress={() => setShowModal(true)} 
          style={styles.addButton}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View style={styles.filterContainer}>
        <Text style={styles.filterLabel}>Filter:</Text>
        <FilterButton 
          label="All Checks" 
          value="all" 
          currentValue={statusFilter} 
          onPress={setStatusFilter} 
        />
        <FilterButton 
          label="Pending" 
          value="pending" 
          currentValue={statusFilter} 
          onPress={setStatusFilter} 
        />
        <FilterButton 
          label="Resolved" 
          value="resolved" 
          currentValue={statusFilter} 
          onPress={setStatusFilter} 
        />
      </View>

      {/* Summary */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNumber}>{safetyChecks.length}</Text>
          <Text style={styles.summaryLabel}>Total Checks</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryNumber, { color: "#ef4444" }]}>
            {safetyChecks.filter(c => !c.resolved).length}
          </Text>
          <Text style={styles.summaryLabel}>Pending</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryNumber, { color: "#10b981" }]}>
            {safetyChecks.filter(c => c.resolved).length}
          </Text>
          <Text style={styles.summaryLabel}>Resolved</Text>
        </View>
      </View>

      {/* Safety Checks List */}
      <FlatList
        data={filteredChecks}
        keyExtractor={(item) => item._id}
        renderItem={renderSafetyItem}
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
            <Ionicons name="shield-checkmark-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyText}>No safety checks found</Text>
            <Text style={styles.emptySubtext}>
              {statusFilter === "all" 
                ? "Submit your first safety check to get started" 
                : `No ${statusFilter} safety checks found`}
            </Text>
          </View>
        }
      />

      {/* New Safety Check Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Safety Check</Text>
            
            <Text style={styles.sectionTitle}>Safety Equipment</Text>
            
            <TouchableOpacity
              style={styles.toggleContainer}
              onPress={() => setNewCheck({...newCheck, helmet: !newCheck.helmet})}
            >
              <View style={styles.toggleLabelContainer}>
                <Ionicons 
                  name="hard-hat" 
                  size={24} 
                  color={newCheck.helmet ? "#10b981" : "#ef4444"} 
                />
                <Text style={styles.toggleLabel}>Safety Helmet</Text>
              </View>
              <View style={[styles.toggleButton, newCheck.helmet && styles.toggleButtonActive]}>
                <Text style={styles.toggleButtonText}>{newCheck.helmet ? "YES" : "NO"}</Text>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.toggleContainer}
              onPress={() => setNewCheck({...newCheck, vest: !newCheck.vest})}
            >
              <View style={styles.toggleLabelContainer}>
                <Ionicons 
                  name="shirt" 
                  size={24} 
                  color={newCheck.vest ? "#10b981" : "#ef4444"} 
                />
                <Text style={styles.toggleLabel}>Safety Vest</Text>
              </View>
              <View style={[styles.toggleButton, newCheck.vest && styles.toggleButtonActive]}>
                <Text style={styles.toggleButtonText}>{newCheck.vest ? "YES" : "NO"}</Text>
              </View>
            </TouchableOpacity>
            
            <Text style={styles.sectionTitle}>Additional Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Add any additional notes or comments..."
              multiline
              numberOfLines={4}
              value={newCheck.notes}
              onChangeText={(text) => setNewCheck({...newCheck, notes: text})}
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.submitButton]}
                onPress={handleSubmitSafetyCheck}
              >
                <Text style={styles.submitButtonText}>Submit Check</Text>
              </TouchableOpacity>
            </View>
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
    marginTop:20,
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1f2937",
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
    marginBottom: 8,
  },
  checkTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    flex: 1,
    marginRight: 8,
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
  timestamp: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 12,
  },
  complianceDetails: {
    marginBottom: 12,
  },
  complianceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  complianceText: {
    fontSize: 14,
    color: "#374151",
    marginLeft: 8,
  },
  violationsContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: "#fef2f2",
    borderRadius: 6,
  },
  violationsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#dc2626",
    marginBottom: 4,
  },
  violationText: {
    fontSize: 13,
    color: "#ef4444",
  },
  resolutionContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: "#f0fdf4",
    borderRadius: 6,
  },
  resolutionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#15803d",
    marginBottom: 4,
  },
  resolutionText: {
    fontSize: 13,
    color: "#16a34a",
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
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginTop: 16,
    marginBottom: 12,
  },
  toggleContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    marginBottom: 12,
  },
  toggleLabelContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  toggleLabel: {
    fontSize: 16,
    color: "#374151",
    marginLeft: 12,
  },
  toggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#f3f4f6",
  },
  toggleButtonActive: {
    backgroundColor: "#10b981",
  },
  toggleButtonText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#374151",
  },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  textArea: {
    height: 100,
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
  submitButton: {
    backgroundColor: "#4f46e5",
  },
  submitButtonText: {
    color: "#fff",
    fontWeight: "500",
  },
});