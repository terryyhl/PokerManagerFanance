import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';

interface ProtectedRouteProps {
    children: React.ReactNode;
}

/**
 * 路由守卫：未登录时重定向到 /login
 * 保留 from 参数，登录后可跳回原页面
 */
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
    const { user } = useUser();
    const location = useLocation();

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return <>{children}</>;
}
