import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Button, StyleSheet } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";
import axios from "axios";
import getBaseUrl from "../../baseurl";
import { useNavigation } from "@react-navigation/native";
import { useRouter } from "expo-router";

export default function App() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<string>("");

  const navigation = useNavigation<any>();

  useEffect(() => {
    checkStoredToken();
  }, []);

  const checkStoredToken = async () => {
    const savedToken = await SecureStore.getItemAsync("authToken");
    const savedRole = await SecureStore.getItemAsync("role");

    if (savedToken && savedRole) {
      setToken(savedToken);
      setRole(savedRole);
      redirectByRole(savedRole);
    }
  };

  const handleFingerprintLogin = async () => {
    const savedToken = await SecureStore.getItemAsync("authToken");
    const savedRole = await SecureStore.getItemAsync("role");

    if (!savedToken || !savedRole) {
      alert("No saved login. Please login with email/password first.");
      return;
    }

    const bio = await LocalAuthentication.authenticateAsync({
      promptMessage: "Login with Fingerprint",
      fallbackEnabled: true,
    });

    if (bio.success) {
      setToken(savedToken);
      setRole(savedRole);
      redirectByRole(savedRole!);
    } else {
      alert("Fingerprint authentication failed!");
    }
  };

  const handleLogin = async () => {
    try {
      const res = await axios.post(`${getBaseUrl()}/api/login`, {
        email,
        password: pw,
      });
      await SecureStore.setItemAsync("authToken", res.data.token);
      await SecureStore.setItemAsync("role", res.data.role);
      setToken(res.data.token);
      setRole(res.data.role);
      redirectByRole(res.data.role);
    } catch (err) {
      alert("Login failed!");
    }
  };
const router = useRouter();
  // ✅ Redirect based on role
const redirectByRole = (userRole: string) => {
  switch (userRole) {
    case "Worker":
      router.replace("/pages/workers/WorkerHome");
      break;
    case "Supervisor":
      router.replace("/pages/Supervisor/SupervisorHome");
      break;
    case "Manager":
      router.replace("/pages/Manager/ManagerHome");
      break;
    default:
      alert("Unknown role");
  }
};


  return (
    <View style={styles.container}>
      {!token ? (
        <>
          <Text style={styles.title}>Construction App Login</Text>
          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            secureTextEntry
            value={pw}
            onChangeText={setPw}
          />
          <Button title="Login" onPress={handleLogin} />
          <View style={{ marginTop: 15 }}>
            <Button title="Login with Fingerprint" onPress={handleFingerprintLogin} />
          </View>
        </>
      ) : (
        <Text style={styles.title}>Redirecting...</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 20, marginBottom: 20 },
  input: { borderWidth: 1, padding: 10, margin: 5, width: "80%" },
});
