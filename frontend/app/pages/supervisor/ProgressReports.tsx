import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  RefreshControl
} from "react-native";
import axios from "axios";
import * as SecureStore from "expo-secure-store";
import getBaseUrl from "../../baseurl";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

type ProgressSummary = {
  date_range: {
    start: string;
    end: string;
  };
  tasks: {
    total: number;
    completed: number;
    in_progress: number;
    pending: number;
    overdue: number;
  };
  attendance: {
    total_days: number;
    present: number;
    absent: number;
    late: number;
  };
  productivity: {
    tasks_completed: number;
    avg_completion_days: number;
    completion_rate: number;
  };
};

type WorkerPerformance = {
  worker_id: string;
  worker_name: string;
  tasks_assigned: number;
  tasks_completed: number;
  completion_rate: number;
  attendance_days: number;
  performance_score: number;
};

export default function ProgressReports() {
  const router = useRouter();
  const [summary, setSummary] = useState<ProgressSummary | null>(null);
  const [workerPerformance, setWorkerPerformance] = useState<WorkerPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchProgressData();
  }, []);

  const fetchProgressData = async () => {
    try {
      setLoading(true);
      const token = await SecureStore.getItemAsync("authToken");
      
      const [summaryRes, reportsRes] = await Promise.all([
        axios.get(`${getBaseUrl()}/api/progress/summary`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${getBaseUrl()}/api/progress/reports?startDate=${dateRange.start}&endDate=${dateRange.end}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      ]);
      
      setSummary(summaryRes.data);
      setWorkerPerformance(reportsRes.data.worker_performance || []);
      setLoading(false);
      setRefreshing(false);
    } catch (err) {
      console.log("Progress data load error:", err);
      Alert.alert("Error", "Failed to load progress data.");
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchProgressData();
  };

  const handleExport = async (format: string) => {
    try {
      const token = await SecureStore.getItemAsync("authToken");
      const res = await axios.get(
        `${getBaseUrl()}/api/progress/export?startDate=${dateRange.start}&endDate=${dateRange.end}&type=${format}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      Alert.alert("Success", `Report exported in ${format.toUpperCase()} format`);
      // Here you would typically download the file or show it
      console.log("Export data:", res.data);
    } catch (err) {
      Alert.alert("Error", "Failed to export report");
    }
  };

  const StatCard = ({ title, value, subtitle, color }: any) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
      {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4f46e5" />
          <Text style={styles.loadingText}>Loading Progress Reports...</Text>
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
        <Text style={styles.title}>Progress Reports</Text>
        <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color="#4f46e5" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={handleRefresh} 
            colors={["#4f46e5"]}
          />
        }
      >
        {/* Date Range */}
        <View style={styles.dateSection}>
          <Text style={styles.sectionTitle}>
            Period: {new Date(dateRange.start).toLocaleDateString()} - {new Date(dateRange.end).toLocaleDateString()}
          </Text>
        </View>

        {/* Summary Section */}
        {summary && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Project Overview</Text>
            <View style={styles.statsGrid}>
              <StatCard title="Total Tasks" value={summary.tasks.total} color="#4f46e5" />
              <StatCard title="Completed" value={summary.tasks.completed} color="#10b981" />
              <StatCard title="In Progress" value={summary.tasks.in_progress} color="#3b82f6" />
              <StatCard title="Overdue" value={summary.tasks.overdue} color="#ef4444" />
            </View>
            
            <View style={styles.statsGrid}>
              <StatCard title="Attendance Rate" value={`${Math.round(summary.attendance.present / summary.attendance.total_days * 100)}%`} color="#f59e0b" />
              <StatCard title="Completion Rate" value={`${Math.round(summary.productivity.completion_rate)}%`} color="#8b5cf6" />
              <StatCard title="Avg. Completion" value={`${summary.productivity.avg_completion_days}d`} color="#06b6d4" />
            </View>
          </View>
        )}

        {/* Worker Performance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Team Performance</Text>
          {workerPerformance.map((worker, index) => (
            <View key={worker.worker_id} style={styles.workerCard}>
              <View style={styles.workerHeader}>
                <Text style={styles.workerName}>{worker.worker_name}</Text>
                <Text style={styles.performanceScore}>{worker.performance_score}/100</Text>
              </View>
              
              <View style={styles.workerStats}>
                <View style={styles.statRow}>
                  <Ionicons name="document-text-outline" size={16} color="#6b7280" />
                  <Text style={styles.statText}>
                    Tasks: {worker.tasks_completed}/{worker.tasks_assigned} ({Math.round(worker.completion_rate)}%)
                  </Text>
                </View>
                
                <View style={styles.statRow}>
                  <Ionicons name="calendar-outline" size={16} color="#6b7280" />
                  <Text style={styles.statText}>
                    Attendance: {worker.attendance_days} days
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Export Options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Export Reports</Text>
          <View style={styles.exportButtons}>
            <TouchableOpacity 
              style={[styles.exportButton, { backgroundColor: "#10b981" }]}
              onPress={() => handleExport('csv')}
            >
              <Ionicons name="download-outline" size={20} color="#fff" />
              <Text style={styles.exportButtonText}>Export CSV</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.exportButton, { backgroundColor: "#3b82f6" }]}
              onPress={() => handleExport('pdf')}
            >
              <Ionicons name="document-text-outline" size={20} color="#fff" />
              <Text style={styles.exportButtonText}>Export PDF</Text>
            </TouchableOpacity>
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    marginTop:10,
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
  scrollView: {
    flex: 1,
  },
  dateSection: {
    padding: 16,
    backgroundColor: "#fff",
    marginBottom: 8,
  },
  section: {
    padding: 16,
    backgroundColor: "#fff",
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 16,
    gap: 12,
  },
  statCard: {
    width: "48%",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 4,
  },
  statTitle: {
    fontSize: 14,
    color: "#6b7280",
  },
  statSubtitle: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 4,
  },
  workerCard: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#3b82f6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  workerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  workerName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
  },
  performanceScore: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#10b981",
  },
  workerStats: {
    gap: 8,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statText: {
    fontSize: 14,
    color: "#6b7280",
  },
  exportButtons: {
    flexDirection: "row",
    gap: 12,
  },
  exportButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  exportButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
});