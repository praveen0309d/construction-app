// pages/manager/emergency.tsx
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
  Pressable,
  Image
} from "react-native";
import axios from "axios";
import * as SecureStore from "expo-secure-store";
import getBaseUrl from "../../baseurl";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from 'expo-image-picker';

type Emergency = {
  _id: string;
  workerId: string;
  workerName: string;
  type: string;
  location: string;
  description?: string;
  photoUrl?: string;
  assignedTo: string;
  assignedToName: string;
  status: string;
  priority: string;
  timestamp: string;
  reportedByName: string;
  resolved?: boolean;
  resolution?: string;
  resolvedAt?: string;
};

type EmergencyStats = {
  totalEmergencies: number;
  todayEmergencies: number;
  openEmergencies: number;
  inProgressEmergencies: number;
  resolvedEmergencies: number;
  byType: {
    SOS: number;
    Accident: number;
    Medical: number;
    Safety: number;
    Other: number;
  };
};

type AssignableUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  display: string;
};

type EmergencyFilter = "all" | "open" | "in-progress" | "resolved";

export default function EmergencyPage() {
  const router = useRouter();
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [filteredEmergencies, setFilteredEmergencies] = useState<Emergency[]>([]);
  const [stats, setStats] = useState<EmergencyStats>({
    totalEmergencies: 0,
    todayEmergencies: 0,
    openEmergencies: 0,
    inProgressEmergencies: 0,
    resolvedEmergencies: 0,
    byType: { SOS: 0, Accident: 0, Medical: 0, Safety: 0, Other: 0 }
  });
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<EmergencyFilter>("all");
  const [showModal, setShowModal] = useState(false);
  const [selectedEmergency, setSelectedEmergency] = useState<Emergency | null>(null);
  const [image, setImage] = useState<string | null>(null);

  // New emergency form state
  const [newEmergency, setNewEmergency] = useState({
    type: "SOS",
    location: "",
    description: "",
    workerId: "",
    workerName: "",
    priority: "Medium"
  });

  useEffect(() => {
    fetchEmergencyData();
    fetchAssignableUsers();
  }, []);

  useEffect(() => {
    filterEmergencies();
  }, [emergencies, statusFilter]);

  const fetchEmergencyData = async () => {
    try {
      setLoading(true);
      const token = await SecureStore.getItemAsync("authToken");
      
      const [emergenciesRes, statsRes] = await Promise.all([
        axios.get(`${getBaseUrl()}/api/emergencies`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${getBaseUrl()}/api/emergencies/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      ]);
      
      setEmergencies(emergenciesRes.data);
      setStats(statsRes.data);
      setLoading(false);
      setRefreshing(false);
    } catch (err) {
      console.log("Emergency data load error:", err);
      Alert.alert("Error", "Failed to load emergency data.");
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchAssignableUsers = async () => {
    try {
      const token = await SecureStore.getItemAsync("authToken");
      const res = await axios.get(`${getBaseUrl()}/api/emergencies/assignable-users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAssignableUsers(res.data);
    } catch (err) {
      console.log("Assignable users load error:", err);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchEmergencyData();
  };

  const filterEmergencies = () => {
    let filtered = [...emergencies];
    
    switch (statusFilter) {
      case "open":
        filtered = filtered.filter(emergency => emergency.status === "Open");
        break;
      case "in-progress":
        filtered = filtered.filter(emergency => emergency.status === "In Progress");
        break;
      case "resolved":
        filtered = filtered.filter(emergency => emergency.resolved);
        break;
      default:
        // "all" - no filtering
        break;
    }
    
    setFilteredEmergencies(filtered);
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled) {
        setImage(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to pick image");
    }
  };

  const handleCreateEmergency = async () => {
    try {
      const token = await SecureStore.getItemAsync("authToken");
      
      // For now, we'll just use the image URI directly
      // In a real app, you'd upload this to a cloud storage service
      const photoUrl = image || "";
      
      const res = await axios.post(`${getBaseUrl()}/api/emergencies`, {
        ...newEmergency,
        photoUrl
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      Alert.alert("Success", "Emergency reported successfully");
      setShowModal(false);
      setNewEmergency({
        type: "SOS",
        location: "",
        description: "",
        workerId: "",
        workerName: "",
        priority: "Medium"
      });
      setImage(null);
      fetchEmergencyData();
    } catch (err: any) {
      console.log("Emergency creation error:", err);
      Alert.alert("Error", err.response?.data?.error || "Failed to report emergency");
    }
  };

  const handleUpdateEmergency = async (emergencyId: string, updates: any) => {
    try {
      const token = await SecureStore.getItemAsync("authToken");
      const res = await axios.put(`${getBaseUrl()}/api/emergencies/${emergencyId}`, updates, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      Alert.alert("Success", "Emergency updated successfully");
      setSelectedEmergency(null);
      fetchEmergencyData();
    } catch (err: any) {
      console.log("Emergency update error:", err);
      Alert.alert("Error", err.response?.data?.error || "Failed to update emergency");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Open": return "#ef4444";
      case "In Progress": return "#f59e0b";
      case "Resolved": return "#10b981";
      default: return "#6b7280";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "Critical": return "#dc2626";
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
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderEmergencyItem = ({ item }: { item: Emergency }) => (
    <TouchableOpacity 
      style={styles.card}
      onPress={() => setSelectedEmergency(item)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.emergencyInfo}>
          <Text style={styles.emergencyType}>{item.type}</Text>
          <Text style={styles.timestamp}>{formatDate(item.timestamp)}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>
      
      <View style={styles.priorityBadge}>
        <Text style={[styles.priorityText, { color: getPriorityColor(item.priority) }]}>
          {item.priority} Priority
        </Text>
      </View>
      
      <View style={styles.emergencyDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="location-outline" size={16} color="#6b7280" />
          <Text style={styles.detailText}>{item.location}</Text>
        </View>
        
        {item.workerName && (
          <View style={styles.detailRow}>
            <Ionicons name="person-outline" size={16} color="#6b7280" />
            <Text style={styles.detailText}>Worker: {item.workerName}</Text>
          </View>
        )}
        
        {item.description && (
          <View style={styles.detailRow}>
            <Ionicons name="document-text-outline" size={16} color="#6b7280" />
            <Text style={styles.detailText}>{item.description}</Text>
          </View>
        )}
        
        <View style={styles.detailRow}>
          <Ionicons name="person-circle-outline" size={16} color="#6b7280" />
          <Text style={styles.detailText}>Assigned to: {item.assignedToName}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Ionicons name="alert-circle-outline" size={16} color="#6b7280" />
          <Text style={styles.detailText}>Reported by: {item.reportedByName}</Text>
        </View>
      </View>
      
      {item.photoUrl && (
        <View style={styles.photoContainer}>
          <Image source={{ uri: item.photoUrl }} style={styles.photo} />
        </View>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4f46e5" />
          <Text style={styles.loadingText}>Loading Emergency Data...</Text>
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
        <Text style={styles.title}>Emergency Management</Text>
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
          <Ionicons name="warning-outline" size={20} color="#ef4444" />
          <Text style={styles.statNumber}>{stats.totalEmergencies}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="today-outline" size={20} color="#f59e0b" />
          <Text style={styles.statNumber}>{stats.todayEmergencies}</Text>
          <Text style={styles.statLabel}>Today</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="alert-circle-outline" size={20} color="#dc2626" />
          <Text style={styles.statNumber}>{stats.openEmergencies}</Text>
          <Text style={styles.statLabel}>Open</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="checkmark-circle-outline" size={20} color="#10b981" />
          <Text style={styles.statNumber}>{stats.resolvedEmergencies}</Text>
          <Text style={styles.statLabel}>Resolved</Text>
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
          style={[styles.filterButton, statusFilter === "open" && styles.filterButtonActive]}
          onPress={() => setStatusFilter("open")}
        >
          <Text style={[styles.filterButtonText, statusFilter === "open" && styles.filterButtonTextActive]}>
            Open
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, statusFilter === "in-progress" && styles.filterButtonActive]}
          onPress={() => setStatusFilter("in-progress")}
        >
          <Text style={[styles.filterButtonText, statusFilter === "in-progress" && styles.filterButtonTextActive]}>
            In Progress
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

      {/* Emergencies List */}
      <FlatList
        data={filteredEmergencies}
        keyExtractor={(item) => item._id}
        renderItem={renderEmergencyItem}
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
            <Ionicons name="warning-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyText}>No emergency reports found</Text>
            <Text style={styles.emptySubtext}>
              {statusFilter === "all" 
                ? "No emergencies have been reported yet" 
                : `No ${statusFilter} emergencies found`}
            </Text>
          </View>
        }
      />

      {/* Emergency Detail Modal */}
      {selectedEmergency && (
        <Modal
          visible={!!selectedEmergency}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setSelectedEmergency(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Emergency Details</Text>
                <TouchableOpacity onPress={() => setSelectedEmergency(null)}>
                  <Ionicons name="close" size={24} color="#6b7280" />
                </TouchableOpacity>
              </View>
              
              <ScrollView>
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Type: {selectedEmergency.type}</Text>
                  <Text style={styles.detailLabel}>Location: {selectedEmergency.location}</Text>
                  <Text style={styles.detailLabel}>Priority: 
                    <Text style={{ color: getPriorityColor(selectedEmergency.priority) }}>
                      {" "}{selectedEmergency.priority}
                    </Text>
                  </Text>
                  <Text style={styles.detailLabel}>Status: 
                    <Text style={{ color: getStatusColor(selectedEmergency.status) }}>
                      {" "}{selectedEmergency.status}
                    </Text>
                  </Text>
                  <Text style={styles.detailLabel}>Reported: {formatDate(selectedEmergency.timestamp)}</Text>
                  <Text style={styles.detailLabel}>Reported by: {selectedEmergency.reportedByName}</Text>
                </View>

                {selectedEmergency.workerName && (
                  <View style={styles.detailSection}>
                    <Text style={styles.sectionTitle}>Worker Information</Text>
                    <Text style={styles.detailText}>{selectedEmergency.workerName}</Text>
                  </View>
                )}

                {selectedEmergency.description && (
                  <View style={styles.detailSection}>
                    <Text style={styles.sectionTitle}>Description</Text>
                    <Text style={styles.detailText}>{selectedEmergency.description}</Text>
                  </View>
                )}

                {selectedEmergency.photoUrl && (
                  <View style={styles.detailSection}>
                    <Text style={styles.sectionTitle}>Photo Evidence</Text>
                    <Image source={{ uri: selectedEmergency.photoUrl }} style={styles.detailPhoto} />
                  </View>
                )}

                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>Assignment</Text>
                  <Text style={styles.detailText}>Assigned to: {selectedEmergency.assignedToName}</Text>
                  
                  {!selectedEmergency.resolved && (
                    <View style={styles.actionButtons}>
                      <TouchableOpacity 
                        style={styles.assignButton}
                        onPress={() => {
                          Alert.alert(
                            "Assign Emergency",
                            "Select user to assign:",
                            assignableUsers.map(user => ({
                              text: user.display,
                              onPress: () => handleUpdateEmergency(selectedEmergency._id, { 
                                assignedTo: user.id,
                                status: "In Progress"
                              })
                            }))
                          );
                        }}
                      >
                        <Ionicons name="person-add-outline" size={16} color="#3b82f6" />
                        <Text style={styles.assignButtonText}>Reassign</Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={styles.resolveButton}
                        onPress={() => {
                          Alert.prompt(
                            "Resolve Emergency",
                            "Enter resolution details:",
                            [
                              { text: "Cancel", style: "cancel" },
                              {
                                text: "Resolve",
                                onPress: (resolution) => handleUpdateEmergency(selectedEmergency._id, { 
                                  resolved: true,
                                  resolution,
                                  status: "Resolved"
                                })
                              }
                            ]
                          );
                        }}
                      >
                        <Ionicons name="checkmark-circle-outline" size={16} color="#10b981" />
                        <Text style={styles.resolveButtonText}>Resolve</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {selectedEmergency.resolution && (
                  <View style={styles.detailSection}>
                    <Text style={styles.sectionTitle}>Resolution</Text>
                    <Text style={styles.resolutionText}>{selectedEmergency.resolution}</Text>
                    {selectedEmergency.resolvedAt && (
                      <Text style={styles.detailLabel}>
                        Resolved at: {formatDate(selectedEmergency.resolvedAt)}
                      </Text>
                    )}
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* New Emergency Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Report New Emergency</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Emergency Type:</Text>
              <View style={styles.typeButtons}>
                {["SOS", "Accident", "Medical", "Safety", "Other"].map(type => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.typeButton, newEmergency.type === type && styles.typeButtonActive]}
                    onPress={() => setNewEmergency({...newEmergency, type})}
                  >
                    <Text style={styles.typeButtonText}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Location*"
              value={newEmergency.location}
              onChangeText={(text) => setNewEmergency({...newEmergency, location: text})}
            />

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Description (Optional)"
              multiline
              numberOfLines={3}
              value={newEmergency.description}
              onChangeText={(text) => setNewEmergency({...newEmergency, description: text})}
            />

            <TextInput
              style={styles.input}
              placeholder="Worker Name/ID (Optional)"
              value={newEmergency.workerName}
              onChangeText={(text) => setNewEmergency({...newEmergency, workerName: text})}
            />

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Priority:</Text>
              <View style={styles.priorityButtons}>
                {["Critical", "High", "Medium", "Low"].map(priority => (
                  <TouchableOpacity
                    key={priority}
                    style={[styles.priorityButton, newEmergency.priority === priority && styles.priorityButtonActive]}
                    onPress={() => setNewEmergency({...newEmergency, priority})}
                  >
                    <Text style={styles.priorityButtonText}>{priority}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity style={styles.photoButton} onPress={pickImage}>
              <Ionicons name="camera-outline" size={20} color="#4f46e5" />
              <Text style={styles.photoButtonText}>
                {image ? "Photo Selected" : "Attach Photo (Optional)"}
              </Text>
            </TouchableOpacity>

            {image && (
              <Image source={{ uri: image }} style={styles.previewImage} />
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.createButton]}
                onPress={handleCreateEmergency}
                disabled={!newEmergency.location}
              >
                <Text style={styles.createButtonText}>Report Emergency</Text>
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
    paddingTop:25,
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
  emergencyInfo: {
    flex: 1,
  },
  emergencyType: {
    fontSize: 18,
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
  priorityBadge: {
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: "500",
  },
  emergencyDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  detailText: {
    fontSize: 14,
    color: "#6b7280",
    marginLeft: 6,
    flex: 1,
  },
  photoContainer: {
    marginTop: 8,
  },
  photo: {
    width: '100%',
    height: 200,
    borderRadius: 8,
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
  detailSection: {
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 14,
    color: "#374151",
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  detailPhoto: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginTop: 8,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  assignButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    padding: 8,
    borderRadius: 6,
    gap: 4,
  },
  assignButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#3b82f6",
  },
  resolveButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    padding: 8,
    borderRadius: 6,
    gap: 4,
  },
  resolveButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#10b981",
  },
  resolutionText: {
    fontSize: 14,
    color: "#16a34a",
    fontStyle: "italic",
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
  typeButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  typeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
  },
  typeButtonActive: {
    backgroundColor: "#4f46e5",
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
  },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: "top",
  },
  priorityButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  priorityButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
  },
  priorityButtonActive: {
    backgroundColor: "#4f46e5",
  },
  priorityButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
  },
  photoButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#4f46e5",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  photoButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#4f46e5",
  },
  previewImage: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    marginBottom: 16,
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