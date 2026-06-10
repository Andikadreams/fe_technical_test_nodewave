import { QueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useAuthStore } from "../store/auth.store";

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
		},
	},
});

const apiClient = axios.create({
	baseURL: process.env.NEXT_PUBLIC_BE_URL || "http://localhost:3001",
	headers: {
		"Content-Type": "application/json",
	},
});

// Request interceptor to attach JWT token
apiClient.interceptors.request.use(
	(config) => {
		const token = useAuthStore.getState().token;
		if (token && config.headers) {
			config.headers.Authorization = `Bearer ${token}`;
		}
		return config;
	},
	(error) => Promise.reject(error),
);

// Response interceptor to handle errors, especially 409 Conflict
apiClient.interceptors.response.use(
	(response) => response,
	(error) => {
		if (error.response && error.response.status === 409) {
			// Dispatch custom event to trigger global toast alert
			if (typeof window !== "undefined") {
				const event = new CustomEvent("concurrency-conflict", {
					detail: {
						message:
							error.response.data.error ||
							"Data concurrency conflict. This task has been modified elsewhere.",
					},
				});
				window.dispatchEvent(event);
			}

			// Trigger TanStack Query invalidation to fetch fresh data
			queryClient.invalidateQueries({ queryKey: ["tasks"] });
		}
		return Promise.reject(error);
	},
);

export default apiClient;
