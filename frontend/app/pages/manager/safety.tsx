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

type SafetyCompliance = {
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

type SafetyStats = {
  totalReports: number;
  todayReports: number;
  unresolvedReports: number;
  helmetViolations: number;
  vestViolations: number;
};

type SafetyFilter = "all" | "pending" | "resolved";

type Worker = {
  id: string;
  name: string;
  email: string;
  display: string;
};

export default function SafetyPage() {
  const router = useRouter();
  const [complianceRecords, setComplianceRecords] = useState<SafetyCompliance[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<SafetyCompliance[]>([]);
  const [stats, setStats] = useState<SafetyStats>({
    totalReports: 0,
    todayReports: 0,
    unresolvedReports: 0,
    helmetViolations: 0,
    vestViolations: 0
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<SafetyFilter>("all");
  const [showModal, setShowModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<SafetyCompliance | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [showWorkerDropdown, setShowWorkerDropdown] = useState(false);

  // New report form state
  const [newReport, setNewReport] = useState({
    workerId: "",
    workerName: "",
    helmet: true,
    vest: true,
  });

  useEffect(() => {
    fetchSafetyData();
    fetchWorkers();
  }, []);

  useEffect(() => {
    filterRecords();
  }, [complianceRecords, statusFilter]);

  const fetchSafetyData = async () => {
    try {
      setLoading(true);
      const token = await SecureStore.getItemAsync("authToken");
      
      // Fetch compliance records and stats in parallel
      const [complianceRes, statsRes] = await Promise.all([
        axios.get(`${getBaseUrl()}/api/safety/compliance`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${getBaseUrl()}/api/safety/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      ]);
      
      setComplianceRecords(complianceRes.data);
      setStats(statsRes.data);
      setLoading(false);
      setRefreshing(false);
    } catch (err) {
      console.log("Safety data load error:", err);
      Alert.alert("Error", "Failed to load safety data.");
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchWorkers = async () => {
    try {
      const token = await SecureStore.getItemAsync("authToken");
      const res = await axios.get(`${getBaseUrl()}/api/safety/workers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setWorkers(res.data);
    } catch (err) {
      console.log("Workers load error:", err);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchSafetyData();
  };

  const filterRecords = () => {
    let filtered = [...complianceRecords];
    
    switch (statusFilter) {
      case "pending":
        filtered = filtered.filter(record => !record.resolved);
        break;
      case "resolved":
        filtered = filtered.filter(record => record.resolved);
        break;
      default:
        // "all" - no filtering
        break;
    }
    
    setFilteredRecords(filtered);
  };

  const handleCreateReport = async () => {
    try {
      const token = await SecureStore.getItemAsync("authToken");
      const res = await axios.post(`${getBaseUrl()}/api/safety/compliance`, {
        workerId: newReport.workerId,
        helmet: newReport.helmet,
        vest: newReport.vest,
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      Alert.alert("Success", "Safety compliance report submitted successfully");
      setShowModal(false);
      setNewReport({
        workerId: "",
        workerName: "",
        helmet: true,
        vest: true,
      });
      fetchSafetyData();
    } catch (err: any) {
      console.log("Report creation error:", err);
      Alert.alert("Error", err.response?.data?.error || "Failed to create safety report");
    }
  };

  const handleUpdateStatus = async (recordId: string, resolved: boolean, resolution?: string) => {
    try {
      const token = await SecureStore.getItemAsync("authToken");
      await axios.put(`${getBaseUrl()}/api/safety/compliance/${recordId}`, {
        resolved,
        resolution: resolution || "Issue resolved",
        status: resolved ? "Resolved" : "Pending Review"
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      Alert.alert("Success", `Safety report ${resolved ? "resolved" : "reopened"} successfully`);
      fetchSafetyData();
    } catch (err: any) {
      console.log("Status update error:", err);
      Alert.alert("Error", err.response?.data?.error || "Failed to update safety report");
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

  const renderComplianceItem = ({ item }: { item: SafetyCompliance }) => (
    <TouchableOpacity 
      style={styles.card}
      onPress={() => setSelectedRecord(item)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.workerInfo}>
          <Text style={styles.workerName}>{item.workerName}</Text>
          <Text style={styles.timestamp}>{formatDate(item.timestamp)}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.resolved || false) }]}>
          <Text style={styles.statusText}>{item.resolved ? "Resolved" : "Pending"}</Text>
        </View>
      </View>
      
      <View style={styles.complianceDetails}>
        <View style={styles.complianceRow}>
          <Ionicons 
            name={item.helmet ? "checkmark-circle" : "close-circle"} 
            size={20} 
            color={item.helmet ? "#10b981" : "#ef4444"} 
          />
          <Text style={styles.complianceText}>Helmet: {item.helmet ? "Yes" : "No"}</Text>
        </View>
        
        <View style={styles.complianceRow}>
          <Ionicons 
            name={item.vest ? "checkmark-circle" : "close-circle"} 
            size={20} 
            color={item.vest ? "#10b981" : "#ef4444"} 
          />
          <Text style={styles.complianceText}>Vest: {item.vest ? "Yes" : "No"}</Text>
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
      
      {!item.resolved && (
        <TouchableOpacity 
          style={styles.resolveButton}
          onPress={() => {
            Alert.prompt(
              "Resolve Safety Issue",
              "Enter resolution details:",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Resolve",
                  onPress: (resolution) => handleUpdateStatus(item._id, true, resolution)
                }
              ]
            );
          }}
        >
          <Ionicons name="checkmark-circle-outline" size={16} color="#10b981" />
          <Text style={styles.resolveButtonText}>Mark as Resolved</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4f46e5" />
          <Text style={styles.loadingText}>Loading Safety Data...</Text>
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
        <Text style={styles.title}>Safety Compliance</Text>
        <TouchableOpacity 
          onPress={() => setShowModal(true)} 
          style={styles.addButton}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Statistics */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Ionicons name="shield-outline" size={24} color="#4f46e5" />
          <Text style={styles.statNumber}>{stats.totalReports}</Text>
          <Text style={styles.statLabel}>Total Reports</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="today-outline" size={24} color="#ef4444" />
          <Text style={styles.statNumber}>{stats.todayReports}</Text>
          <Text style={styles.statLabel}>Today</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="warning-outline" size={24} color="#f59e0b" />
          <Text style={styles.statNumber}>{stats.unresolvedReports}</Text>
          <Text style={styles.statLabel}>Unresolved</Text>
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filterContainer}>
        <Text style={styles.filterLabel}>Filter:</Text>
        <TouchableOpacity
          style={[styles.filterButton, statusFilter === "all" && styles.filterButtonActive]}
          onPress={() => setStatusFilter("all")}
        >
          <Text style={[styles.filterButtonText, statusFilter === "all" && styles.filterButtonTextActive]}>
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, statusFilter === "pending" && styles.filterButtonActive]}
          onPress={() => setStatusFilter("pending")}
        >
          <Text style={[styles.filterButtonText, statusFilter === "pending" && styles.filterButtonTextActive]}>
            Pending
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, statusFilter === "resolved" && styles.filterButtonActive]}
          onPress={() => setStatusFilter("resolved")}
        >
          <Text style={[styles.filterButtonText, statusFilter === "resolved" && styles.filterButtonTextActive]}>
            Resolved
          </Text>
        </TouchableOpacity>
      </View>

      {/* Compliance List */}
      <FlatList
        data={filteredRecords}
        keyExtractor={(item) => item._id}
        renderItem={renderComplianceItem}
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
            <Text style={styles.emptyText}>No safety compliance records found</Text>
            <Text style={styles.emptySubtext}>
              {statusFilter === "all" 
                ? "No safety reports have been submitted yet" 
                : `No ${statusFilter} safety reports found`}
            </Text>
          </View>
        }
      />

      {/* Report Detail Modal */}
      {selectedRecord && (
        <Modal
          visible={!!selectedRecord}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setSelectedRecord(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Safety Compliance Details</Text>
                <TouchableOpacity onPress={() => setSelectedRecord(null)}>
                  <Ionicons name="close" size={24} color="#6b7280" />
                </TouchableOpacity>
              </View>
              
              <Text style={styles.detailLabel}>Worker: {selectedRecord.workerName}</Text>
              <Text style={styles.detailLabel}>Date: {formatDate(selectedRecord.timestamp)}</Text>
              
              <View style={styles.detailRow}>
                <Ionicons 
                  name={selectedRecord.helmet ? "checkmark-circle" : "close-circle"} 
                  size={20} 
                  color={selectedRecord.helmet ? "#10b981" : "#ef4444"} 
                />
                <Text style={styles.detailText}>Helmet: {selectedRecord.helmet ? "Compliant" : "Non-compliant"}</Text>
              </View>
              
              <View style={styles.detailRow}>
                <Ionicons 
                  name={selectedRecord.vest ? "checkmark-circle" : "close-circle"} 
                  size={20} 
                  color={selectedRecord.vest ? "#10b981" : "#ef4444"} 
                />
                <Text style={styles.detailText}>Vest: {selectedRecord.vest ? "Compliant" : "Non-compliant"}</Text>
              </View>
              
              {selectedRecord.violations.length > 0 && (
                <View style={styles.violationsSection}>
                  <Text style={styles.sectionTitle}>Violations:</Text>
                  {selectedRecord.violations.map((violation, index) => (
                    <Text key={index} style={styles.violationItem}>• {violation}</Text>
                  ))}
                </View>
              )}
              
              {selectedRecord.resolution && (
                <View style={styles.resolutionSection}>
                  <Text style={styles.sectionTitle}>Resolution:</Text>
                  <Text style={styles.resolutionText}>{selectedRecord.resolution}</Text>
                </View>
              )}
              
              <Text style={[styles.statusText, { color: getStatusColor(selectedRecord.resolved || false) }]}>
                Status: {selectedRecord.resolved ? "Resolved" : "Pending Review"}
              </Text>
            </View>
          </View>
        </Modal>
      )}

      {/* New Report Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Safety Compliance Report</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Select Worker:</Text>
              <TouchableOpacity 
                style={styles.input}
                onPress={() => setShowWorkerDropdown(!showWorkerDropdown)}
              >
                <Text style={newReport.workerName ? styles.inputText : styles.inputPlaceholder}>
                  {newReport.workerName || "Select a worker..."}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#6b7280" />
              </TouchableOpacity>
              
              {showWorkerDropdown && (
                <View style={styles.dropdown}>
                  <ScrollView style={styles.dropdownScroll}>
                    {workers.map(worker => (
                      <Pressable
                        key={worker.id}
                        style={styles.dropdownItem}
                        onPress={() => {
                          setNewReport({
                            ...newReport,
                            workerId: worker.id,
                            workerName: worker.display,
                          });
                          setShowWorkerDropdown(false);
                        }}
                      >
                        <Text style={styles.dropdownItemText}>{worker.display}</Text>
                      </Pressable>
                    ))}
                    {/* Option to enter custom worker */}
                    <Pressable
                      style={styles.dropdownItem}
                      onPress={() => {
                        Alert.prompt(
                          "Enter Worker Name",
                          "Type the worker's name:",
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "OK",
                              onPress: (name) => {
                                if (name) {
                                  setNewReport({
                                    ...newReport,
                                    workerId: name,
                                    workerName: name,
                                  });
                                }
                              }
                            }
                          ]
                        );
                        setShowWorkerDropdown(false);
                      }}
                    >
                      <Text style={[styles.dropdownItemText, { color: "#4f46e5" }]}>
                        + Enter custom worker name
                      </Text>
                    </Pressable>
                  </ScrollView>
                </View>
              )}
            </View>
            
            <View style={styles.toggleContainer}>
              <Text style={styles.toggleLabel}>Helmet:</Text>
              <TouchableOpacity
                style={[styles.toggleButton, newReport.helmet && styles.toggleButtonActive]}
                onPress={() => setNewReport({...newReport, helmet: !newReport.helmet})}
              >
                <Text style={styles.toggleButtonText}>{newReport.helmet ? "Yes" : "No"}</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.toggleContainer}>
              <Text style={styles.toggleLabel}>Safety Vest:</Text>
              <TouchableOpacity
                style={[styles.toggleButton, newReport.vest && styles.toggleButtonActive]}
                onPress={() => setNewReport({...newReport, vest: !newReport.vest})}
              >
                <Text style={styles.toggleButtonText}>{newReport.vest ? "Yes" : "No"}</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.createButton]}
                onPress={handleCreateReport}
                disabled={!newReport.workerId}
              >
                <Text style={styles.createButtonText}>Submit Report</Text>
              </TouchableOpacity>
            </View>
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
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 16,
    backgroundColor: "#fff",
    marginBottom: 8,
  },
  statItem: {
    alignItems: "center",
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
  timestamp: {
    fontSize: 12,
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
  resolveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
  },
  resolveButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#15803d",
    marginLeft: 4,
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
  detailLabel: {
    fontSize: 14,
    color: "#374151",
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: "#374151",
    marginLeft: 8,
  },
  violationsSection: {
    marginTop: 12,
    marginBottom: 12,
  },
  resolutionSection: {
    marginTop: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  violationItem: {
    fontSize: 14,
    color: "#ef4444",
    marginBottom: 4,
  },
  resolutionText: {
    fontSize: 14,
    color: "#16a34a",
  },
  statusText: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 8,
  },
  inputGroup: {
    marginBottom: 16,
    position: "relative",
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 8,
  },
  input: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 12,
  },
  inputText: {
    color: "#1f2937",
    fontSize: 16,
  },
  inputPlaceholder: {
    color: "#9ca3af",
    fontSize: 16,
  },
  dropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 200,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    zIndex: 1000,
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  dropdownItemText: {
    fontSize: 14,
    color: "#374151",
  },
  toggleContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  toggleLabel: {
    fontSize: 16,
    color: "#374151",
  },
  toggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
    minWidth: 80,
    alignItems: "center",
  },
  toggleButtonActive: {
    backgroundColor: "#4f46e5",
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
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
});