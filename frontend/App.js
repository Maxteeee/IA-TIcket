import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import MockApp from './src/MockApp';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <MockApp />
    </SafeAreaProvider>
  );
}
