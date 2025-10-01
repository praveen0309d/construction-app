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

type Task = {
  _id: string;
  taskName: string;
  description?: string;
  assignedTo: string;
  assignedToName?: string;
  deadline: string;
  status: "Pending" | "In Progress" | "Completed" | "Approved" | "Rejected";
  priority: "Low" | "Medium" | "High";
  createdAt?: string;
  completedAt?: string;
  comments?: string;
};

type TaskFilter = "all" | "Pending" | "In Progress" | "Completed";

export default function TasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<TaskFilter>("all");

  useEffect(() => {
    fetchTasks();
  }, []);

  useEffect(() => {
    filterTasks();
  }, [tasks, statusFilter]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const token = await SecureStore.getItemAsync("authToken");
      const res = await axios.get(`${getBaseUrl()}/api/tasks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTasks(res.data);
      setLoading(false);
      setRefreshing(false);
    } catch (err) {
      console.log("Tasks load error:", err);
      Alert.alert("Error", "Failed to load tasks data.");
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchTasks();
  };

  const filterTasks = () => {
    if (statusFilter === "all") {
      setFilteredTasks(tasks);
    } else {
      setFilteredTasks(tasks.filter(task => task.status === statusFilter));
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      const token = await SecureStore.getItemAsync("authToken");
      const updates: any = { status: newStatus };
      
      if (newStatus === "Completed") {
        updates.completedAt = new Date().toISOString();
      }
      
      await axios.put(`${getBaseUrl()}/api/tasks/${taskId}`, updates, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      Alert.alert("Success", `Task status updated to ${newStatus}`);
      fetchTasks();
    } catch (err: any) {
      console.log("Status update error:", err);
      Alert.alert("Error", err.response?.data?.error || "Failed to update task status");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Completed": return "#10b981";
      case "Approved": return "#10b981";
      case "In Progress": return "#3b82f6";
      case "Pending": return "#f59e0b";
      case "Rejected": return "#ef4444";
      default: return "#6b7280";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "High": return "#ef4444";
      case "Medium": return "#f59e0b";
      case "Low": return "#10b981";
      default: return "#6b7280";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const isTaskOverdue = (deadline: string) => {
    const today = new Date();
    const dueDate = new Date(deadline);
    return dueDate < today;
  };

  const renderTaskItem = ({ item }: { item: Task }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.taskTitle}>{item.taskName}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
        </View>
      </View>
      
      {item.description && (
        <Text style={styles.taskDescription}>{item.description}</Text>
      )}
      
      <View style={styles.taskDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="flag-outline" size={16} color="#6b7280" />
          <Text style={styles.detailText}>
            Priority: 
            <Text style={{ color: getPriorityColor(item.priority) }}>
              {" "}{item.priority}
            </Text>
          </Text>
        </View>
        
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={16} color="#6b7280" />
          <Text style={[styles.detailText, isTaskOverdue(item.deadline) && styles.overdueText]}>
            Deadline: {formatDate(item.deadline)}
            {isTaskOverdue(item.deadline) && " ⚠️ Overdue"}
          </Text>
        </View>
        
        {item.completedAt && (
          <View style={styles.detailRow}>
            <Ionicons name="checkmark-circle-outline" size={16} color="#10b981" />
            <Text style={[styles.detailText, { color: "#10b981" }]}>
              Completed: {formatDate(item.completedAt)}
            </Text>
          </View>
        )}
        
        {item.comments && (
          <View style={styles.detailRow}>
            <Ionicons name="chatbubble-outline" size={16} color="#6b7280" />
            <Text style={styles.detailText}>Comments: {item.comments}</Text>
          </View>
        )}
      </View>
      
      {item.status !== "Completed" && item.status !== "Approved" && item.status !== "Rejected" && (
        <View style={styles.cardActions}>
          {item.status === "Pending" && (
            <TouchableOpacity 
              style={[styles.actionButton, styles.startButton]}
              onPress={() => handleUpdateTaskStatus(item._id, "In Progress")}
            >
              <Ionicons name="play-outline" size={16} color="#3b82f6" />
              <Text style={[styles.actionText, { color: "#3b82f6" }]}>Start Task</Text>
            </TouchableOpacity>
          )}
          
          {item.status === "In Progress" && (
            <TouchableOpacity 
              style={[styles.actionButton, styles.completeButton]}
              onPress={() => handleUpdateTaskStatus(item._id, "Completed")}
            >
              <Ionicons name="checkmark-outline" size={16} color="#10b981" />
              <Text style={[styles.actionText, { color: "#10b981" }]}>Mark Complete</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );

  const FilterButton = ({ 
    label, 
    value, 
    currentValue, 
    onPress 
  }: { 
    label: string; 
    value: TaskFilter; 
    currentValue: TaskFilter; 
    onPress: (value: TaskFilter) => void; 
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
          <Text style={styles.loadingText}>Loading Tasks...</Text>
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
        <Text style={styles.title}>My Tasks</Text>
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
        <FilterButton 
          label="All Tasks" 
          value="all" 
          currentValue={statusFilter} 
          onPress={setStatusFilter} 
        />
        <FilterButton 
          label="Pending" 
          value="Pending" 
          currentValue={statusFilter} 
          onPress={setStatusFilter} 
        />
        <FilterButton 
          label="In Progress" 
          value="In Progress" 
          currentValue={statusFilter} 
          onPress={setStatusFilter} 
        />
        <FilterButton 
          label="Completed" 
          value="Completed" 
          currentValue={statusFilter} 
          onPress={setStatusFilter} 
        />
      </ScrollView>

      {/* Summary */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNumber}>{tasks.length}</Text>
          <Text style={styles.summaryLabel}>Total Tasks</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNumber}>
            {tasks.filter(t => t.status === "Pending").length}
          </Text>
          <Text style={styles.summaryLabel}>Pending</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNumber}>
            {tasks.filter(t => t.status === "Completed" || t.status === "Approved").length}
          </Text>
          <Text style={styles.summaryLabel}>Completed</Text>
        </View>
      </View>

      {/* Task List */}
      <FlatList
        data={filteredTasks}
        keyExtractor={(item) => item._id}
        renderItem={renderTaskItem}
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
            <Ionicons name="document-text-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyText}>No tasks found</Text>
            <Text style={styles.emptySubtext}>
              {statusFilter === "all" 
                ? "You don't have any tasks assigned yet" 
                : `No ${statusFilter} tasks found`}
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
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
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
  taskTitle: {
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
  taskDescription: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 12,
    fontStyle: 'italic',
  },
  taskDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  detailText: {
    fontSize: 14,
    color: "#6b7280",
    marginLeft: 4,
  },
  overdueText: {
    color: "#ef4444",
    fontWeight: "500",
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  startButton: {
    backgroundColor: "rgba(59, 130, 246, 0.1)",
  },
  completeButton: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
  },
  actionText: {
    fontSize: 14,
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
});