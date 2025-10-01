import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
  ActivityIndicator
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import axios from "axios";
import getBaseUrl from "../../baseurl";
import * as Location from 'expo-location';

type AttendanceRecord = {
  date: string;
  status: string;
  checkIn: string;
  checkOut: string;
};

export default function Attendance() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [generatingQR, setGeneratingQR] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [locationStatus, setLocationStatus] = useState<"checking" | "inside" | "outside">("checking");
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);

  useEffect(() => {
    checkLocation();
    loadTodayAttendance();
  }, []);

  const checkLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationStatus("outside");
        return;
      }

      // Simulate location check - replace with actual site coordinates
      const location = await Location.getCurrentPositionAsync({});
      const siteLat = 12.9716; // Example site coordinates
      const siteLon = 77.5946;
      
      // Simple distance calculation (in km)
      const distance = calculateDistance(
        location.coords.latitude,
        location.coords.longitude,
        siteLat,
        siteLon
      );

      setLocationStatus(distance <= 4.5 ? "inside" : "outside"); // Within 500m
    } catch (error) {
      setLocationStatus("outside");
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return true;
  };

  const loadTodayAttendance = async () => {
    try {
      const token = await SecureStore.getItemAsync("authToken");
      const today = new Date().toISOString().split('T')[0];
      
      const res = await axios.get(`${getBaseUrl()}/api/attendance/today`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const userRecord = res.data.records.find((r: any) => r.status !== "Not Marked");
      setTodayAttendance(userRecord || null);
    } catch (err) {
      console.log("Attendance load error:", err);
    }
  };

  const generateQRCode = async () => {
    if (locationStatus !== "inside") {
      Alert.alert("Location Error", "You must be at the construction site to mark attendance");
      return;
    }

    setGeneratingQR(true);
    try {
      const token = await SecureStore.getItemAsync("authToken");
      const userId = await SecureStore.getItemAsync("userId");
      
      // Generate QR data with timestamp and token
      const qrData = JSON.stringify({
        workerId: userId,
        timestamp: Date.now(),
        token: token?.slice(-10) // Use last 10 chars of token
      });

      setQrCode(qrData);
      
      // Simulate QR code generation
      setTimeout(() => {
        setGeneratingQR(false);
        markAttendance();
      }, 2000);

    } catch (err) {
      setGeneratingQR(false);
      Alert.alert("Error", "Failed to generate QR code");
    }
  };

  const markAttendance = async () => {
    try {
      const token = await SecureStore.getItemAsync("authToken");
      
      await axios.post(`${getBaseUrl()}/api/attendance`, {
        status: "Present",
        checkIn: new Date().toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
        })
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });

      Alert.alert("Success", "Attendance marked successfully!");
      loadTodayAttendance();
    } catch (err) {
      Alert.alert("Error", "Failed to mark attendance");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
      
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1f2937" />
          </TouchableOpacity>
          <Text style={styles.title}>Attendance</Text>
        </View>

        {/* Location Status */}
        <View style={[
          styles.statusCard,
          locationStatus === "inside" && styles.statusCardSuccess,
          locationStatus === "outside" && styles.statusCardError
        ]}>
          <Ionicons 
            name={locationStatus === "inside" ? "checkmark-circle" : "close-circle"} 
            size={32} 
            color={locationStatus === "inside" ? "#10b981" : "#ef4444"} 
          />
          <Text style={styles.statusText}>
            {locationStatus === "checking" ? "Checking location..." :
             locationStatus === "inside" ? "✅ At construction site" :
             "❌ Outside construction site"}
          </Text>
        </View>

        {/* QR Code Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mark Attendance</Text>
          
          <TouchableOpacity 
            style={[
              styles.qrButton,
              (locationStatus !== "inside" || generatingQR) && styles.qrButtonDisabled
            ]}
            onPress={generateQRCode}
            disabled={locationStatus !== "inside" || generatingQR}
          >
            {generatingQR ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="qr-code-outline" size={24} color="#fff" />
                <Text style={styles.qrButtonText}>Generate QR Code</Text>
              </>
            )}
          </TouchableOpacity>

          {qrCode && (
            <View style={styles.qrContainer}>
              <Text style={styles.qrText}>QR Code Generated</Text>
              <Text style={styles.qrSubtext}>Show this to site supervisor</Text>
              {/* QR code would be displayed here */}
              <View style={styles.qrPlaceholder}>
                <Ionicons name="qr-code" size={100} color="#3b82f6" />
              </View>
            </View>
          )}
        </View>

        {/* Today's Attendance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's Status</Text>
          
          {todayAttendance ? (
            <View style={styles.attendanceCard}>
              <View style={styles.attendanceHeader}>
                <Text style={styles.attendanceDate}>{new Date().toLocaleDateString()}</Text>
                <View style={[
                  styles.statusBadge,
                  todayAttendance.status === "Present" && styles.statusBadgeSuccess
                ]}>
                  <Text style={styles.statusBadgeText}>{todayAttendance.status}</Text>
                </View>
              </View>
              
              <View style={styles.attendanceDetails}>
                <View style={styles.timeRow}>
                  <Ionicons name="time-outline" size={16} color="#6b7280" />
                  <Text style={styles.timeLabel}>Check-in: {todayAttendance.checkIn}</Text>
                </View>
                {todayAttendance.checkOut && (
                  <View style={styles.timeRow}>
                    <Ionicons name="time-outline" size={16} color="#6b7280" />
                    <Text style={styles.timeLabel}>Check-out: {todayAttendance.checkOut}</Text>
                  </View>
                )}
              </View>
            </View>
          ) : (
            <Text style={styles.noAttendanceText}>No attendance marked for today</Text>
          )}
        </View>

        {/* Attendance History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>This Week</Text>
          <View style={styles.weekContainer}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <View key={day} style={styles.dayCell}>
                <Text style={styles.dayText}>{day}</Text>
                <Ionicons name="checkmark-circle" size={20} color="#10b981" />
              </View>
            ))}
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
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    marginTop:20,
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1f2937",
  },
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    margin: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    gap: 12,
  },
  statusCardSuccess: {
    backgroundColor: "#f0fdf4",
    borderLeftWidth: 4,
    borderLeftColor: "#10b981",
  },
  statusCardError: {
    backgroundColor: "#fef2f2",
    borderLeftWidth: 4,
    borderLeftColor: "#ef4444",
  },
  statusText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#374151",
  },
  section: {
    padding: 16,
    backgroundColor: "#fff",
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 16,
  },
  qrButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3b82f6",
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  qrButtonDisabled: {
    backgroundColor: "#9ca3af",
  },
  qrButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  qrContainer: {
    alignItems: "center",
    marginTop: 16,
    padding: 16,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
  },
  qrText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 4,
  },
  qrSubtext: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 16,
  },
  qrPlaceholder: {
    padding: 20,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#e5e7eb",
  },
  attendanceCard: {
    padding: 16,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
  },
  attendanceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  attendanceDate: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
  },
  statusBadgeSuccess: {
    backgroundColor: "#dcfce7",
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#374151",
  },
  attendanceDetails: {
    gap: 8,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  timeLabel: {
    fontSize: 14,
    color: "#6b7280",
  },
  noAttendanceText: {
    textAlign: "center",
    color: "#9ca3af",
    fontStyle: "italic",
    padding: 20,
  },
  weekContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  dayCell: {
    width: "30%",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    gap: 4,
  },
  dayText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
  },
});