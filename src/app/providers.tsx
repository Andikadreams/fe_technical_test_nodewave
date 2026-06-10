"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import type React from "react";
import { useEffect, useState } from "react";
import { queryClient } from "../api/api.client";

interface ProvidersProps {
	children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
	const [mounted, setMounted] = useState(false);
	const [toastMessage, setToastMessage] = useState<string | null>(null);

	useEffect(() => {
		setMounted(true);

		const handleConflict = (e: Event) => {
			const customEvent = e as CustomEvent;
			setToastMessage(customEvent.detail.message);
			// Auto dismiss toast after 5 seconds
			setTimeout(() => {
				setToastMessage(null);
			}, 5000);
		};

		window.addEventListener("concurrency-conflict", handleConflict);
		return () => {
			window.removeEventListener("concurrency-conflict", handleConflict);
		};
	}, []);

	return (
		<QueryClientProvider client={queryClient}>
			{children}

			{/* Global Toast Alert for Concurrency Mismatches */}
			{mounted && toastMessage && (
				<div className="fixed bottom-6 right-6 z-50 flex max-w-md animate-bounce items-center gap-3 rounded-lg border border-red-500 bg-red-950 p-4 shadow-lg text-red-200">
					<svg
						className="h-6 w-6 shrink-0 text-red-400"
						fill="none"
						viewBox="0 0 24 24"
						strokeWidth="1.5"
						stroke="currentColor"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
						/>
					</svg>
					<div>
						<p className="font-bold text-sm">Concurrency Collision</p>
						<p className="text-xs text-red-300">{toastMessage}</p>
					</div>
					<button
						type="button"
						className="ml-auto rounded-md bg-red-900 p-1 text-red-400 hover:text-red-200 hover:bg-red-800"
						onClick={() => setToastMessage(null)}
					>
						<span className="sr-only">Dismiss</span>
						<svg
							className="h-4 w-4"
							fill="none"
							viewBox="0 0 24 24"
							strokeWidth="1.5"
							stroke="currentColor"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>
				</div>
			)}
		</QueryClientProvider>
	);
}
