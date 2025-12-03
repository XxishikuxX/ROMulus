import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';

export default function SplashScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>👑</Text>
      <Text style={styles.title}>ROMulus</Text>
      <Text style={styles.subtitle}>Web-Based Emulator</Text>
      <ActivityIndicator size="large" color="#3b82f6" style={styles.loader} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#030305' },
  logo: { fontSize: 80, marginBottom: 20 },
  title: { fontSize: 36, fontWeight: 'bold', color: '#f4f4f5', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#ec4899', marginBottom: 40 },
  loader: { marginTop: 20 },
});
