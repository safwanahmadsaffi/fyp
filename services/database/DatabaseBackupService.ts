import { Platform, NativeModules } from 'react-native';
import SQLite from 'react-native-sqlite-storage';
import RNFS from 'react-native-fs';
import { zip, unzip } from 'react-native-zip-archive';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface BackupConfig {
  backupPath: string;
  maxBackups: number;
  compressBackups: boolean;
  backupInterval: number; // milliseconds
}

interface BackupMetadata {
  lastBackupTime: number;
  backups: {
    path: string;
    timestamp: number;
    size: number;
  }[];
}

export class DatabaseBackupService {
  private static instance: DatabaseBackupService;
  private config: BackupConfig;
  private backupTimer: ReturnType<typeof setInterval> | null = null;
  private readonly BACKUP_META_KEY = 'db_backup_metadata_v1';

  private constructor() {
    this.config = {
      backupPath: Platform.select({
        ios: `${RNFS.DocumentDirectoryPath}/backups`,
        android: `${RNFS.ExternalDirectoryPath}/backups`,
      }) as string,
      maxBackups: 5,
      compressBackups: true,
      backupInterval: 24 * 60 * 60 * 1000, // 24 hours
    };
  }

  public static getInstance(): DatabaseBackupService {
    if (!DatabaseBackupService.instance) {
      DatabaseBackupService.instance = new DatabaseBackupService();
    }
    return DatabaseBackupService.instance;
  }

  public async initialize(): Promise<void> {
    await this.ensureBackupDirectory();
    await this.getMetadata(); // Initialize metadata
    this.startAutoBackup();
  }

  public async startAutoBackup(): Promise<void> {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
    }

    this.backupTimer = setInterval(() => {
      this.createBackup().catch(error => {
        console.error('Auto backup failed:', error);
      });
    }, this.config.backupInterval);
  }

  public stopAutoBackup(): void {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
      this.backupTimer = null;
    }
  }

  public async createBackup(): Promise<string> {
    const dbPath = await this.getDatabasePath();
    const timestamp = Date.now();
    const backupFilename = `backup_${timestamp}.sqlite`;
    const backupPath = `${this.config.backupPath}/${backupFilename}`;

    try {
      // Copy database file
      await RNFS.copyFile(dbPath, backupPath);

      // Compress if enabled
      let finalPath = backupPath;
      if (this.config.compressBackups) {
        const zipPath = `${backupPath}.zip`;
        await zip(backupPath, zipPath);
        await RNFS.unlink(backupPath); // Delete uncompressed file
        finalPath = zipPath;
      }

      // Update metadata
      const stats = await RNFS.stat(finalPath);
      const metadata = await this.getMetadata();
      metadata.backups.push({
        path: finalPath,
        timestamp,
        size: stats.size,
      });
      metadata.lastBackupTime = timestamp;

      // Enforce backup limit
      await this.enforceBackupLimit(metadata);

      // Save updated metadata
      await this.saveMetadata(metadata);

      return finalPath;
    } catch (error) {
      console.error('Backup failed:', error);
      throw error;
    }
  }

  public async restoreFromBackup(backupPath: string): Promise<void> {
    const dbPath = await this.getDatabasePath();

    try {
      let sourceFile = backupPath;

      // Extract if compressed
      if (backupPath.endsWith('.zip')) {
        const extractPath = `${this.config.backupPath}/temp_restore_${Date.now()}`;
        await RNFS.mkdir(extractPath);
        await unzip(backupPath, extractPath);
        
        // Find the .sqlite file
        const files = await RNFS.readDir(extractPath);
        const sqliteFile = files.find(file => file.name.endsWith('.sqlite'));
        if (!sqliteFile) {
          throw new Error('No SQLite file found in backup');
        }
        sourceFile = sqliteFile.path;
      }

      // Close existing database connections
      await SQLite.enablePromise(true);
      const db = await SQLite.openDatabase({
        name: 'sp_loc_track_app.db',
        location: 'default',
      });
      await db.close();

      // Copy backup over current database
      await RNFS.copyFile(sourceFile, dbPath);

      // Clean up temp files if needed
      if (sourceFile !== backupPath) {
        const tempDir = sourceFile.substring(0, sourceFile.lastIndexOf('/'));
        await RNFS.unlink(tempDir);
      }

      // Reinitialize database connection
      await SQLite.openDatabase({
        name: 'sp_loc_track_app.db',
        location: 'default',
      });
    } catch (error) {
      console.error('Restore failed:', error);
      throw error;
    }
  }

  private async enforceBackupLimit(metadata: BackupMetadata): Promise<void> {
    // Sort backups by timestamp (oldest first)
    metadata.backups.sort((a, b) => a.timestamp - b.timestamp);

    // Remove excess backups
    while (metadata.backups.length > this.config.maxBackups) {
      const backup = metadata.backups.shift();
      if (backup) {
        try {
          await RNFS.unlink(backup.path);
        } catch (error) {
          console.error('Failed to delete old backup:', error);
        }
      }
    }
  }

  private async getDatabasePath(): Promise<string> {
    if (Platform.OS === 'android') {
      return `/data/data/${NativeModules.PlatformConstants.packageName}/databases/sp_loc_track_app.db`;
    } else {
      return `${RNFS.DocumentDirectoryPath}/sp_loc_track_app.db`;
    }
  }

  private async ensureBackupDirectory(): Promise<void> {
    try {
      const exists = await RNFS.exists(this.config.backupPath);
      if (!exists) {
        await RNFS.mkdir(this.config.backupPath);
      }
    } catch (error) {
      console.error('Failed to create backup directory:', error);
      throw error;
    }
  }

  private async getMetadata(): Promise<BackupMetadata> {
    try {
      const data = await AsyncStorage.getItem(this.BACKUP_META_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (error) {
      console.warn('Failed to load backup metadata:', error);
    }

    return {
      lastBackupTime: 0,
      backups: [],
    };
  }

  private async saveMetadata(metadata: BackupMetadata): Promise<void> {
    try {
      await AsyncStorage.setItem(this.BACKUP_META_KEY, JSON.stringify(metadata));
    } catch (error) {
      console.error('Failed to save backup metadata:', error);
      throw error;
    }
  }

  public async getBackupList(): Promise<BackupMetadata['backups']> {
    const metadata = await this.getMetadata();
    return metadata.backups;
  }

  public async deleteBackup(backupPath: string): Promise<void> {
    try {
      await RNFS.unlink(backupPath);

      const metadata = await this.getMetadata();
      metadata.backups = metadata.backups.filter(b => b.path !== backupPath);
      await this.saveMetadata(metadata);
    } catch (error) {
      console.error('Failed to delete backup:', error);
      throw error;
    }
  }

  public async updateConfig(newConfig: Partial<BackupConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    this.stopAutoBackup();
    this.startAutoBackup();
  }
}