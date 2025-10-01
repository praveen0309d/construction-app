// pages/supervisor/Alerts.tsx
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

type AlertItem = {
  _id: string;
  type: "safety" | "emergency";
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "critical";
  status: "pending" | "acknowledged" | "in-progress" | "resolved";
  location: string;
  reportedBy: string;
  reportedByName: string;
  timestamp: string;
  assignedTo?: string;
  assignedToName?: string;
  resolution?: string;
  resolved?: boolean;
  resolvedAt?: string;
  originalId?: string;
  originalType?: string;
};

type AlertStats = {
  totalAlerts: number;
  pendingAlerts: number;
  criticalAlerts: number;
  resolvedToday: number;
  safetyAlerts: number;
  emergencyAlerts: number;
  todayAlerts: number;
};

type AlertFilter = "all" | "pending" | "critical" | "resolved";
type AlertTypeFilter = "all" | "safety" | "emergency";

export default function AlertsPage() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [filteredAlerts, setFilteredAlerts] = useState<AlertItem[]>([]);
  const [stats, setStats] = useState<AlertStats>({
    totalAlerts: 0,
    pendingAlerts: 0,
    criticalAlerts: 0,
    resolvedToday: 0,
    safetyAlerts: 0,
    emergencyAlerts: 0,
    todayAlerts: 0
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<AlertFilter>("all");
  const [typeFilter, setTypeFilter] = useState<AlertTypeFilter>("all");
  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [showFiltersModal, setShowFiltersModal] = useState(false);

  useEffect(() => {
    fetchAlertsData();
  }, []);

  useEffect(() => {
    filterAlerts();
  }, [alerts, statusFilter, typeFilter]);

  const fetchAlertsData = async () => {
    try {
      setLoading(true);
      const token = await SecureStore.getItemAsync("authToken");
      
      const [alertsRes, statsRes] = await Promise.all([
        axios.get(`${getBaseUrl()}/api/alerts`, {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            status: statusFilter !== 'all' ? statusFilter : undefined,
            type: typeFilter !== 'all' ? typeFilter : undefined
          }
        }),
        axios.get(`${getBaseUrl()}/api/alerts/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      ]);

      setAlerts(alertsRes.data);
      setStats(statsRes.data);
      setLoading(false);
      setRefreshing(false);
    } catch (err) {
      console.log("Alerts load error:", err);
      Alert.alert("Error", "Failed to load alerts data.");
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAlertsData();
  };

  const filterAlerts = () => {
    let filtered = [...alerts];
    
    // Apply status filter
    switch (statusFilter) {
      case "pending":
        filtered = filtered.filter(alert => alert.status === "pending");
        break;
      case "critical":
        filtered = filtered.filter(alert => alert.priority === "critical");
        break;
      case "resolved":
        filtered = filtered.filter(alert => alert.status === "resolved");
        break;
      default:
        // "all" - no filtering
        break;
    }
    
    // Apply type filter
    if (typeFilter !== "all") {
      filtered = filtered.filter(alert => alert.type === typeFilter);
    }
    
    setFilteredAlerts(filtered);
  };

  const handleAlertAction = async (alert: AlertItem, action: string, resolution?: string) => {
    try {
      const token = await SecureStore.getItemAsync("authToken");
      
      let updateData: any = {};
      
      switch (action) {
        case "acknowledge":
          updateData = { status: "in-progress" };
          break;
        case "resolve":
          updateData = { 
            status: "resolved", 
            resolved: true,
            resolution: resolution || "Resolved by supervisor"
          };
          break;
        case "assign-to-me":
          // Get current user profile to assign to themselves
          const profileRes = await axios.get(`${getBaseUrl()}/api/profile`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          updateData = { 
            assignedTo: profileRes.data.email,
            assignedToName: profileRes.data.name,
            status: "in-progress"
          };
          break;
        default:
          throw new Error("Invalid action");
      }
      
      await axios.put(`${getBaseUrl()}/api/alerts/${alert._id}`, updateData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      Alert.alert("Success", `Alert ${action.replace('-', ' ')} successfully`);
      setShowActionModal(false);
      setSelectedAlert(null);
      fetchAlertsData();
    } catch (err: any) {
      console.log("Alert action error:", err);
      Alert.alert("Error", err.response?.data?.error || `Failed to ${action} alert`);
    }
  };

  const handleBulkAction = async (action: string) => {
    try {
      const token = await SecureStore.getItemAsync("authToken");
      const selectedAlerts = filteredAlerts.filter(alert => alert.status === "pending");
      
      if (selectedAlerts.length === 0) {
        Alert.alert("Info", "No pending alerts selected for bulk action");
        return;
      }
      
      const res = await axios.post(`${getBaseUrl()}/api/alerts/bulk`, {
        alertIds: selectedAlerts.map(alert => alert._id),
        action: action
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      Alert.alert("Success", res.data.message);
      fetchAlertsData();
    } catch (err: any) {
      console.log("Bulk action error:", err);
      Alert.alert("Error", err.response?.data?.error || "Failed to perform bulk action");
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical": return "#dc2626";
      case "high": return "#ef4444";
      case "medium": return "#f59e0b";
      case "low": return "#10b981";
      default: return "#6b7280";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "#ef4444";
      case "acknowledged": return "#f59e0b";
      case "in-progress": return "#3b82f6";
      case "resolved": return "#10b981";
      default: return "#6b7280";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderAlertItem = ({ item }: { item: AlertItem }) => (
    <TouchableOpacity 
      style={styles.alertCard}
      onPress={() => {
        setSelectedAlert(item);
        setShowActionModal(true);
      }}
    >
      <View style={styles.alertHeader}>
        <View style={styles.alertTitleContainer}>
          <View style={styles.typeBadge}>
            <Ionicons 
              name={item.type === "safety" ? "shield-outline" : "warning-outline"} 
              size={14} 
              color="#6b7280" 
            />
            <Text style={styles.typeText}>{item.type.toUpperCase()}</Text>
          </View>
          <Text style={styles.alertTitle}>{item.title}</Text>
        </View>
        <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(item.priority) }]}>
          <Text style={styles.priorityText}>{item.priority.toUpperCase()}</Text>
        </View>
      </View>
      
      <Text style={styles.alertDescription}>{item.description}</Text>
      
      <View style={styles.alertDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="location-outline" size={14} color="#6b7280" />
          <Text style={styles.detailText}>{item.location}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={14} color="#6b7280" />
          <Text style={styles.detailText}>{formatDate(item.timestamp)}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Ionicons name="person-outline" size={14} color="#6b7280" />
          <Text style={styles.detailText}>Reported by: {item.reportedByName}</Text>
        </View>
      </View>
      
      <View style={styles.alertFooter}>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status.replace('-', ' ').toUpperCase()}</Text>
        </View>
        
        {item.assignedToName && (
          <View style={styles.assignedContainer}>
            <Ionicons name="person-circle-outline" size={12} color="#3b82f6" />
            <Text style={styles.assignedText}>{item.assignedToName}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4f46e5" />
          <Text style={styles.loadingText}>Loading Alerts...</Text>
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
        <Text style={styles.title}>Alerts Management</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setShowFiltersModal(true)} style={styles.filterButton}>
            <Ionicons name="filter" size={20} color="#4f46e5" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
            <Ionicons name="refresh" size={20} color="#4f46e5" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Statistics */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsScroll}>
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Ionicons name="warning-outline" size={20} color="#ef4444" />
            <Text style={styles.statNumber}>{stats.totalAlerts}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="alert-circle-outline" size={20} color="#f59e0b" />
            <Text style={styles.statNumber}>{stats.pendingAlerts}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="flash-outline" size={20} color="#dc2626" />
            <Text style={styles.statNumber}>{stats.criticalAlerts}</Text>
            <Text style={styles.statLabel}>Critical</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#10b981" />
            <Text style={styles.statNumber}>{stats.resolvedToday}</Text>
            <Text style={styles.statLabel}>Resolved Today</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="shield-outline" size={20} color="#8b5cf6" />
            <Text style={styles.statNumber}>{stats.safetyAlerts}</Text>
            <Text style={styles.statLabel}>Safety</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="alert-circle-outline" size={20} color="#f97316" />
            <Text style={styles.statNumber}>{stats.emergencyAlerts}</Text>
            <Text style={styles.statLabel}>Emergency</Text>
          </View>
        </View>
      </ScrollView>

      {/* Bulk Actions */}
      <View style={styles.bulkActions}>
        <Text style={styles.bulkTitle}>Bulk Actions:</Text>
        <TouchableOpacity 
          style={styles.bulkButton}
          onPress={() => handleBulkAction("acknowledge")}
        >
          <Ionicons name="checkmark-circle-outline" size={16} color="#3b82f6" />
          <Text style={styles.bulkButtonText}>Acknowledge All</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.bulkButton}
          onPress={() => handleBulkAction("assign-to-me")}
        >
          <Ionicons name="person-add-outline" size={16} color="#8b5cf6" />
          <Text style={styles.bulkButtonText}>Assign to Me</Text>
        </TouchableOpacity>
      </View>

      {/* Alerts List */}
      <FlatList
        data={filteredAlerts}
        keyExtractor={(item) => item._id}
        renderItem={renderAlertItem}
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
            <Ionicons name="checkmark-circle-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyText}>No alerts found</Text>
            <Text style={styles.emptySubtext}>
              {statusFilter === "all" && typeFilter === "all" 
                ? "Great job! No active alerts." 
                : `No ${statusFilter !== "all" ? statusFilter : ""} ${typeFilter !== "all" ? typeFilter : ""} alerts found`.trim()}
            </Text>
          </View>
        }
      />

      {/* Action Modal */}
      <Modal
        visible={showActionModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowActionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Handle Alert</Text>
              <TouchableOpacity onPress={() => setShowActionModal(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            
            {selectedAlert && (
              <ScrollView>
                <View style={styles.alertInfo}>
                  <View style={styles.alertTypeHeader}>
                    <View style={styles.typeBadge}>
                      <Ionicons 
                        name={selectedAlert.type === "safety" ? "shield-outline" : "warning-outline"} 
                        size={16} 
                        color="#6b7280" 
                      />
                      <Text style={styles.typeText}>{selectedAlert.type.toUpperCase()}</Text>
                    </View>
                    <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(selectedAlert.priority) }]}>
                      <Text style={styles.priorityText}>{selectedAlert.priority.toUpperCase()}</Text>
                    </View>
                  </View>
                  
                  <Text style={styles.alertType}>{selectedAlert.title}</Text>
                  <Text style={styles.alertDescriptionModal}>{selectedAlert.description}</Text>
                  
                  <View style={styles.infoGrid}>
                    <View style={styles.infoItem}>
                      <Ionicons name="location-outline" size={16} color="#6b7280" />
                      <Text style={styles.infoLabel}>Location</Text>
                      <Text style={styles.infoText}>{selectedAlert.location}</Text>
                    </View>
                    
                    <View style={styles.infoItem}>
                      <Ionicons name="time-outline" size={16} color="#6b7280" />
                      <Text style={styles.infoLabel}>Reported</Text>
                      <Text style={styles.infoText}>{formatDate(selectedAlert.timestamp)}</Text>
                    </View>
                    
                    <View style={styles.infoItem}>
                      <Ionicons name="person-outline" size={16} color="#6b7280" />
                      <Text style={styles.infoLabel}>Reporter</Text>
                      <Text style={styles.infoText}>{selectedAlert.reportedByName}</Text>
                    </View>
                    
                    <View style={styles.infoItem}>
                      <Ionicons name="stats-chart-outline" size={16} color="#6b7280" />
                      <Text style={styles.infoLabel}>Status</Text>
                      <Text style={[styles.infoText, { color: getStatusColor(selectedAlert.status) }]}>
                        {selectedAlert.status.replace('-', ' ').toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  {selectedAlert.assignedToName && (
                    <View style={styles.assignedSection}>
                      <Ionicons name="person-circle-outline" size={16} color="#3b82f6" />
                      <Text style={styles.assignedText}>Assigned to: {selectedAlert.assignedToName}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.actionButtons}>
                  {selectedAlert.status === "pending" && (
                    <>
                      <TouchableOpacity 
                        style={[styles.actionButton, styles.acknowledgeButton]}
                        onPress={() => handleAlertAction(selectedAlert, "acknowledge")}
                      >
                        <Ionicons name="checkmark-circle-outline" size={20} color="#3b82f6" />
                        <Text style={styles.actionButtonText}>Acknowledge</Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={[styles.actionButton, styles.assignButton]}
                        onPress={() => handleAlertAction(selectedAlert, "assign-to-me")}
                      >
                        <Ionicons name="person-add-outline" size={20} color="#8b5cf6" />
                        <Text style={styles.actionButtonText}>Assign to Me</Text>
                      </TouchableOpacity>
                    </>
                  )}

                  <TouchableOpacity 
                    style={[styles.actionButton, styles.resolveButton]}
                    onPress={() => {
                      Alert.prompt(
                        "Resolve Alert",
                        "Enter resolution details:",
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Resolve",
                            onPress: (resolution) => handleAlertAction(selectedAlert, "resolve", resolution)
                          }
                        ]
                      );
                    }}
                  >
                    <Ionicons name="checkmark-done-outline" size={20} color="#10b981" />
                    <Text style={styles.actionButtonText}>Resolve</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.actionButton, styles.viewDetailsButton]}
                    onPress={() => {
                      setShowActionModal(false);
                      if (selectedAlert.type === "safety") {
                        router.push("/pages/manager/safety");
                      } else {
                        router.push("/pages/manager/emergency");
                      }
                    }}
                  >
                    <Ionicons name="open-outline" size={20} color="#6b7280" />
                    <Text style={styles.actionButtonText}>View Full Details</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Filters Modal */}
      <Modal
        visible={showFiltersModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFiltersModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter Alerts</Text>
              <TouchableOpacity onPress={() => setShowFiltersModal(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Status</Text>
              <View style={styles.filterOptions}>
                {(["all", "pending", "critical", "resolved"] as AlertFilter[]).map(filter => (
                  <TouchableOpacity
                    key={filter}
                    style={[styles.filterOption, statusFilter === filter && styles.filterOptionActive]}
                    onPress={() => setStatusFilter(filter)}
                  >
                    <Text style={[styles.filterOptionText, statusFilter === filter && styles.filterOptionTextActive]}>
                      {filter === "all" ? "All Statuses" : filter.charAt(0).toUpperCase() + filter.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Type</Text>
              <View style={styles.filterOptions}>
                {(["all", "safety", "emergency"] as AlertTypeFilter[]).map(filter => (
                  <TouchableOpacity
                    key={filter}
                    style={[styles.filterOption, typeFilter === filter && styles.filterOptionActive]}
                    onPress={() => setTypeFilter(filter)}
                  >
                    <Text style={[styles.filterOptionText, typeFilter === filter && styles.filterOptionTextActive]}>
                      {filter === "all" ? "All Types" : filter.charAt(0).toUpperCase() + filter.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            <TouchableOpacity 
              style={styles.applyButton}
              onPress={() => {
                setShowFiltersModal(false);
                fetchAlertsData();
              }}
            >
              <Text style={styles.applyButtonText}>Apply Filters</Text>
            </TouchableOpacity>
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
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  filterButton: {
    padding: 4,
  },
  refreshButton: {
    padding: 4,
  },
  statsScroll: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  statsContainer: {
    flexDirection: "row",
    padding: 16,
    gap: 16,
  },
  statItem: {
    alignItems: "center",
    minWidth: 80,
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
  bulkActions: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    gap: 12,
  },
  bulkTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
  },
  bulkButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  bulkButtonText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#374151",
  },
  listContent: {
    padding: 16,
  },
  alertCard: {
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
  alertHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  alertTitleContainer: {
    flex: 1,
    marginRight: 8,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 4,
    gap: 2,
  },
  typeText: {
    fontSize: 10,
    fontWeight: "500",
    color: "#6b7280",
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: "500",
    color: "#fff",
  },
  alertDescription: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 12,
  },
  alertDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  detailText: {
    fontSize: 12,
    color: "#6b7280",
    marginLeft: 4,
  },
  alertFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  assignedContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  assignedText: {
    fontSize: 11,
    color: "#3b82f6",
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
  alertInfo: {
    marginBottom: 20,
  },
  alertTypeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  alertType: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 8,
  },
  alertDescriptionModal: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 16,
    lineHeight: 20,
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
  },
  infoItem: {
    width: "48%",
    backgroundColor: "#f9fafb",
    padding: 12,
    borderRadius: 8,
  },
  infoLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
  },
  assignedSection: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f9ff",
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  actionButtons: {
    gap: 12,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  acknowledgeButton: {
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.3)",
  },
  assignButton: {
    backgroundColor: "rgba(139, 92, 246, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.3)",
  },
  resolveButton: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  viewDetailsButton: {
    backgroundColor: "rgba(107, 114, 128, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(107, 114, 128, 0.3)",
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: "500",
  },
  filterSection: {
    marginBottom: 20,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 12,
  },
  filterOptions: {
    gap: 8,
  },
  filterOption: {
    padding: 16,
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
  },
  filterOptionActive: {
    backgroundColor: "#4f46e5",
  },
  filterOptionText: {
    fontSize: 16,
    color: "#374151",
  },
  filterOptionTextActive: {
    color: "#fff",
    fontWeight: "500",
  },
  applyButton: {
    backgroundColor: "#4f46e5",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  applyButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});