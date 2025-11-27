import { NativeModules } from 'react-native';

export class PasswordService {
  private static SALT_LENGTH = 16;

  public static async hashPassword(password: string): Promise<string> {
    try {
      // Create a salt using current timestamp and random string
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substring(2);
      const salt = (timestamp + random).slice(0, this.SALT_LENGTH);

      // Create hash using the password and salt
      const hash = await this.createHash(password + salt);

      // Format: salt:hash
      return `${salt}:${hash}`;
    } catch (error) {
      console.error('Password hashing failed:', error);
      throw error;
    }
  }

  public static async verifyPassword(storedHash: string, password: string): Promise<boolean> {
    try {
      const [salt, hash] = storedHash.split(':');
      const testHash = await this.createHash(password + salt);
      return testHash === hash;
    } catch (error) {
      console.error('Password verification failed:', error);
      return false;
    }
  }

  private static createHash(text: string): Promise<string> {
    const str = text.split('').map(char => char.charCodeAt(0).toString(16)).join('');
    return new Promise(resolve => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      resolve(Math.abs(hash).toString(36));
    });
  }
}