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
import DateTimePicker from '@react-native-community/datetimepicker';

type Task = {
  _id?: string;
  taskName: string;
  assignedTo: string;
  assignedToName?: string;
  deadline: string;
  status: string;
  description?: string;
  priority?: string;
  createdAt?: string;
  completedAt?: string;
};

type User = {
  _id: string;
  name: string;
  email: string;
  role: string;
};

type TaskFilter = "all" | "Pending" | "In Progress" | "Completed";

export default function TasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<TaskFilter>("all");
  const [users, setUsers] = useState<User[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // New task form state
  const [newTask, setNewTask] = useState({
    taskName: "",
    description: "",
    assignedTo: "",
    status: "Pending",
    priority: "medium",
    deadline: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    fetchTasks();
    fetchUsers();
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

  const fetchUsers = async () => {
    try {
      const token = await SecureStore.getItemAsync("authToken");
      const res = await axios.get(`${getBaseUrl()}/api/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(res.data);
    } catch (err) {
      console.log("Users load error:", err);
      // Fallback to empty array if users endpoint doesn't exist
      setUsers([]);
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

  const getStatusColor = (status?: string) => {
    switch ((status || "").toLowerCase()) {
      case "completed": return "#10b981";
      case "in progress": return "#3b82f6";
      case "pending": return "#f59e0b";
      default: return "#6b7280";
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch ((priority || "").toLowerCase()) {
      case "high": return "#ef4444";
      case "medium": return "#f59e0b";
      case "low": return "#10b981";
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

  const handleCreateTask = async () => {
    try {
      const token = await SecureStore.getItemAsync("authToken");
      await axios.post(`${getBaseUrl()}/api/tasks`, newTask, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      Alert.alert("Success", "Task created successfully");
      setShowModal(false);
      setNewTask({
        taskName: "",
        description: "",
        assignedTo: "",
        status: "Pending",
        priority: "medium",
        deadline: new Date().toISOString().split('T')[0],
      });
      fetchTasks();
    } catch (err) {
      console.log("Task creation error:", err);
      Alert.alert("Error", "Failed to create task");
    }
  };

  const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
    try {
      const token = await SecureStore.getItemAsync("authToken");
      await axios.put(`${getBaseUrl()}/api/tasks/${taskId}`, updates, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      Alert.alert("Success", "Task updated successfully");
      setEditingTask(null);
      fetchTasks();
    } catch (err) {
      console.log("Task update error:", err);
      Alert.alert("Error", "Failed to update task");
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    Alert.alert(
      "Confirm Delete",
      "Are you sure you want to delete this task?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const token = await SecureStore.getItemAsync("authToken");
              await axios.delete(`${getBaseUrl()}/api/tasks/${taskId}`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              
              Alert.alert("Success", "Task deleted successfully");
              fetchTasks();
            } catch (err) {
              console.log("Task deletion error:", err);
              Alert.alert("Error", "Failed to delete task");
            }
          }
        }
      ]
    );
  };

  const getUserName = (email: string) => {
    const user = users.find(u => u.email === email);
    return user ? user.name : email;
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
          <Ionicons name="person-outline" size={16} color="#6b7280" />
          <Text style={styles.detailText}>
            Assigned to: {item.assignedToName || getUserName(item.assignedTo)}
          </Text>
        </View>
        
        {item.priority && (
          <View style={styles.detailRow}>
            <Ionicons name="flag-outline" size={16} color="#6b7280" />
            <Text style={styles.detailText}>
              Priority: 
              <Text style={{ color: getPriorityColor(item.priority) }}>
                {" "}{item.priority}
              </Text>
            </Text>
          </View>
        )}
        
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={16} color="#6b7280" />
          <Text style={styles.detailText}>
            Due: {formatDate(item.deadline)}
          </Text>
        </View>
      </View>
      
      <View style={styles.cardActions}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.editButton]}
          onPress={() => setEditingTask(item)}
        >
          <Ionicons name="create-outline" size={16} color="#3b82f6" />
          <Text style={[styles.actionText, { color: "#3b82f6" }]}>Edit</Text>
        </TouchableOpacity>
        
        {item.status !== "Completed" && (
          <TouchableOpacity 
            style={[styles.actionButton, styles.completeButton]}
            onPress={() => handleUpdateTask(item._id!, { status: "Completed", completedAt: new Date().toISOString() })}
          >
            <Ionicons name="checkmark-outline" size={16} color="#10b981" />
            <Text style={[styles.actionText, { color: "#10b981" }]}>Complete</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDeleteTask(item._id!)}
        >
          <Ionicons name="trash-outline" size={16} color="#ef4444" />
          <Text style={[styles.actionText, { color: "#ef4444" }]}>Delete</Text>
        </TouchableOpacity>
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
        <Text style={styles.title}>Task Management</Text>
        <TouchableOpacity 
          onPress={() => setShowModal(true)} 
          style={styles.addButton}
        >
          <Ionicons name="add" size={24} color="#fff" />
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
            {tasks.filter(t => t.status === "Completed").length}
          </Text>
          <Text style={styles.summaryLabel}>Completed</Text>
        </View>
      </View>

      {/* Task List */}
      <FlatList
        data={filteredTasks}
        keyExtractor={(item) => item._id || item.taskName}
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
                ? "Create your first task to get started" 
                : `No ${statusFilter} tasks found`}
            </Text>
          </View>
        }
      />

      {/* Create Task Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create New Task</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Task Name"
              value={newTask.taskName}
              onChangeText={(text) => setNewTask({...newTask, taskName: text})}
            />
            
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Task Description (Optional)"
              multiline
              numberOfLines={3}
              value={newTask.description}
              onChangeText={(text) => setNewTask({...newTask, description: text})}
            />
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Assign to:</Text>
              <View style={styles.select}>
                {users.length > 0 ? (
                  <ScrollView style={styles.selectOptions}>
                    {users.map(user => (
                      <Pressable
                        key={user._id}
                        style={[
                          styles.selectOption,
                          newTask.assignedTo === user.email && styles.selectOptionActive
                        ]}
                        onPress={() => setNewTask({...newTask, assignedTo: user.email})}
                      >
                        <Text style={styles.selectOptionText}>{user.name} ({user.email})</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                ) : (
                  <Text style={styles.selectPlaceholder}>No users available</Text>
                )}
              </View>
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Priority:</Text>
              <View style={styles.priorityButtons}>
                {["high", "medium", "low"].map(priority => (
                  <TouchableOpacity
                    key={priority}
                    style={[
                      styles.priorityButton,
                      newTask.priority === priority && styles.priorityButtonActive
                    ]}
                    onPress={() => setNewTask({...newTask, priority})}
                  >
                    <Text style={styles.priorityButtonText}>{priority}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Due Date:</Text>
              <TouchableOpacity 
                style={styles.dateInput}
                onPress={() => setShowDatePicker(true)}
              >
                <Text>{newTask.deadline}</Text>
                <Ionicons name="calendar-outline" size={20} color="#6b7280" />
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={new Date(newTask.deadline)}
                  mode="date"
                  display="default"
                  onChange={(event, date) => {
                    setShowDatePicker(false);
                    if (date) {
                      setNewTask({...newTask, deadline: date.toISOString().split('T')[0]});
                    }
                  }}
                />
              )}
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
                onPress={handleCreateTask}
                disabled={!newTask.taskName || !newTask.assignedTo}
              >
                <Text style={styles.createButtonText}>Create Task</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Task Modal would be similar but for updating existing tasks */}
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
  addButton: {
    backgroundColor: "#4f46e5",
    padding: 8,
    borderRadius: 8,
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
  cardActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    paddingTop: 12,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  editButton: {
    backgroundColor: "rgba(59, 130, 246, 0.1)",
  },
  completeButton: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
  },
  deleteButton: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
  },
  actionText: {
    fontSize: 14,
    fontWeight: "500",
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
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 16,
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
    height: 80,
    textAlignVertical: "top",
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 8,
  },
  select: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    maxHeight: 120,
  },
  selectOptions: {
    padding: 8,
  },
  selectOption: {
    padding: 12,
    borderRadius: 6,
    marginBottom: 4,
  },
  selectOptionActive: {
    backgroundColor: "#f3f4f6",
  },
  selectOptionText: {
    fontSize: 14,
    color: "#374151",
  },
  selectPlaceholder: {
    padding: 12,
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
  },
  priorityButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  priorityButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
    marginHorizontal: 4,
    alignItems: "center",
  },
  priorityButtonActive: {
    backgroundColor: "#4f46e5",
  },
  priorityButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    textTransform: "capitalize",
  },
  dateInput: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 16,
  },
  modalButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8,
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