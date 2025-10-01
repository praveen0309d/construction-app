import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image
} from "react-native";
import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";
import axios from "axios";
import getBaseUrl from "../app/baseurl";
import { useRouter, useRootNavigationState } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

type LoginCredentials = {
  email: string;
  password: string;
};

type AuthResponse = {
  token: string;
  role: string;
  user: {
    name: string;
    email: string;
  };
};

type BiometricAvailability = {
  hasHardware: boolean;
  isEnrolled: boolean;
  supportedTypes: LocalAuthentication.AuthenticationType[];
};

export default function LoginPage() {
  const [credentials, setCredentials] = useState<LoginCredentials>({
    email: "",
    password: ""
  });
  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState<BiometricAvailability | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isCheckingToken, setIsCheckingToken] = useState(true);

  const router = useRouter();
  const rootNavigation = useRootNavigationState();

  useEffect(() => {
    checkBiometricAvailability();
    if (rootNavigation?.key) {
      checkStoredToken();
    }
  }, [rootNavigation?.key]);

  const checkBiometricAvailability = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      
      setBiometricAvailable({
        hasHardware,
        isEnrolled,
        supportedTypes
      });
    } catch (error) {
      console.error("Error checking biometric availability:", error);
    }
  };

  const checkStoredToken = async () => {
    try {
      const savedToken = await SecureStore.getItemAsync("authToken");
      const savedRole = await SecureStore.getItemAsync("role");

      if (savedToken && savedRole) {
        // Verify token is still valid by making a simple API call
        try {
          await axios.get(`${getBaseUrl()}/api/profile`, {
            headers: { Authorization: `Bearer ${savedToken}` },
          });
          redirectByRole(savedRole);
        } catch (error) {
          // Token is invalid, clear stored credentials
          await SecureStore.deleteItemAsync("authToken");
          await SecureStore.deleteItemAsync("role");
        }
      }
    } catch (error) {
      console.error("Error checking stored token:", error);
    } finally {
      setIsCheckingToken(false);
    }
  };

  const handleLogin = async () => {
    if (!credentials.email || !credentials.password) {
      Alert.alert("Error", "Please enter both email and password");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post<AuthResponse>(`${getBaseUrl()}/api/login`, credentials);
      
      await SecureStore.setItemAsync("authToken", res.data.token);
      await SecureStore.setItemAsync("role", res.data.role);
      await SecureStore.setItemAsync("userEmail", credentials.email);
      
      redirectByRole(res.data.role);
    } catch (err: any) {
      console.log("Login error:", err);
      Alert.alert(
        "Login Failed", 
        err.response?.data?.error || "Invalid email or password. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleFingerprintLogin = async () => {
    setBiometricLoading(true);
    try {
      const savedToken = await SecureStore.getItemAsync("authToken");
      const savedRole = await SecureStore.getItemAsync("role");
      const savedEmail = await SecureStore.getItemAsync("userEmail");

      if (!savedToken || !savedRole || !savedEmail) {
        Alert.alert(
          "Biometric Login", 
          "No saved login found. Please login with email and password first to enable fingerprint login."
        );
        return;
      }

      // Check if biometric authentication is available
      if (!biometricAvailable?.hasHardware || !biometricAvailable?.isEnrolled) {
        Alert.alert(
          "Biometric Login", 
          "Fingerprint authentication is not available on this device or no fingerprints are enrolled."
        );
        return;
      }

      const authResult = await LocalAuthentication.authenticateAsync({
        promptMessage: "Authenticate to login",
        fallbackLabel: "Use password instead",
        disableDeviceFallback: false,
        cancelLabel: "Cancel"
      });

      if (authResult.success) {
        // Verify token is still valid
        try {
          await axios.get(`${getBaseUrl()}/api/profile`, {
            headers: { Authorization: `Bearer ${savedToken}` },
          });
          redirectByRole(savedRole);
        } catch (error) {
          Alert.alert(
            "Session Expired", 
            "Your session has expired. Please login with email and password."
          );
          await SecureStore.deleteItemAsync("authToken");
          await SecureStore.deleteItemAsync("role");
          await SecureStore.deleteItemAsync("userEmail");
        }
      } else {
        if (authResult.error !== "user_cancel") {
          Alert.alert("Authentication Failed", "Fingerprint authentication failed. Please try again.");
        }
      }
    } catch (error) {
      console.error("Fingerprint login error:", error);
      Alert.alert("Error", "An error occurred during fingerprint authentication.");
    } finally {
      setBiometricLoading(false);
    }
  };

  const redirectByRole = (userRole: string) => {
    if (!rootNavigation?.key) return;
    
    switch (userRole) {
      case "Worker":
        router.replace("/pages/workers/workerHome");
        break;
      case "Supervisor":
        router.replace("/pages/supervisor/supervisorHome");
        break;
      case "Manager":
        router.replace("/pages/manager/managerHome");
        break;
      default:
        Alert.alert("Error", "Unknown user role");
    }
  };

  const canUseBiometric = biometricAvailable?.hasHardware && biometricAvailable?.isEnrolled;

  if (isCheckingToken) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4f46e5" />
        <Text style={styles.loadingText}>Checking authentication...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Construction Management</Text>
          <Text style={styles.subtitle}>Sign in to your account</Text>
        </View>

        {/* Login Form */}
        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color="#6b7280" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor="#9ca3af"
              value={credentials.email}
              onChangeText={(text) => setCredentials({...credentials, email: text})}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#6b7280" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#9ca3af"
              value={credentials.password}
              onChangeText={(text) => setCredentials({...credentials, password: text})}
              secureTextEntry={!showPassword}
              autoComplete="password"
            />
            <TouchableOpacity 
              onPress={() => setShowPassword(!showPassword)}
              style={styles.visibilityToggle}
            >
              <Ionicons 
                name={showPassword ? "eye-off-outline" : "eye-outline"} 
                size={20} 
                color="#6b7280" 
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="log-in-outline" size={20} color="#fff" />
                <Text style={styles.loginButtonText}>Sign In</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Divider */}
          {canUseBiometric && (
            <View style={styles.dividerContainer}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.divider} />
            </View>
          )}

          {/* Biometric Login */}
          {canUseBiometric && (
            <TouchableOpacity 
              style={[styles.biometricButton, biometricLoading && styles.biometricButtonDisabled]}
              onPress={handleFingerprintLogin}
              disabled={biometricLoading}
            >
              {biometricLoading ? (
                <ActivityIndicator color="#4f46e5" />
              ) : (
                <>
                  <Ionicons name="finger-print-outline" size={20} color="#4f46e5" />
                  <Text style={styles.biometricButtonText}>Sign in with Fingerprint</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Demo Accounts Hint */}
          <View style={styles.demoHint}>
            <Text style={styles.demoHintTitle}>Demo Accounts:</Text>
            <Text style={styles.demoHintText}>Manager: praveen@example.com / praveen123</Text>
            <Text style={styles.demoHintText}>Supervisor: tamil@gmail.com / tamil123</Text>
            <Text style={styles.demoHintText}>Worker: sadik@gmail.com / sadik123</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
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
    alignItems: "center",
    marginBottom: 40,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
  },
  formContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    marginBottom: 16,
    paddingHorizontal: 12,
    height: 50,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#1f2937",
  },
  visibilityToggle: {
    padding: 4,
  },
  loginButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4f46e5",
    borderRadius: 8,
    padding: 16,
    marginTop: 8,
    gap: 8,
  },
  loginButtonDisabled: {
    backgroundColor: "#9ca3af",
  },
  loginButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: "#e5e7eb",
  },
  dividerText: {
    marginHorizontal: 16,
    color: "#6b7280",
    fontSize: 14,
  },
  biometricButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#4f46e5",
    borderRadius: 8,
    padding: 16,
    gap: 8,
  },
  biometricButtonDisabled: {
    opacity: 0.5,
  },
  biometricButtonText: {
    color: "#4f46e5",
    fontSize: 16,
    fontWeight: "600",
  },
  demoHint: {
    marginTop: 24,
    padding: 16,
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
  },
  demoHintTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  demoHintText: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 4,
  },
});