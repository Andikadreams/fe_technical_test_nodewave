"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import apiClient from "../api/api.client";
import { useAuthStore } from "../store/auth.store";

// Schemas for forms
const loginSchema = z.object({
	email: z.string().email("Invalid email address"),
	password: z.string().min(1, "Password is required"),
});

const registerSchema = z.object({
	email: z.string().email("Invalid email address"),
	password: z.string().min(6, "Password must be at least 6 characters"),
	name: z.string().min(1, "Name is required"),
	role: z.enum(["PM", "INTERNAL", "CLIENT"]),
	department: z
		.enum(["PRODUCT", "UIUX", "FRONTEND", "BACKEND"])
		.nullable()
		.optional(),
});

type LoginFields = z.infer<typeof loginSchema>;
type RegisterFields = z.infer<typeof registerSchema>;

export default function AuthPage() {
	const [isLogin, setIsLogin] = useState(true);
	const [errorMsg, setErrorMsg] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	const { setAuth, isAuthenticated } = useAuthStore();
	const router = useRouter();

	// Redirect to board if already authenticated
	useEffect(() => {
		if (isAuthenticated) {
			router.push("/board");
		}
	}, [isAuthenticated, router]);

	// Login Form
	const {
		register: loginRegister,
		handleSubmit: handleLoginSubmit,
		formState: { errors: loginErrors },
	} = useForm<LoginFields>({
		resolver: zodResolver(loginSchema),
	});

	// Register Form
	const {
		register: registerRegister,
		handleSubmit: handleRegisterSubmit,
		watch: watchRegister,
		formState: { errors: registerErrors },
	} = useForm<RegisterFields>({
		resolver: zodResolver(registerSchema),
		defaultValues: {
			role: "INTERNAL",
		},
	});

	const selectedRole = watchRegister("role");

	const onLogin = async (data: LoginFields) => {
		setLoading(true);
		setErrorMsg(null);
		try {
			const response = await apiClient.post("/api/auth/login", data);
			setAuth(response.data.user, response.data.token);
			router.push("/board");
		} catch (err: any) {
			setErrorMsg(
				err.response?.data?.error ||
					"Login failed. Please check your credentials.",
			);
		} finally {
			setLoading(false);
		}
	};

	const onRegister = async (data: RegisterFields) => {
		setLoading(true);
		setErrorMsg(null);
		// If not INTERNAL, clear department
		const payload = {
			...data,
			department: data.role === "INTERNAL" ? data.department : null,
		};
		try {
			const response = await apiClient.post("/api/auth/register", payload);
			setAuth(response.data.user, response.data.token);
			router.push("/board");
		} catch (err: any) {
			setErrorMsg(
				err.response?.data?.error ||
					"Registration failed. Try a different email.",
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<main className="flex min-h-screen items-center justify-center bg-radial from-nodewave-surface via-nodewave-dark to-nodewave-dark p-6">
			<div className="w-full max-w-md">
				{/* Brand Header */}
				<div className="mb-8 text-center">
					<div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-nodewave-blue text-white font-extrabold text-2xl shadow-[0_0_15px_rgba(10,132,255,0.4)]">
						N
					</div>
					<h1 className="mt-4 text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-nodewave-blue bg-clip-text text-transparent">
						NodeWave Project
					</h1>
					<p className="mt-2 text-sm text-slate-400">
						High-Value Project Management Backbone
					</p>
				</div>

				{/* Auth Box */}
				<div className="glass-panel rounded-2xl p-8 shadow-2xl relative overflow-hidden border border-slate-800">
					<div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-nodewave-blue to-transparent" />

					<h2 className="text-xl font-bold text-slate-100 mb-6">
						{isLogin ? "Sign In to Workspace" : "Create Member Account"}
					</h2>

					{errorMsg && (
						<div className="mb-4 rounded-lg bg-red-950/60 border border-red-500/50 p-3 text-sm text-red-200">
							{errorMsg}
						</div>
					)}

					{isLogin ? (
						/* LOGIN FORM */
						<form onSubmit={handleLoginSubmit(onLogin)} className="space-y-4">
							<div>
								<label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
									Email Address
								</label>
								<input
									type="email"
									placeholder="name@nodewave.id"
									className="w-full rounded-lg bg-slate-900/80 border border-slate-700 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-nodewave-blue focus:outline-none focus:ring-1 focus:ring-nodewave-blue transition"
									{...loginRegister("email")}
								/>
								{loginErrors.email && (
									<p className="mt-1 text-xs text-red-400">
										{loginErrors.email.message}
									</p>
								)}
							</div>

							<div>
								<label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
									Password
								</label>
								<input
									type="password"
									placeholder="••••••••"
									className="w-full rounded-lg bg-slate-900/80 border border-slate-700 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-nodewave-blue focus:outline-none focus:ring-1 focus:ring-nodewave-blue transition"
									{...loginRegister("password")}
								/>
								{loginErrors.password && (
									<p className="mt-1 text-xs text-red-400">
										{loginErrors.password.message}
									</p>
								)}
							</div>

							<button
								type="submit"
								disabled={loading}
								className="w-full mt-6 rounded-lg bg-nodewave-blue hover:bg-blue-600 active:bg-blue-700 py-3 text-sm font-semibold text-white shadow-[0_4px_12px_rgba(10,132,255,0.25)] hover:shadow-[0_4px_16px_rgba(10,132,255,0.4)] disabled:opacity-50 transition cursor-pointer"
							>
								{loading ? "Authenticating..." : "Sign In"}
							</button>
						</form>
					) : (
						/* REGISTER FORM */
						<form
							onSubmit={handleRegisterSubmit(onRegister)}
							className="space-y-4"
						>
							<div>
								<label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
									Full Name
								</label>
								<input
									type="text"
									placeholder="John Doe"
									className="w-full rounded-lg bg-slate-900/80 border border-slate-700 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-nodewave-blue focus:outline-none focus:ring-1 focus:ring-nodewave-blue transition"
									{...registerRegister("name")}
								/>
								{registerErrors.name && (
									<p className="mt-1 text-xs text-red-400">
										{registerErrors.name.message}
									</p>
								)}
							</div>

							<div>
								<label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
									Email Address
								</label>
								<input
									type="email"
									placeholder="name@nodewave.id"
									className="w-full rounded-lg bg-slate-900/80 border border-slate-700 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-nodewave-blue focus:outline-none focus:ring-1 focus:ring-nodewave-blue transition"
									{...registerRegister("email")}
								/>
								{registerErrors.email && (
									<p className="mt-1 text-xs text-red-400">
										{registerErrors.email.message}
									</p>
								)}
							</div>

							<div>
								<label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
									Password
								</label>
								<input
									type="password"
									placeholder="At least 6 characters"
									className="w-full rounded-lg bg-slate-900/80 border border-slate-700 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-nodewave-blue focus:outline-none focus:ring-1 focus:ring-nodewave-blue transition"
									{...registerRegister("password")}
								/>
								{registerErrors.password && (
									<p className="mt-1 text-xs text-red-400">
										{registerErrors.password.message}
									</p>
								)}
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div>
									<label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
										Role
									</label>
									<select
										className="w-full rounded-lg bg-slate-900/80 border border-slate-700 px-4 py-2.5 text-sm text-white focus:border-nodewave-blue focus:outline-none focus:ring-1 focus:ring-nodewave-blue transition"
										{...registerRegister("role")}
									>
										<option value="INTERNAL">Internal Team</option>
										<option value="PM">Product Manager</option>
										<option value="CLIENT">Client Guest</option>
									</select>
								</div>

								{selectedRole === "INTERNAL" && (
									<div>
										<label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
											Department
										</label>
										<select
											className="w-full rounded-lg bg-slate-900/80 border border-slate-700 px-4 py-2.5 text-sm text-white focus:border-nodewave-blue focus:outline-none focus:ring-1 focus:ring-nodewave-blue transition"
											{...registerRegister("department")}
										>
											<option value="UIUX">UI/UX Design</option>
											<option value="FRONTEND">Frontend Dev</option>
											<option value="BACKEND">Backend Dev</option>
											<option value="PRODUCT">Product Mgmt</option>
										</select>
									</div>
								)}
							</div>

							<button
								type="submit"
								disabled={loading}
								className="w-full mt-6 rounded-lg bg-nodewave-blue hover:bg-blue-600 active:bg-blue-700 py-3 text-sm font-semibold text-white shadow-[0_4px_12px_rgba(10,132,255,0.25)] disabled:opacity-50 transition cursor-pointer"
							>
								{loading ? "Creating Account..." : "Register"}
							</button>
						</form>
					)}

					{/* Toggle Button */}
					<div className="mt-6 text-center">
						<button
							type="button"
							className="text-xs text-slate-400 hover:text-nodewave-blue transition"
							onClick={() => {
								setIsLogin(!isLogin);
								setErrorMsg(null);
							}}
						>
							{isLogin
								? "Don't have an account? Register"
								: "Already have an account? Sign In"}
						</button>
					</div>
				</div>

				{/* Demo Credentials Guide */}
				<div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-xs text-slate-400">
					<p className="font-semibold text-slate-300 mb-2">
						💡 Demo Accounts (Seeded):
					</p>
					<ul className="space-y-1.5">
						<li>
							🔑 <span className="text-slate-300">PM:</span> pm@nodewave.id
							(password123)
						</li>
						<li>
							🔑 <span className="text-slate-300">UI/UX:</span> uiux@nodewave.id
							(password123)
						</li>
						<li>
							🔑 <span className="text-slate-300">Frontend:</span>{" "}
							frontend@nodewave.id (password123)
						</li>
						<li>
							🔑 <span className="text-slate-300">Backend:</span>{" "}
							backend@nodewave.id (password123)
						</li>
						<li>
							🔑 <span className="text-slate-300">Client:</span>{" "}
							client@client.id (password123)
						</li>
					</ul>
				</div>
			</div>
		</main>
	);
}
