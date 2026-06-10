import { create } from "zustand";

export interface User {
	id: string;
	name: string;
	email: string;
	role: "PM" | "INTERNAL" | "CLIENT";
	department?: "PRODUCT" | "UIUX" | "FRONTEND" | "BACKEND" | null;
}

interface AuthState {
	user: User | null;
	token: string | null;
	isAuthenticated: boolean;
	setAuth: (user: User, token: string) => void;
	logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => {
	// Load initial state from localStorage safely in Next.js SSR context
	let initialUser: User | null = null;
	let initialToken: string | null = null;

	if (typeof window !== "undefined") {
		try {
			const storedUser = localStorage.getItem("pm_user");
			const storedToken = localStorage.getItem("pm_token");
			if (storedUser) initialUser = JSON.parse(storedUser);
			if (storedToken) initialToken = storedToken;
		} catch (e) {
			console.error("Error reading auth state from localStorage:", e);
		}
	}

	return {
		user: initialUser,
		token: initialToken,
		isAuthenticated: !!initialToken,
		setAuth: (user, token) => {
			if (typeof window !== "undefined") {
				localStorage.setItem("pm_user", JSON.stringify(user));
				localStorage.setItem("pm_token", token);
			}
			set({ user, token, isAuthenticated: true });
		},
		logout: () => {
			if (typeof window !== "undefined") {
				localStorage.removeItem("pm_user");
				localStorage.removeItem("pm_token");
			}
			set({ user: null, token: null, isAuthenticated: false });
		},
	};
});
