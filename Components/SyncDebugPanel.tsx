import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Toast from 'react-native-toast-message';
import ValidText from '../Abstracts/ValidText';
import { Colors, FontSize } from '../Theme';
import { clearFailedItems, getSyncQueueStats } from '../services/sync/clearSyncQueue';

/**
 * Debug panel for sync queue management
 * Add this to Dashboard for debugging sync issues
 */
const SyncDebugPanel: React.FC = () => {
  const [stats, setStats] = useState({ total: 0, pending: 0, synced: 0, failed: 0 });
  const [loading, setLoading] = useState(false);

  const loadStats = async () => {
    try {
      const queueStats = await getSyncQueueStats();
      setStats(queueStats);
    } catch (error) {
      console.error('[SyncDebug] Failed to load stats:', error);
    }
  };

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const handleClearFailed = async () => {
    if (loading) return;
    
    setLoading(true);
    try {
      const cleared = await clearFailedItems(10);
      Toast.show({
        type: 'success',
        text1: 'Cleanup Complete',
        text2: `Removed ${cleared} stuck items`,
        position: 'top',
      });
      await loadStats();
    } catch (error) {
      console.error('[SyncDebug] Cleanup failed:', error);
      Toast.show({
        type: 'error',
        text1: 'Cleanup Failed',
        text2: 'Please try again',
        position: 'top',
      });
    } finally {
      setLoading(false);
    }
  };

  // Only show if there are failed items
  if (stats.failed === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Icon name="warning" size={20} color={Colors.orange} />
        <ValidText text="Sync Issues Detected" style={styles.title} />
      </View>
      
      <View style={styles.stats}>
        <View style={styles.statItem}>
          <ValidText text={`${stats.pending}`} style={styles.statValue} />
          <ValidText text="Pending" style={styles.statLabel} />
        </View>
        <View style={styles.statItem}>
          <ValidText text={`${stats.failed}`} style={styles.statValue} />
          <ValidText text="Failed" style={styles.statLabel} />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleClearFailed}
        disabled={loading}
      >
        <Icon name="delete-sweep" size={18} color={Colors.white} />
        <ValidText 
          text={loading ? "Clearing..." : "Clear Failed Items"} 
          style={styles.buttonText} 
        />
      </TouchableOpacity>

      <ValidText 
        text="Items with 10+ retries will be removed" 
        style={styles.hint} 
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: Colors.orange,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: FontSize.H3,
    fontWeight: '600',
    color: Colors.orange,
    marginLeft: 8,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: FontSize.H2,
    fontWeight: '700',
    color: Colors.orange,
  },
  statLabel: {
    fontSize: FontSize.Caption,
    color: Colors.grey,
    marginTop: 4,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.orange,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: Colors.white,
    fontSize: FontSize.Body,
    fontWeight: '600',
    marginLeft: 8,
  },
  hint: {
    fontSize: FontSize.Caption,
    color: Colors.grey,
    textAlign: 'center',
    marginTop: 8,
  },
});

export default SyncDebugPanel;
