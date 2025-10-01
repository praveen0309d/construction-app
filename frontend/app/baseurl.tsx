import { Platform } from "react-native";

const getBaseUrl = () => {
    const USE_TUNNEL = false; // change to true when sharing app outside Wi-Fi

  if (USE_TUNNEL) {
    return "https://9wdd2cbc-5000.inc1.devtunnels.ms"; // your tunnel URL
  }

  if (Platform.OS === "android") {
    // Android Emulator only → special loopback
    return "http://10.139.42.32:5000";
  }

  if (Platform.OS === "ios") {
    // iOS Simulator can use localhost directly
    return "http://127.0.0.1:5000";
  }

  // Real devices (Expo Go on Android/iOS) → use your PC's LAN IP
  return "http://10.139.42.32:5000"; // 👈 your IPv4 address
  // return "http://10.81.84.32:5000"; // 👈 your IPv4 address
};

export default getBaseUrl;
