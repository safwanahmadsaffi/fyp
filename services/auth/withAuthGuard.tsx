import React, { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { AuthStorageService } from './AuthStorageService';

export function withAuthGuard<P extends Record<string, unknown>>(Wrapped: React.ComponentType<P>): React.ComponentType<P> {
  const Guarded: React.FC<P> = (props) => {
    const navigation = useNavigation<any>();
    const authService = AuthStorageService.getInstance();

    useEffect(() => {
      const run = async () => {
        const expired = await authService.isExpired();
        if (expired) {
          navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        }
      };
      run();
    }, [navigation]);

    return <Wrapped {...props} />;
  };

  (Guarded as any).displayName = `withAuthGuard(${(Wrapped as any).displayName || Wrapped.name || 'Component'})`;
  return Guarded as React.ComponentType<P>;
}
