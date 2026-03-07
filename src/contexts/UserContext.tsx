import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { clearStoredUser, getStorageSafely, loadStoredUser, saveStoredUser } from './userStorage';

export interface User {
    id: string;
    username: string;
    created_at: string;
}

interface UserContextValue {
    user: User | null;
    hydrated: boolean;
    setUser: (user: User | null) => void;
    logout: () => void;
}

const UserContext = createContext<UserContextValue | undefined>(undefined);

/**
 * 用户状态持久化到 localStorage，刷新或重新打开后自动恢复登录。
 */
export function UserProvider({ children }: { children: React.ReactNode }) {
    const [user, setUserState] = useState<User | null>(null);
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        const storage = typeof window !== 'undefined'
            ? getStorageSafely(() => window.localStorage)
            : null;

        if (storage) {
            setUserState(loadStoredUser(storage));
        }
        setHydrated(true);
    }, []);

    const setUser = useCallback((u: User | null) => {
        setUserState(u);
        const storage = typeof window !== 'undefined'
            ? getStorageSafely(() => window.localStorage)
            : null;
        if (!storage) return;

        if (u) {
            saveStoredUser(storage, u);
            return;
        }

        clearStoredUser(storage);
    }, []);

    const logout = useCallback(() => {
        setUserState(null);
        const storage = typeof window !== 'undefined'
            ? getStorageSafely(() => window.localStorage)
            : null;
        if (storage) {
            clearStoredUser(storage);
        }
    }, []);

    return (
        <UserContext.Provider value={{ user, hydrated, setUser, logout }}>
            {children}
        </UserContext.Provider>
    );
}

export function useUser() {
    const value = useContext(UserContext);
    if (!value) {
        throw new Error('useUser 必须在 UserProvider 内使用');
    }
    return value;
}
