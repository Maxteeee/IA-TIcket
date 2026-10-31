import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import MockApp from './src/MockApp';
import { MockSessionProvider } from './src/session/MockSessionProvider';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <MockSessionProvider>
        <MockApp />
      </MockSessionProvider>
    </SafeAreaProvider>
  );
}
