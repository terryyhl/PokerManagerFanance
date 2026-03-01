import React, { createContext, useContext, useState, useCallback } from 'react';

export interface User {
    id: string;
    username: string;
    created_at: string;
}

interface UserContextValue {
    user: User | null;
    setUser: (user: User | null) => void;
    logout: () => void;
}

const UserContext = createContext<UserContextValue>({
    user: null,
    setUser: () => { },
    logout: () => { },
});

/**
 * 用户状态使用纯内存存储（不持久化到 sessionStorage/localStorage）
 * 保证每个浏览器窗口/标签页独立登录，关闭后自动失效。
 */
export function UserProvider({ children }: { children: React.ReactNode }) {
    const [user, setUserState] = useState<User | null>(null);

    const setUser = useCallback((u: User | null) => {
        setUserState(u);
    }, []);

    const logout = useCallback(() => {
        setUserState(null);
    }, []);

    return (
        <UserContext.Provider value={{ user, setUser, logout }}>
            {children}
        </UserContext.Provider>
    );
}

export function useUser() {
    return useContext(UserContext);
}
