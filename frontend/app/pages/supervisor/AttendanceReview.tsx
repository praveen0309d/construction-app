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

type AttendanceRecord = {
  _id: string;
  workerId: string;
  workerName?: string;
  date: string;
  status: "Present" | "Absent" | "Late" | "Leave" | "Half Day";
  checkIn: string;
  checkOut: string;
  hoursWorked?: number;
  notes?: string;
};

type AttendanceStats = {
  totalRecords: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  leaveCount: number;
  averageHours: number;
};

type DateFilter = "today" | "week" | "month" | "all";
type StatusFilter = "all" | "Present" | "Absent" | "Late" | "Leave" | "Half Day";

export default function AttendanceReview() {
  const router = useRouter();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [filteredAttendance, setFilteredAttendance] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState<AttendanceStats>({
    totalRecords: 0,
    presentCount: 0,
    absentCount: 0,
    lateCount: 0,
    leaveCount: 0,
    averageHours: 0
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>("week");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showModal, setShowModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [workers, setWorkers] = useState<any[]>([]);

  // Edit form state
  const [editForm, setEditForm] = useState({
    status: "Present" as "Present" | "Absent" | "Late" | "Leave" | "Half Day",
    checkIn: "08:00",
    checkOut: "17:00",
    notes: ""
  });

  useEffect(() => {
    fetchAttendance();
    fetchWorkers();
  }, []);

  useEffect(() => {
    filterAttendance();
    calculateStats();
  }, [attendance, dateFilter, statusFilter]);

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      const token = await SecureStore.getItemAsync("authToken");
      const res = await axios.get(`${getBaseUrl()}/api/attendance`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      // Enrich with worker names
      const enrichedAttendance = await enrichAttendanceWithWorkerNames(res.data);
      setAttendance(enrichedAttendance);
      setLoading(false);
      setRefreshing(false);
    } catch (err) {
      console.log("Attendance load error:", err);
      Alert.alert("Error", "Failed to load attendance data.");
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchWorkers = async () => {
    try {
      const token = await SecureStore.getItemAsync("authToken");
      const res = await axios.get(`${getBaseUrl()}/api/users/role/Worker`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setWorkers(res.data);
    } catch (err) {
      console.log("Workers load error:", err);
    }
  };

const enrichAttendanceWithWorkerNames = async (records: AttendanceRecord[]) => {
  try {
    const token = await SecureStore.getItemAsync("authToken");
    const workersRes = await axios.get(`${getBaseUrl()}/api/users`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    // Create a simple mapping of all user IDs to names
    const workerNameMap = new Map<string, string>();
    
    workersRes.data.forEach((user: any) => {
      // Store both the ID and email as keys to the name
      const userId = String(user._id);
      workerNameMap.set(userId, user.name);
      
      if (user.email) {
        workerNameMap.set(user.email, user.name);
      }
    });

    return records.map(record => {
      // Try to find the worker name by any possible identifier
      const workerName = workerNameMap.get(String(record.workerId));
      
      return {
        ...record,
        workerName: workerName || "Unknown Worker", // Show only name, no ID
      };
    });
  } catch (err) {
    console.log("Worker name enrichment error:", err);
    return records.map(record => ({
      ...record,
      workerName: "Unknown Worker", // Show generic name instead of ID
    }));
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

  const calculateStats = () => {
    const presentCount = attendance.filter(a => a.status === "Present").length;
    const absentCount = attendance.filter(a => a.status === "Absent").length;
    const lateCount = attendance.filter(a => a.status === "Late").length;
    const leaveCount = attendance.filter(a => a.status === "Leave").length;
    
    // Calculate average hours worked for present records
    const presentRecords = attendance.filter(a => a.status === "Present" && a.checkIn && a.checkOut);
    const totalHours = presentRecords.reduce((total, record) => {
      const [inHours, inMinutes] = record.checkIn.split(':').map(Number);
      const [outHours, outMinutes] = record.checkOut.split(':').map(Number);
      const hoursWorked = (outHours + outMinutes/60) - (inHours + inMinutes/60);
      return total + Math.max(0, hoursWorked);
    }, 0);
    
    const averageHours = presentRecords.length > 0 ? totalHours / presentRecords.length : 0;

    setStats({
      totalRecords: attendance.length,
      presentCount,
      absentCount,
      lateCount,
      leaveCount,
      averageHours
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Present": return "#10b981";
      case "Absent": return "#ef4444";
      case "Late": return "#f59e0b";
      case "Leave": return "#3b82f6";
      case "Half Day": return "#8b5cf6";
      default: return "#6b7280";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const calculateHoursWorked = (checkIn: string, checkOut: string) => {
    if (!checkIn || !checkOut) return 0;
    
    const [inHours, inMinutes] = checkIn.split(':').map(Number);
    const [outHours, outMinutes] = checkOut.split(':').map(Number);
    
    const totalInMinutes = inHours * 60 + inMinutes;
    const totalOutMinutes = outHours * 60 + outMinutes;
    
    const minutesWorked = totalOutMinutes - totalInMinutes;
    return Math.max(0, minutesWorked / 60); // Convert to hours
  };

  const handleUpdateAttendance = async (recordId: string, updates: Partial<AttendanceRecord>) => {
    try {
      const token = await SecureStore.getItemAsync("authToken");
      await axios.put(`${getBaseUrl()}/api/attendance/${recordId}`, updates, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      Alert.alert("Success", "Attendance record updated successfully");
      setSelectedRecord(null);
      setShowModal(false);
      fetchAttendance();
    } catch (err: any) {
      console.log("Update error:", err);
      Alert.alert("Error", err.response?.data?.error || "Failed to update attendance record");
    }
  };

  const handleAddManualEntry = async () => {
    try {
      const token = await SecureStore.getItemAsync("authToken");
      await axios.post(`${getBaseUrl()}/api/attendance`, {
        workerId: selectedRecord?.workerId,
        date: new Date().toISOString().split('T')[0],
        status: editForm.status,
        checkIn: editForm.checkIn,
        checkOut: editForm.checkOut,
        notes: editForm.notes
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      Alert.alert("Success", "Manual attendance entry added successfully");
      setShowModal(false);
      setEditForm({
        status: "Present",
        checkIn: "08:00",
        checkOut: "17:00",
        notes: ""
      });
      fetchAttendance();
    } catch (err: any) {
      console.log("Add manual entry error:", err);
      Alert.alert("Error", err.response?.data?.error || "Failed to add manual entry");
    }
  };

  const renderAttendanceItem = ({ item }: { item: AttendanceRecord }) => (
    <TouchableOpacity 
      style={styles.card}
      onPress={() => {
        setSelectedRecord(item);
        setEditForm({
          status: item.status,
          checkIn: item.checkIn,
          checkOut: item.checkOut,
          notes: item.notes || ""
        });
        setShowModal(true);
      }}
    >
      <View style={styles.cardHeader}>
        <View style={styles.workerInfo}>
          <Text style={styles.workerName}>{item.workerName}</Text>
          <Text style={styles.date}>{formatDate(item.date)}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>
      
      <View style={styles.attendanceDetails}>
        <View style={styles.timeRow}>
          <View style={styles.timeBlock}>
            <Ionicons name="time-outline" size={16} color="#4f46e5" />
            <Text style={styles.timeLabel}>Check-in:</Text>
            <Text style={styles.timeValue}>{item.checkIn}</Text>
          </View>
          
          <View style={styles.timeBlock}>
            <Ionicons name="time-outline" size={16} color="#ef4444" />
            <Text style={styles.timeLabel}>Check-out:</Text>
            <Text style={styles.timeValue}>{item.checkOut}</Text>
          </View>
        </View>
        
        <View style={styles.hoursRow}>
          <Ionicons name="timer-outline" size={16} color="#6b7280" />
          <Text style={styles.hoursText}>
            Hours worked: {calculateHoursWorked(item.checkIn, item.checkOut).toFixed(1)}h
          </Text>
        </View>
        
        {item.notes && (
          <View style={styles.notesContainer}>
            <Text style={styles.notesLabel}>Notes: </Text>
            <Text style={styles.notesText}>{item.notes}</Text>
          </View>
        )}
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
        <Text style={styles.title}>Attendance Review</Text>
        <TouchableOpacity 
          onPress={() => {
            setSelectedRecord(null);
            setEditForm({
              status: "Present",
              checkIn: "08:00",
              checkOut: "17:00",
              notes: ""
            });
            setShowModal(true);
          }} 
          style={styles.addButton}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Statistics */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Ionicons name="people-outline" size={20} color="#4f46e5" />
          <Text style={styles.statNumber}>{stats.totalRecords}</Text>
          <Text style={styles.statLabel}>Total Records</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="checkmark-circle-outline" size={20} color="#10b981" />
          <Text style={styles.statNumber}>{stats.presentCount}</Text>
          <Text style={styles.statLabel}>Present</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="close-circle-outline" size={20} color="#ef4444" />
          <Text style={styles.statNumber}>{stats.absentCount}</Text>
          <Text style={styles.statLabel}>Absent</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="time-outline" size={20} color="#f59e0b" />
          <Text style={styles.statNumber}>{stats.lateCount}</Text>
          <Text style={styles.statLabel}>Late</Text>
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>Date Range:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          <FilterButton label="Today" value="today" currentValue={dateFilter} onPress={setDateFilter} />
          <FilterButton label="This Week" value="week" currentValue={dateFilter} onPress={setDateFilter} />
          <FilterButton label="This Month" value="month" currentValue={dateFilter} onPress={setDateFilter} />
          <FilterButton label="All" value="all" currentValue={dateFilter} onPress={setDateFilter} />
        </ScrollView>
        
        <Text style={styles.filterLabel}>Status:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          <FilterButton label="All" value="all" currentValue={statusFilter} onPress={setStatusFilter} />
          <FilterButton label="Present" value="Present" currentValue={statusFilter} onPress={setStatusFilter} />
          <FilterButton label="Absent" value="Absent" currentValue={statusFilter} onPress={setStatusFilter} />
          <FilterButton label="Late" value="Late" currentValue={statusFilter} onPress={setStatusFilter} />
          <FilterButton label="Leave" value="Leave" currentValue={statusFilter} onPress={setStatusFilter} />
        </ScrollView>
      </View>

      {/* Attendance List */}
      <FlatList
        data={filteredAttendance}
        keyExtractor={(item) => item._id}
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
              {dateFilter === "all" && statusFilter === "all" 
                ? "No attendance records available" 
                : `No records match your filters`}
            </Text>
          </View>
        }
      />

      {/* Edit/Add Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {selectedRecord ? "Edit Attendance" : "Add Manual Entry"}
            </Text>
            
            {selectedRecord && (
              <View style={styles.modalInfo}>
                <Text style={styles.modalInfoText}>{selectedRecord.workerName}</Text>
                <Text style={styles.modalInfoText}>{formatDate(selectedRecord.date)}</Text>
              </View>
            )}
            
            {!selectedRecord && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Select Worker:</Text>
                <View style={styles.select}>
                  {workers.length > 0 ? (
                    <ScrollView style={styles.selectOptions}>
                      {workers.map(worker => (
                        <Pressable
                          key={worker._id}
                          style={styles.selectOption}
                          onPress={() => setSelectedRecord({
                            _id: "",
                            workerId: worker._id,
                            workerName: worker.name,
                            date: new Date().toISOString().split('T')[0],
                            status: "Present",
                            checkIn: "08:00",
                            checkOut: "17:00"
                          })}
                        >
                          <Text style={styles.selectOptionText}>{worker.name}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  ) : (
                    <Text style={styles.selectPlaceholder}>No workers available</Text>
                  )}
                </View>
              </View>
            )}
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Status:</Text>
              <View style={styles.statusButtons}>
                {["Present", "Absent", "Late", "Leave", "Half Day"].map(status => (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.statusButton,
                      editForm.status === status && styles.statusButtonActive
                    ]}
                    onPress={() => setEditForm({...editForm, status: status as any})}
                  >
                    <Text style={styles.statusButtonText}>{status}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            <View style={styles.timeInputRow}>
              <View style={styles.timeInputGroup}>
                <Text style={styles.inputLabel}>Check-in:</Text>
                <TextInput
                  style={styles.timeInput}
                  value={editForm.checkIn}
                  onChangeText={(text) => setEditForm({...editForm, checkIn: text})}
                  placeholder="HH:MM"
                />
              </View>
              
              <View style={styles.timeInputGroup}>
                <Text style={styles.inputLabel}>Check-out:</Text>
                <TextInput
                  style={styles.timeInput}
                  value={editForm.checkOut}
                  onChangeText={(text) => setEditForm({...editForm, checkOut: text})}
                  placeholder="HH:MM"
                />
              </View>
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Notes:</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Additional notes (optional)"
                multiline
                numberOfLines={3}
                value={editForm.notes}
                onChangeText={(text) => setEditForm({...editForm, notes: text})}
              />
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton]}
                onPress={() => {
                  if (selectedRecord) {
                    handleUpdateAttendance(selectedRecord._id, editForm);
                  } else if (selectedRecord?.workerId) {
                    handleAddManualEntry();
                  } else {
                    Alert.alert("Error", "Please select a worker first");
                  }
                }}
              >
                <Text style={styles.saveButtonText}>
                  {selectedRecord ? "Update" : "Add Entry"}
                </Text>
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
    fontSize: 18,
    fontWeight: "bold",
    color: "#1f2937",
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  filterSection: {
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 8,
  },
  filterRow: {
    marginBottom: 16,
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
  date: {
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
  attendanceDetails: {
    marginBottom: 8,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  timeBlock: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
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
  hoursRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  hoursText: {
    fontSize: 14,
    color: "#6b7280",
    marginLeft: 4,
  },
  notesContainer: {
    flexDirection: "row",
    marginTop: 8,
    padding: 8,
    backgroundColor: "#f3f4f6",
    borderRadius: 6,
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
  },
  notesText: {
    fontSize: 14,
    color: "#6b7280",
    flex: 1,
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
  modalInfo: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
  },
  modalInfoText: {
    fontSize: 14,
    color: "#374151",
    marginBottom: 4,
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
  statusButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statusButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
    minWidth: 80,
    alignItems: "center",
  },
  statusButtonActive: {
    backgroundColor: "#4f46e5",
  },
  statusButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
  },
  timeInputRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  timeInputGroup: {
    flex: 1,
  },
  timeInput: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 12,
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
  saveButton: {
    backgroundColor: "#4f46e5",
  },
  saveButtonText: {
    color: "#fff",
    fontWeight: "500",
  },
});