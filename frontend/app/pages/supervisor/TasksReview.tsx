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
  _id: string;
  taskName: string;
  description?: string;
  assignedTo: string;
  assignedToName?: string;
  assignedToEmail?: string;
  deadline: string;
  status: "Pending" | "In Progress" | "Completed" | "Approved" | "Rejected";
  priority: "Low" | "Medium" | "High";
  createdAt?: string;
  completedAt?: string;
  comments?: string;
};

type User = {
  _id: string;
  name: string;
  email: string;
  role: string;
};

type TaskFilter = "all" | "Pending" | "In Progress" | "Completed" | "Approved" | "Rejected";

export default function TasksReview() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<TaskFilter>("all");
  const [users, setUsers] = useState<User[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [assignModal, setAssignModal] = useState(false);

  // New task form state
  const [newTask, setNewTask] = useState({
    taskName: "",
    description: "",
    assignedTo: "",
    assignedToName: "",
    deadline: new Date().toISOString().split('T')[0],
    priority: "Medium" as "Low" | "Medium" | "High",
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
      // Filter to only show workers for assignment
      const workers = res.data.filter((user: User) => user.role === "Worker");
      setUsers(workers);
    } catch (err) {
      console.log("Users load error:", err);
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

  const handleCreateTask = async () => {
    try {
      const token = await SecureStore.getItemAsync("authToken");
      await axios.post(`${getBaseUrl()}/api/tasks`, {
        taskName: newTask.taskName,
        description: newTask.description,
        assignedTo: newTask.assignedTo,
        deadline: newTask.deadline,
        priority: newTask.priority,
        status: "Pending"
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      Alert.alert("Success", "Task assigned successfully");
      setShowModal(false);
      setNewTask({
        taskName: "",
        description: "",
        assignedTo: "",
        assignedToName: "",
        deadline: new Date().toISOString().split('T')[0],
        priority: "Medium",
      });
      fetchTasks();
    } catch (err: any) {
      console.log("Task creation error:", err);
      Alert.alert("Error", err.response?.data?.error || "Failed to assign task");
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, newStatus: string, comments?: string) => {
    try {
      const token = await SecureStore.getItemAsync("authToken");
      const updates: any = { status: newStatus };
      
      if (comments) {
        updates.comments = comments;
      }
      
      if (newStatus === "Completed" || newStatus === "Approved") {
        updates.completedAt = new Date().toISOString();
      }
      
      await axios.put(`${getBaseUrl()}/api/tasks/${taskId}`, updates, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      Alert.alert("Success", `Task status updated to ${newStatus}`);
      setSelectedTask(null);
      fetchTasks();
    } catch (err: any) {
      console.log("Status update error:", err);
      Alert.alert("Error", err.response?.data?.error || "Failed to update task status");
    }
  };

  const handleReassignTask = async (taskId: string, newAssignee: string) => {
    try {
      const token = await SecureStore.getItemAsync("authToken");
      await axios.put(`${getBaseUrl()}/api/tasks/${taskId}`, {
        assignedTo: newAssignee
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      Alert.alert("Success", "Task reassigned successfully");
      setAssignModal(false);
      fetchTasks();
    } catch (err: any) {
      console.log("Reassignment error:", err);
      Alert.alert("Error", err.response?.data?.error || "Failed to reassign task");
    }
  };

  const getUserName = (userId: string) => {
    const user = users.find(u => u._id === userId);
    return user ? user.name : "Unknown User";
  };

  const renderTaskItem = ({ item }: { item: Task }) => (
    <TouchableOpacity 
      style={styles.card}
      onPress={() => setSelectedTask(item)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.taskTitle}>{item.taskName}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status}</Text>
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
          <Text style={styles.detailText}>
            Deadline: {formatDate(item.deadline)}
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
      </View>
      
      <View style={styles.cardActions}>
        {item.status === "Completed" && (
          <>
            <TouchableOpacity 
              style={[styles.actionButton, styles.approveButton]}
              onPress={() => handleUpdateTaskStatus(item._id, "Approved", "Task approved by supervisor")}
            >
              <Ionicons name="checkmark-done-outline" size={16} color="#10b981" />
              <Text style={[styles.actionText, { color: "#10b981" }]}>Approve</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, styles.rejectButton]}
              onPress={() => {
                Alert.prompt(
                  "Reject Task",
                  "Provide feedback for rejection:",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Reject",
                      onPress: (comments) => handleUpdateTaskStatus(item._id, "Rejected", comments)
                    }
                  ]
                );
              }}
            >
              <Ionicons name="close-circle-outline" size={16} color="#ef4444" />
              <Text style={[styles.actionText, { color: "#ef4444" }]}>Reject</Text>
            </TouchableOpacity>
          </>
        )}
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.reassignButton]}
          onPress={() => {
            setSelectedTask(item);
            setAssignModal(true);
          }}
        >
          <Ionicons name="swap-horizontal-outline" size={16} color="#3b82f6" />
          <Text style={[styles.actionText, { color: "#3b82f6" }]}>Reassign</Text>
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
        <Text style={styles.title}>Task Review & Assignment</Text>
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
        <FilterButton 
          label="Approved" 
          value="Approved" 
          currentValue={statusFilter} 
          onPress={setStatusFilter} 
        />
        <FilterButton 
          label="Rejected" 
          value="Rejected" 
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
            {tasks.filter(t => t.status === "Completed").length}
          </Text>
          <Text style={styles.summaryLabel}>Completed</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNumber}>
            {tasks.filter(t => t.status === "Pending").length}
          </Text>
          <Text style={styles.summaryLabel}>Pending Review</Text>
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
                ? "Assign your first task to get started" 
                : `No ${statusFilter} tasks found`}
            </Text>
          </View>
        }
      />

      {/* Assign Task Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Assign New Task</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Task Name"
              value={newTask.taskName}
              onChangeText={(text) => setNewTask({...newTask, taskName: text})}
            />
            
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Description (Optional)"
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
                          newTask.assignedTo === user._id && styles.selectOptionActive
                        ]}
                        onPress={() => setNewTask({
                          ...newTask, 
                          assignedTo: user._id,
                          assignedToName: user.name
                        })}
                      >
                        <Text style={styles.selectOptionText}>{user.name} ({user.email})</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                ) : (
                  <Text style={styles.selectPlaceholder}>No workers available</Text>
                )}
              </View>
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Priority:</Text>
              <View style={styles.priorityButtons}>
                {["High", "Medium", "Low"].map(priority => (
                  <TouchableOpacity
                    key={priority}
                    style={[
                      styles.priorityButton,
                      newTask.priority === priority && styles.priorityButtonActive
                    ]}
                    onPress={() => setNewTask({...newTask, priority: priority as any})}
                  >
                    <Text style={styles.priorityButtonText}>{priority}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Deadline:</Text>
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
                <Text style={styles.createButtonText}>Assign Task</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reassign Task Modal */}
      {selectedTask && (
        <Modal
          visible={assignModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setAssignModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Reassign Task</Text>
              <Text style={styles.modalSubtitle}>Reassign: {selectedTask.taskName}</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Assign to:</Text>
                <View style={styles.select}>
                  {users.length > 0 ? (
                    <ScrollView style={styles.selectOptions}>
                      {users.map(user => (
                        <Pressable
                          key={user._id}
                          style={styles.selectOption}
                          onPress={() => {
                            handleReassignTask(selectedTask._id, user._id);
                          }}
                        >
                          <Text style={styles.selectOptionText}>{user.name} ({user.email})</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  ) : (
                    <Text style={styles.selectPlaceholder}>No workers available</Text>
                  )}
                </View>
              </View>
              
              <View style={styles.modalActions}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setAssignModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
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
  approveButton: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
  },
  rejectButton: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
  },
  reassignButton: {
    backgroundColor: "rgba(59, 130, 246, 0.1)",
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
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#6b7280",
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
    gap: 8,
  },
  priorityButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
  },
  priorityButtonActive: {
    backgroundColor: "#4f46e5",
  },
  priorityButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
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