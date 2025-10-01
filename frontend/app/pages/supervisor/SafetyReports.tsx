// pages/supervisor/SafetyReports.tsx
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

type SafetyReport = {
  _id: string;
  workerId: string;
  workerName: string;
  workerDetails: {
    position: string;
    team: string;
  };
  helmet: boolean;
  vest: boolean;
  violations: string[];
  timestamp: string;
  reportedBy: string;
  reportedByName: string;
  reportedByRole: string;
  status: string;
  resolved: boolean;
  resolution: string;
  resolvedAt: string;
  location: string;
  description: string;
  severity: string;
};

type SafetyStats = {
  totalReports: number;
  recentReports: number;
  unresolvedReports: number;
  resolvedReports: number;
  violationTypes: {
    helmet: number;
    vest: number;
    both: number;
  };
  statusBreakdown: {
    pending: number;
    inProgress: number;
    resolved: number;
  };
  severityBreakdown: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  weeklyTrends: Array<{
    week: string;
    startDate: string;
    endDate: string;
    count: number;
  }>;
  resolutionRate: number;
};

type SafetyFilter = "all" | "unresolved" | "resolved";
type SeverityFilter = "all" | "low" | "medium" | "high" | "critical";

export default function SafetyReportsPage() {
  const router = useRouter();
  const [reports, setReports] = useState<SafetyReport[]>([]);
  const [filteredReports, setFilteredReports] = useState<SafetyReport[]>([]);
  const [stats, setStats] = useState<SafetyStats>({
    totalReports: 0,
    recentReports: 0,
    unresolvedReports: 0,
    resolvedReports: 0,
    violationTypes: { helmet: 0, vest: 0, both: 0 },
    statusBreakdown: { pending: 0, inProgress: 0, resolved: 0 },
    severityBreakdown: { low: 0, medium: 0, high: 0, critical: 0 },
    weeklyTrends: [],
    resolutionRate: 0
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<SafetyFilter>("all");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [selectedReport, setSelectedReport] = useState<SafetyReport | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);

  useEffect(() => {
    fetchSafetyData();
  }, []);

  useEffect(() => {
    filterReports();
  }, [reports, statusFilter, severityFilter]);

  const fetchSafetyData = async () => {
    try {
      setLoading(true);
      const token = await SecureStore.getItemAsync("authToken");
      
      const [reportsRes, statsRes] = await Promise.all([
        axios.get(`${getBaseUrl()}/api/safety-reports`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${getBaseUrl()}/api/safety-reports/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      ]);

      setReports(reportsRes.data);
      setStats(statsRes.data);
      setLoading(false);
      setRefreshing(false);
    } catch (err) {
      console.log("Safety data load error:", err);
      Alert.alert("Error", "Failed to load safety reports data.");
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchSafetyData();
  };

  const filterReports = () => {
    let filtered = [...reports];
    
    // Apply status filter
    if (statusFilter === "unresolved") {
      filtered = filtered.filter(report => !report.resolved);
    } else if (statusFilter === "resolved") {
      filtered = filtered.filter(report => report.resolved);
    }
    
    // Apply severity filter
    if (severityFilter !== "all") {
      filtered = filtered.filter(report => report.severity === severityFilter);
    }
    
    setFilteredReports(filtered);
  };

  const handleUpdateReport = async (reportId: string, updates: any) => {
    try {
      const token = await SecureStore.getItemAsync("authToken");
      const res = await axios.put(`${getBaseUrl()}/api/safety-reports/${reportId}`, updates, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      Alert.alert("Success", "Safety report updated successfully");
      setShowDetailModal(false);
      setSelectedReport(null);
      fetchSafetyData();
    } catch (err: any) {
      console.log("Report update error:", err);
      Alert.alert("Error", err.response?.data?.error || "Failed to update safety report");
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "#dc2626";
      case "high": return "#ef4444";
      case "medium": return "#f59e0b";
      case "low": return "#10b981";
      default: return "#6b7280";
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
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderReportItem = ({ item }: { item: SafetyReport }) => (
    <TouchableOpacity 
      style={styles.reportCard}
      onPress={() => {
        setSelectedReport(item);
        setShowDetailModal(true);
      }}
    >
      <View style={styles.reportHeader}>
        <View style={styles.reportInfo}>
          <Text style={styles.workerName}>{item.workerName}</Text>
          <Text style={styles.workerDetails}>
            {item.workerDetails.position} • {item.workerDetails.team}
          </Text>
          <Text style={styles.violations}>
            {item.violations.join(", ")}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.resolved) }]}>
          <Text style={styles.statusText}>{item.resolved ? "RESOLVED" : "PENDING"}</Text>
        </View>
      </View>
      
      <View style={styles.reportDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={14} color="#6b7280" />
          <Text style={styles.detailText}>{formatDate(item.timestamp)}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Ionicons name="location-outline" size={14} color="#6b7280" />
          <Text style={styles.detailText}>{item.location}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Ionicons name="alert-circle-outline" size={14} color="#6b7280" />
          <Text style={[styles.detailText, { color: getSeverityColor(item.severity) }]}>
            Severity: {item.severity.toUpperCase()}
          </Text>
        </View>
        
        <View style={styles.detailRow}>
          <Ionicons name="person-outline" size={14} color="#6b7280" />
          <Text style={styles.detailText}>
            Reported by: {item.reportedByName} ({item.reportedByRole})
          </Text>
        </View>
      </View>
      
      {item.resolution && (
        <View style={styles.resolutionContainer}>
          <Text style={styles.resolutionText}>{item.resolution}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4f46e5" />
          <Text style={styles.loadingText}>Loading Safety Reports...</Text>
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
        <Text style={styles.title}>Safety Compliance Reports</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setShowStatsModal(true)} style={styles.statsButton}>
            <Ionicons name="stats-chart" size={20} color="#4f46e5" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
            <Ionicons name="refresh" size={20} color="#4f46e5" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Statistics Overview */}
      <TouchableOpacity 
        style={styles.statsOverview}
        onPress={() => setShowStatsModal(true)}
      >
        <View style={styles.statOverviewItem}>
          <Ionicons name="document-text-outline" size={20} color="#4f46e5" />
          <Text style={styles.statOverviewNumber}>{stats.totalReports}</Text>
          <Text style={styles.statOverviewLabel}>Total Reports</Text>
        </View>
        <View style={styles.statOverviewItem}>
          <Ionicons name="alert-circle-outline" size={20} color="#ef4444" />
          <Text style={styles.statOverviewNumber}>{stats.unresolvedReports}</Text>
          <Text style={styles.statOverviewLabel}>Unresolved</Text>
        </View>
        <View style={styles.statOverviewItem}>
          <Ionicons name="checkmark-circle-outline" size={20} color="#10b981" />
          <Text style={styles.statOverviewNumber}>{stats.resolvedReports}</Text>
          <Text style={styles.statOverviewLabel}>Resolved</Text>
        </View>
        <View style={styles.statOverviewItem}>
          <Ionicons name="trending-up-outline" size={20} color="#3b82f6" />
          <Text style={styles.statOverviewNumber}>{stats.resolutionRate.toFixed(1)}%</Text>
          <Text style={styles.statOverviewLabel}>Resolution Rate</Text>
        </View>
      </TouchableOpacity>

      {/* Filters */}
      <View style={styles.filterContainer}>
        <Text style={styles.filterLabel}>Status:</Text>
        {(["all", "unresolved", "resolved"] as SafetyFilter[]).map(filter => (
          <TouchableOpacity
            key={filter}
            style={[styles.filterButton, statusFilter === filter && styles.filterButtonActive]}
            onPress={() => setStatusFilter(filter)}
          >
            <Text style={[styles.filterButtonText, statusFilter === filter && styles.filterButtonTextActive]}>
              {filter === "all" ? "All" : filter.charAt(0).toUpperCase() + filter.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
        
        <View style={styles.filterSeparator} />
        
        <Text style={styles.filterLabel}>Severity:</Text>
        {(["all", "low", "medium", "high", "critical"] as SeverityFilter[]).map(filter => (
          <TouchableOpacity
            key={filter}
            style={[styles.filterButton, severityFilter === filter && styles.filterButtonActive]}
            onPress={() => setSeverityFilter(filter)}
          >
            <Text style={[styles.filterButtonText, severityFilter === filter && styles.filterButtonTextActive]}>
              {filter === "all" ? "All" : filter.charAt(0).toUpperCase() + filter.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Reports List */}
      <FlatList
        data={filteredReports}
        keyExtractor={(item) => item._id}
        renderItem={renderReportItem}
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
            <Text style={styles.emptyText}>No safety reports found</Text>
            <Text style={styles.emptySubtext}>
              {statusFilter === "all" && severityFilter === "all" 
                ? "Great job! No safety violations reported." 
                : `No ${statusFilter !== "all" ? statusFilter : ""} ${severityFilter !== "all" ? severityFilter : ""} reports found`.trim()}
            </Text>
          </View>
        }
      />

      {/* Report Detail Modal */}
      <Modal
        visible={showDetailModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Safety Report Details</Text>
              <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            
            {selectedReport && (
              <ScrollView>
                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>Worker Information</Text>
                  <Text style={styles.detailName}>{selectedReport.workerName}</Text>
                  <Text style={styles.detailText}>{selectedReport.workerDetails.position}</Text>
                  <Text style={styles.detailText}>{selectedReport.workerDetails.team}</Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>Violations</Text>
                  {selectedReport.violations.map((violation, index) => (
                    <View key={index} style={styles.violationItem}>
                      <Ionicons name="warning-outline" size={16} color="#ef4444" />
                      <Text style={styles.violationText}>{violation}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>Details</Text>
                  <View style={styles.detailGrid}>
                    <View style={styles.detailItem}>
                      <Ionicons name="time-outline" size={16} color="#6b7280" />
                      <Text style={styles.detailLabel}>Reported</Text>
                      <Text style={styles.detailValue}>{formatDate(selectedReport.timestamp)}</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Ionicons name="location-outline" size={16} color="#6b7280" />
                      <Text style={styles.detailLabel}>Location</Text>
                      <Text style={styles.detailValue}>{selectedReport.location}</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Ionicons name="alert-circle-outline" size={16} color="#6b7280" />
                      <Text style={styles.detailLabel}>Severity</Text>
                      <Text style={[styles.detailValue, { color: getSeverityColor(selectedReport.severity) }]}>
                        {selectedReport.severity.toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Ionicons name="person-outline" size={16} color="#6b7280" />
                      <Text style={styles.detailLabel}>Reporter</Text>
                      <Text style={styles.detailValue}>
                        {selectedReport.reportedByName} ({selectedReport.reportedByRole})
                      </Text>
                    </View>
                  </View>
                </View>

                {selectedReport.description && (
                  <View style={styles.detailSection}>
                    <Text style={styles.sectionTitle}>Description</Text>
                    <Text style={styles.descriptionText}>{selectedReport.description}</Text>
                  </View>
                )}

                {selectedReport.resolution && (
                  <View style={styles.detailSection}>
                    <Text style={styles.sectionTitle}>Resolution</Text>
                    <Text style={styles.resolutionText}>{selectedReport.resolution}</Text>
                    {selectedReport.resolvedAt && (
                      <Text style={styles.resolutionDate}>
                        Resolved on: {formatDate(selectedReport.resolvedAt)}
                      </Text>
                    )}
                  </View>
                )}

                {!selectedReport.resolved && (
                  <View style={styles.actionButtons}>
                    <TouchableOpacity 
                      style={[styles.actionButton, styles.resolveButton]}
                      onPress={() => {
                        Alert.prompt(
                          "Resolve Report",
                          "Enter resolution details:",
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Resolve",
                              onPress: (resolution) => handleUpdateReport(selectedReport._id, { 
                                resolved: true,
                                resolution,
                                status: "Resolved"
                              })
                            }
                          ]
                        );
                      }}
                    >
                      <Ionicons name="checkmark-circle-outline" size={20} color="#10b981" />
                      <Text style={styles.actionButtonText}>Mark as Resolved</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={[styles.actionButton, styles.inProgressButton]}
                      onPress={() => handleUpdateReport(selectedReport._id, { 
                        status: "In Progress"
                      })}
                    >
                      <Ionicons name="time-outline" size={20} color="#f59e0b" />
                      <Text style={styles.actionButtonText}>Mark In Progress</Text>
                    </TouchableOpacity>
                  </View>
                )}
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
              <Text style={styles.modalTitle}>Safety Reports Statistics</Text>
              <TouchableOpacity onPress={() => setShowStatsModal(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            
            <ScrollView>
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Ionicons name="document-text-outline" size={24} color="#4f46e5" />
                  <Text style={styles.statNumber}>{stats.totalReports}</Text>
                  <Text style={styles.statLabel}>Total Reports</Text>
                </View>
                <View style={styles.statCard}>
                  <Ionicons name="alert-circle-outline" size={24} color="#ef4444" />
                  <Text style={styles.statNumber}>{stats.unresolvedReports}</Text>
                  <Text style={styles.statLabel}>Unresolved</Text>
                </View>
                <View style={styles.statCard}>
                  <Ionicons name="checkmark-circle-outline" size={24} color="#10b981" />
                  <Text style={styles.statNumber}>{stats.resolvedReports}</Text>
                  <Text style={styles.statLabel}>Resolved</Text>
                </View>
                <View style={styles.statCard}>
                  <Ionicons name="trending-up-outline" size={24} color="#3b82f6" />
                  <Text style={styles.statNumber}>{stats.resolutionRate.toFixed(1)}%</Text>
                  <Text style={styles.statLabel}>Resolution Rate</Text>
                </View>
              </View>

              <View style={styles.statsSection}>
                <Text style={styles.sectionTitle}>Violation Types</Text>
                <View style={styles.violationStats}>
                  <View style={styles.violationStat}>
                    <Ionicons name="hardware-chip-outline" size={20} color="#ef4444" />
                    <Text style={styles.violationNumber}>{stats.violationTypes.helmet}</Text>
                    <Text style={styles.violationLabel}>No Helmet</Text>
                  </View>
                  <View style={styles.violationStat}>
                    <Ionicons name="shirt-outline" size={20} color="#f59e0b" />
                    <Text style={styles.violationNumber}>{stats.violationTypes.vest}</Text>
                    <Text style={styles.violationLabel}>No Vest</Text>
                  </View>
                  <View style={styles.violationStat}>
                    <Ionicons name="warning-outline" size={20} color="#dc2626" />
                    <Text style={styles.violationNumber}>{stats.violationTypes.both}</Text>
                    <Text style={styles.violationLabel}>Both Missing</Text>
                  </View>
                </View>
              </View>

              <View style={styles.statsSection}>
                <Text style={styles.sectionTitle}>Severity Breakdown</Text>
                <View style={styles.severityStats}>
                  {Object.entries(stats.severityBreakdown).map(([severity, count]) => (
                    <View key={severity} style={styles.severityItem}>
                      <View style={[styles.severityDot, { backgroundColor: getSeverityColor(severity) }]} />
                      <Text style={styles.severityLabel}>{severity.toUpperCase()}</Text>
                      <Text style={styles.severityCount}>{count}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.statsSection}>
                <Text style={styles.sectionTitle}>Weekly Trends</Text>
                {stats.weeklyTrends.map((week, index) => (
                  <View key={index} style={styles.weekItem}>
                    <Text style={styles.weekName}>{week.week}</Text>
                    <Text style={styles.weekDate}>
                      {new Date(week.startDate).toLocaleDateString()} - {new Date(week.endDate).toLocaleDateString()}
                    </Text>
                    <Text style={styles.weekCount}>{week.count} reports</Text>
                  </View>
                ))}
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
  statsButton: {
    padding: 4,
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
    fontSize: 18,
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
  filterContainer: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    gap: 8,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginRight: 4,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#f3f4f6",
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
  filterSeparator: {
    width: 1,
    height: 20,
    backgroundColor: "#e5e7eb",
    marginHorizontal: 8,
  },
  listContent: {
    padding: 16,
  },
  reportCard: {
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
  reportHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  reportInfo: {
    flex: 1,
    marginRight: 8,
  },
  workerName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 4,
  },
  workerDetails: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 4,
  },
  violations: {
    fontSize: 14,
    color: "#ef4444",
    fontWeight: "500",
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
  reportDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    gap: 4,
  },
  detailText: {
    fontSize: 12,
    color: "#6b7280",
  },
  resolutionContainer: {
    padding: 12,
    backgroundColor: "#f0fdf4",
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#10b981",
  },
  resolutionText: {
    fontSize: 14,
    color: "#15803d",
    fontStyle: "italic",
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
  detailSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 12,
  },
  detailName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 4,
  },
  detailText: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 4,
  },
  violationItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    backgroundColor: "#fef2f2",
    borderRadius: 6,
    marginBottom: 4,
    gap: 8,
  },
  violationText: {
    fontSize: 14,
    color: "#dc2626",
    fontWeight: "500",
  },
  detailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  detailItem: {
    width: "48%",
    backgroundColor: "#f9fafb",
    padding: 12,
    borderRadius: 8,
  },
  detailLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
  },
  descriptionText: {
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 20,
    backgroundColor: "#f9fafb",
    padding: 12,
    borderRadius: 8,
  },
  resolutionDate: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 8,
    fontStyle: "italic",
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
  resolveButton: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  inProgressButton: {
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: "500",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    width: "45%",
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
  statsSection: {
    marginBottom: 20,
  },
  violationStats: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  violationStat: {
    alignItems: "center",
  },
  violationNumber: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1f2937",
    marginTop: 4,
  },
  violationLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
    textAlign: "center",
  },
  severityStats: {
    gap: 8,
  },
  severityItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    backgroundColor: "#f9fafb",
    borderRadius: 6,
    gap: 8,
  },
  severityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  severityLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    flex: 1,
  },
  severityCount: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1f2937",
  },
  weekItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    marginBottom: 8,
  },
  weekName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
  },
  weekDate: {
    fontSize: 12,
    color: "#6b7280",
  },
  weekCount: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#4f46e5",
  },
});