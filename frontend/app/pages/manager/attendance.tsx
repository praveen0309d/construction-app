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
  RefreshControl
} from "react-native";
import axios from "axios";
import * as SecureStore from "expo-secure-store";
import getBaseUrl from "../../baseurl";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

type AttendanceRecord = {
  _id?: string;
  user_id: string;
  name: string;
  date: string;
  status: string;
  check_in: string;
  check_out: string;
  timestamp?: string;
};

type DateFilter = "today" | "week" | "month" | "all";

export default function AttendancePage() {
  const router = useRouter();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [filteredAttendance, setFilteredAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    fetchAttendance();
  }, []);

  useEffect(() => {
    filterAttendance();
  }, [attendance, dateFilter, statusFilter]);

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      const token = await SecureStore.getItemAsync("authToken");
      const res = await axios.get(`${getBaseUrl()}/api/attendance`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAttendance(res.data);
      setLoading(false);
      setRefreshing(false);
    } catch (err) {
      console.log("Attendance load error:", err);
      Alert.alert("Error", "Failed to load attendance data.");
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAttendance();
  };

  const filterAttendance = () => {
    let filtered = [...attendance];
    
    // Apply date filter
    const now = new Date();
    switch (dateFilter) {
      case "today":
        const today = now.toISOString().split('T')[0];
        filtered = filtered.filter(record => record.date === today);
        break;
      case "week":
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter(record => {
          const recordDate = new Date(record.date);
          return recordDate >= oneWeekAgo;
        });
        break;
      case "month":
        const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter(record => {
          const recordDate = new Date(record.date);
          return recordDate >= oneMonthAgo;
        });
        break;
      default:
        // "all" - no date filtering
        break;
    }
    
    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(record => record.status === statusFilter);
    }
    
    setFilteredAttendance(filtered);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "present": return "#10b981";
      case "absent": return "#ef4444";
      case "late": return "#f59e0b";
      case "leave": return "#3b82f6";
      default: return "#6b7280";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const renderAttendanceItem = ({ item }: { item: AttendanceRecord }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.name}>{item.name}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
        </View>
      </View>
      
      <Text style={styles.date}>{formatDate(item.date)}</Text>
      
      <View style={styles.timeContainer}>
        <View style={styles.timeBlock}>
          <Ionicons name="time-outline" size={16} color="#4f46e5" />
          <Text style={styles.timeLabel}>Check-in:</Text>
          <Text style={styles.timeValue}>{item.check_in || "N/A"}</Text>
        </View>
        
        <View style={styles.timeBlock}>
          <Ionicons name="time-outline" size={16} color="#ef4444" />
          <Text style={styles.timeLabel}>Check-out:</Text>
          <Text style={styles.timeValue}>{item.check_out || "N/A"}</Text>
        </View>
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
    value: string; 
    currentValue: string; 
    onPress: (value: string) => void; 
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
          <Text style={styles.loadingText}>Loading Attendance Data...</Text>
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
        <Text style={styles.title}>Attendance Records</Text>
        <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color="#4f46e5" />
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
      >
        <Text style={styles.filterLabel}>Date:</Text>
        <FilterButton 
          label="Today" 
          value="today" 
          currentValue={dateFilter} 
          onPress={setDateFilter} 
        />
        <FilterButton 
          label="This Week" 
          value="week" 
          currentValue={dateFilter} 
          onPress={setDateFilter} 
        />
        <FilterButton 
          label="This Month" 
          value="month" 
          currentValue={dateFilter} 
          onPress={setDateFilter} 
        />
        <FilterButton 
          label="All" 
          value="all" 
          currentValue={dateFilter} 
          onPress={setDateFilter} 
        />
        
        <View style={styles.filterSeparator} />
        
        <Text style={styles.filterLabel}>Status:</Text>
        <FilterButton 
          label="All" 
          value="all" 
          currentValue={statusFilter} 
          onPress={setStatusFilter} 
        />
        <FilterButton 
          label="Present" 
          value="present" 
          currentValue={statusFilter} 
          onPress={setStatusFilter} 
        />
        <FilterButton 
          label="Absent" 
          value="absent" 
          currentValue={statusFilter} 
          onPress={setStatusFilter} 
        />
        <FilterButton 
          label="Late" 
          value="late" 
          currentValue={statusFilter} 
          onPress={setStatusFilter} 
        />
      </ScrollView>

      {/* Summary */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNumber}>
            {filteredAttendance.length}
          </Text>
          <Text style={styles.summaryLabel}>Total Records</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNumber}>
            {filteredAttendance.filter(a => a.status === "present").length}
          </Text>
          <Text style={styles.summaryLabel}>Present</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNumber}>
            {filteredAttendance.filter(a => a.status === "absent").length}
          </Text>
          <Text style={styles.summaryLabel}>Absent</Text>
        </View>
      </View>

      {/* Attendance List */}
      <FlatList
        data={filteredAttendance}
        keyExtractor={(item) => item._id || `${item.user_id}-${item.date}`}
        renderItem={renderAttendanceItem}
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
            <Ionicons name="calendar-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyText}>No attendance records found</Text>
            <Text style={styles.emptySubtext}>
              Try changing your filters or check back later
            </Text>
          </View>
        }
      />
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
    marginTop: 10,
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
  filterContainer: {
    flexGrow: 0,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginRight: 8,
    alignSelf: "center",
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
  filterSeparator: {
    width: 1,
    backgroundColor: "#e5e7eb",
    marginHorizontal: 8,
    alignSelf: "stretch",
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
    fontSize: 24,
    fontWeight: "bold",
    color: "#1f2937",
  },
  summaryLabel: {
    fontSize: 14,
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
    alignItems: "center",
    marginBottom: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
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
  date: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 12,
  },
  timeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  timeBlock: {
    flexDirection: "row",
    alignItems: "center",
  },
  timeLabel: {
    fontSize: 14,
    color: "#6b7280",
    marginLeft: 4,
    marginRight: 4,
  },
  timeValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1f2937",
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
});