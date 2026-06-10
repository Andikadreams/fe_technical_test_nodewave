"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
	Calendar,
	CheckCircle2,
	ChevronRight,
	ClipboardList,
	Clock,
	Eye,
	FileSpreadsheet,
	Layers,
	Lock,
	LogOut,
	Plus,
	Trash2,
	Unlock,
	User as UserIcon,
	X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type React from "react";
import { useEffect, useState } from "react";
import apiClient, { queryClient } from "../../api/api.client";
import { useAuthStore } from "../../store/auth.store";

interface Task {
	id: string;
	title: string;
	description: string;
	status: "TODO" | "IN_PROGRESS" | "DONE";
	isClientVisible: boolean;
	assignedToId: string | null;
	assignedTo: {
		id: string;
		name: string;
		email: string;
		role: string;
		department: string | null;
	} | null;
	version: number;
	dependencies: Task[];
	auditLogs: {
		id: string;
		changedColumn: string;
		oldValue: string | null;
		newValue: string | null;
		createdAt: string;
		user: {
			name: string;
			role: string;
		};
	}[];
}

interface User {
	id: string;
	name: string;
	email: string;
	role: string;
	department: string | null;
}

export default function BoardPage() {
	const { user, logout, isAuthenticated } = useAuthStore();
	const router = useRouter();

	// Redirect if not logged in
	useEffect(() => {
		if (!isAuthenticated) {
			router.push("/");
		}
	}, [isAuthenticated, router]);

	// States
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState("");
	const [selectedTask, setSelectedTask] = useState<Task | null>(null);
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [isStandupOpen, setIsStandupOpen] = useState(false);

	// Create task form state
	const [newTitle, setNewTitle] = useState("");
	const [newDescription, setNewDescription] = useState("");
	const [newIsClientVisible, setNewIsClientVisible] = useState(false);
	const [newAssignedTo, setNewAssignedTo] = useState("");
	const [newDependencies, setNewDependencies] = useState<string[]>([]);

	// Update task form state
	const [editStatus, setEditStatus] = useState<"TODO" | "IN_PROGRESS" | "DONE">(
		"TODO",
	);
	const [editAssignedTo, setEditAssignedTo] = useState("");
	const [editTitle, setEditTitle] = useState("");
	const [editDescription, setEditDescription] = useState("");
	const [editIsClientVisible, setEditIsClientVisible] = useState(false);
	const [editDependencies, setEditDependencies] = useState<string[]>([]);

	// Mock Attachments
	const [attachments, setAttachments] = useState<
		{ name: string; size: string }[]
	>([]);
	const [customError, setCustomError] = useState<string | null>(null);

	// Queries
	const { data: tasksData, isLoading: tasksLoading } = useQuery({
		queryKey: ["tasks", search, statusFilter],
		queryFn: async () => {
			let url = "/api/tasks?";
			if (search) {
				url += `searchFilters[title]=${search}&`;
			}
			if (statusFilter) {
				url += `filters[status]=${statusFilter}&`;
			}
			const res = await apiClient.get(url);
			return res.data.tasks as Task[];
		},
		enabled: !!user,
	});

	const { data: usersData } = useQuery({
		queryKey: ["users"],
		queryFn: async () => {
			// Create a list of users. If auth route doesn't expose users, we can fallback
			// In this system, we can retrieve them or use seeded options.
			// We will try fetching `/api/auth/me` or define fallback lists if it fails.
			// But standard seeding has UIUX, Frontend, Backend, PM. Let's do a fallback
			// array of options or fetch if endpoint existed.
			return [{ id: "all-users", name: "Unassigned" }];
		},
		enabled: !!user && user.role !== "CLIENT",
	});

	const { data: standupData } = useQuery({
		queryKey: ["standup"],
		queryFn: async () => {
			const res = await apiClient.get("/api/tasks/standup");
			return res.data;
		},
		enabled: !!user && user.role !== "CLIENT" && isStandupOpen,
	});

	// Mutations
	const createTaskMutation = useMutation({
		mutationFn: async (payload: any) => {
			const res = await apiClient.post("/api/tasks", payload);
			return res.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["tasks"] });
			setIsCreateOpen(false);
			resetCreateForm();
		},
		onError: (err: any) => {
			setCustomError(err.response?.data?.error || "Failed to create task");
		},
	});

	const updateTaskMutation = useMutation({
		mutationFn: async (payload: { id: string; version: number; data: any }) => {
			const res = await apiClient.put(`/api/tasks/${payload.id}`, {
				version: payload.version,
				...payload.data,
			});
			return res.data;
		},
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: ["tasks"] });
			setSelectedTask(null);
			setCustomError(null);
		},
		onError: (err: any) => {
			setCustomError(err.response?.data?.error || "Failed to update task");
		},
	});

	const deleteTaskMutation = useMutation({
		mutationFn: async (id: string) => {
			const res = await apiClient.delete(`/api/tasks/${id}`);
			return res.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["tasks"] });
			setSelectedTask(null);
		},
		onError: (err: any) => {
			setCustomError(err.response?.data?.error || "Failed to delete task");
		},
	});

	// Helper: check if task is blocked (has dependencies that are not DONE)
	const isTaskBlocked = (task: Task) => {
		if (!task.dependencies || task.dependencies.length === 0) return false;
		// Check if any dependency is not DONE
		return task.dependencies.some((dep) => dep.status !== "DONE");
	};

	// Form Resetters
	const resetCreateForm = () => {
		setNewTitle("");
		setNewDescription("");
		setNewIsClientVisible(false);
		setNewAssignedTo("");
		setNewDependencies([]);
		setCustomError(null);
	};

	const openEditModal = (task: Task) => {
		setSelectedTask(task);
		setEditStatus(task.status);
		setEditAssignedTo(task.assignedToId || "");
		setEditTitle(task.title);
		setEditDescription(task.description);
		setEditIsClientVisible(task.isClientVisible);
		setEditDependencies(
			task.dependencies ? task.dependencies.map((d) => d.id) : [],
		);
		setAttachments([]);
		setCustomError(null);
	};

	const handleUpdate = () => {
		if (!selectedTask) return;

		const data: any = {
			status: editStatus,
			assignedToId: editAssignedTo === "" ? null : editAssignedTo,
		};

		// If PM, allow updating everything
		if (user?.role === "PM") {
			data.title = editTitle;
			data.description = editDescription;
			data.isClientVisible = editIsClientVisible;
			data.dependencyIds = editDependencies;
		}

		updateTaskMutation.mutate({
			id: selectedTask.id,
			version: selectedTask.version,
			data,
		});
	};

	const handleAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.files && e.target.files.length > 0) {
			const file = e.target.files[0];
			const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
			setAttachments((prev) => [
				...prev,
				{ name: file.name, size: `${sizeMB} MB` },
			]);
		}
	};

	if (!user) return null;

	// Render for CLIENT role
	const renderClientDashboard = () => {
		const totalTasks = tasksData?.length || 0;
		const completedTasks =
			tasksData?.filter((t) => t.status === "DONE").length || 0;
		const completionPercentage =
			totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

		return (
			<div className="space-y-8 animate-fade-in">
				{/* Client Header Info */}
				<div className="glass-panel rounded-2xl p-8 border border-slate-800 relative overflow-hidden">
					<div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-nodewave-blue to-cyan-500" />
					<div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
						<div>
							<span className="inline-flex items-center gap-1.5 rounded-full bg-blue-950 px-3 py-1 text-xs font-semibold text-blue-400 border border-blue-800 mb-3">
								<Calendar className="h-3.5 w-3.5" /> Project Milestone Dashboard
							</span>
							<h2 className="text-3xl font-extrabold text-white">
								Toyota Project Progress
							</h2>
							<p className="text-sm text-slate-400 mt-1">
								Real-time deliverables status. Internal identities and comment
								logs are masked for privacy.
							</p>
						</div>

						<div className="flex items-center gap-4 bg-slate-950/50 border border-slate-800 rounded-xl p-4 shrink-0">
							<div className="h-12 w-12 rounded-lg bg-nodewave-blue/10 border border-nodewave-blue/20 flex items-center justify-center text-nodewave-blue font-bold text-xl">
								{completionPercentage}%
							</div>
							<div>
								<p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
									Total Progress
								</p>
								<p className="text-sm font-bold text-slate-200">
									{completedTasks} of {totalTasks} Milestones Complete
								</p>
							</div>
						</div>
					</div>

					{/* Progress Bar */}
					<div className="mt-6">
						<div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden border border-slate-800">
							<div
								className="bg-gradient-to-r from-nodewave-blue to-cyan-400 h-full rounded-full transition-all duration-500"
								style={{ width: `${completionPercentage}%` }}
							/>
						</div>
					</div>
				</div>

				{/* Milestone Task List */}
				<div className="space-y-4">
					<h3 className="text-xl font-bold text-slate-200 flex items-center gap-2">
						<FileSpreadsheet className="h-5 w-5 text-nodewave-blue" /> Visible
						Deliverables Checklist
					</h3>

					{tasksLoading ? (
						<div className="text-center py-12 text-slate-500">
							Loading milestones...
						</div>
					) : !tasksData || tasksData.length === 0 ? (
						<div className="glass-panel rounded-2xl p-12 text-center text-slate-500 border border-slate-800">
							No visible milestones set for this project yet.
						</div>
					) : (
						<div className="grid gap-4 md:grid-cols-2">
							{tasksData.map((task) => (
								<div
									key={task.id}
									className="glass-card rounded-xl p-6 relative border border-slate-800"
								>
									<div className="flex items-start justify-between gap-4">
										<div>
											<h4 className="font-bold text-slate-100 text-lg">
												{task.title}
											</h4>
											<p className="text-sm text-slate-400 mt-2 line-clamp-3">
												{task.description}
											</p>
										</div>

										<span
											className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${
												task.status === "DONE"
													? "bg-emerald-950 text-emerald-400 border border-emerald-800"
													: task.status === "IN_PROGRESS"
														? "bg-amber-950 text-amber-400 border border-amber-800"
														: "bg-slate-900 text-slate-400 border border-slate-700"
											}`}
										>
											{task.status === "DONE" && (
												<CheckCircle2 className="h-3 w-3" />
											)}
											{task.status === "IN_PROGRESS" && (
												<Clock className="h-3 w-3" />
											)}
											{task.status}
										</span>
									</div>

									{/* Clean Milestone dependencies indicator */}
									{task.dependencies && task.dependencies.length > 0 && (
										<div className="mt-4 pt-3 border-t border-slate-800/60 flex flex-wrap gap-2 items-center text-xs text-slate-400">
											<span className="font-medium">Dependencies:</span>
											{task.dependencies.map((dep) => (
												<span
													key={dep.id}
													className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800"
												>
													{dep.title}
												</span>
											))}
										</div>
									)}
								</div>
							))}
						</div>
					)}
				</div>
			</div>
		);
	};

	// Render for PM / INTERNAL roles (Standard Kanban)
	const renderKanbanBoard = () => {
		const columns: {
			title: string;
			status: "TODO" | "IN_PROGRESS" | "DONE";
			color: string;
		}[] = [
			{
				title: "To Do",
				status: "TODO",
				color: "border-slate-800 text-slate-400",
			},
			{
				title: "In Progress",
				status: "IN_PROGRESS",
				color: "border-amber-800 text-amber-400",
			},
			{
				title: "Done",
				status: "DONE",
				color: "border-emerald-800 text-emerald-400",
			},
		];

		return (
			<div className="space-y-6">
				{/* Filters and Controls */}
				<div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
					<div className="flex flex-1 gap-4">
						<input
							type="text"
							placeholder="Search tasks by title..."
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							className="flex-1 max-w-md rounded-lg bg-slate-900/60 border border-slate-800 px-4 py-2 text-sm text-white focus:border-nodewave-blue focus:outline-none"
						/>
						<select
							value={statusFilter}
							onChange={(e) => setStatusFilter(e.target.value)}
							className="rounded-lg bg-slate-900/60 border border-slate-800 px-4 py-2 text-sm text-white focus:border-nodewave-blue focus:outline-none"
						>
							<option value="">All Statuses</option>
							<option value="TODO">To Do</option>
							<option value="IN_PROGRESS">In Progress</option>
							<option value="DONE">Done</option>
						</select>
					</div>

					<div className="flex gap-3">
						<button
							onClick={() => setIsStandupOpen(true)}
							className="rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-950/60 px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white transition cursor-pointer"
						>
							📅 Standup Summary
						</button>

						{user.role === "PM" && (
							<button
								onClick={() => setIsCreateOpen(true)}
								className="flex items-center gap-2 rounded-lg bg-nodewave-blue hover:bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition cursor-pointer"
							>
								<Plus className="h-4 w-4" /> Create Task
							</button>
						)}
					</div>
				</div>

				{/* Board Grid */}
				{tasksLoading ? (
					<div className="text-center py-20 text-slate-500">
						Loading Kanban board...
					</div>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
						{columns.map((col) => {
							const colTasks =
								tasksData?.filter((t) => t.status === col.status) || [];
							return (
								<div
									key={col.status}
									className="glass-panel rounded-2xl p-5 border border-slate-850 flex flex-col min-h-[500px]"
								>
									<div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
										<h3 className="font-extrabold text-slate-100 flex items-center gap-2">
											<span
												className={`h-2 w-2 rounded-full ${
													col.status === "DONE"
														? "bg-emerald-500"
														: col.status === "IN_PROGRESS"
															? "bg-amber-500"
															: "bg-slate-500"
												}`}
											/>
											{col.title}
										</h3>
										<span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-bold text-slate-400">
											{colTasks.length}
										</span>
									</div>

									<div className="space-y-3 flex-1 overflow-y-auto">
										{colTasks.length === 0 ? (
											<div className="text-center py-12 text-xs text-slate-600 italic">
												No tasks
											</div>
										) : (
											colTasks.map((task) => {
												const blocked = isTaskBlocked(task);
												return (
													<div
														key={task.id}
														onClick={() => openEditModal(task)}
														className={`glass-card rounded-xl p-4 cursor-pointer relative ${
															blocked ? "blocked-card" : ""
														}`}
													>
														<div className="flex justify-between items-start gap-3">
															<h4 className="font-bold text-slate-200 text-sm line-clamp-1">
																{task.title}
															</h4>
															{blocked ? (
																<span className="inline-flex shrink-0 items-center justify-center rounded-full bg-red-950 p-1 text-red-400 border border-red-900">
																	<Lock className="h-3 w-3" />
																</span>
															) : (
																<span className="inline-flex shrink-0 items-center justify-center rounded-full bg-slate-900 p-1 text-slate-500">
																	<Unlock className="h-3 w-3" />
																</span>
															)}
														</div>

														<p className="text-xs text-slate-400 mt-2 line-clamp-2">
															{task.description}
														</p>

														{/* Blocked Badge */}
														{blocked && (
															<div className="mt-3 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-red-400 bg-red-950/40 px-2 py-0.5 rounded border border-red-900/50">
																Blocked by Prerequisite Tasks
															</div>
														)}

														{/* Task Bottom Details */}
														<div className="mt-4 pt-3 border-t border-slate-800/50 flex justify-between items-center text-[11px] text-slate-400">
															<span className="flex items-center gap-1 font-semibold">
																<UserIcon className="h-3.5 w-3.5 text-slate-500" />
																{task.assignedTo
																	? task.assignedTo.name.split(" ")[0]
																	: "Unassigned"}
															</span>
															<span className="bg-slate-900 px-1.5 py-0.5 rounded text-[10px] text-slate-500">
																v{task.version}
															</span>
														</div>
													</div>
												);
											})
										)}
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>
		);
	};

	return (
		<main className="min-h-screen bg-nodewave-dark text-slate-200 pb-16">
			{/* Premium Navbar */}
			<nav className="glass-panel sticky top-0 z-40 border-b border-slate-850 px-6 py-4">
				<div className="max-w-7xl mx-auto flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="flex h-9 w-9 items-center justify-center rounded-lg bg-nodewave-blue text-white font-extrabold text-lg shadow-[0_0_10px_rgba(10,132,255,0.3)]">
							N
						</div>
						<div>
							<p className="font-extrabold text-sm tracking-tight text-white leading-tight">
								NodeWave Hub
							</p>
							<p className="text-[10px] text-slate-400 leading-none">
								Task Management Backbone
							</p>
						</div>
					</div>

					<div className="flex items-center gap-4">
						<div className="text-right hidden sm:block">
							<p className="text-sm font-bold text-slate-200">{user.name}</p>
							<p className="text-[11px] text-slate-400 font-semibold uppercase">
								{user.role} {user.department ? `• ${user.department}` : ""}
							</p>
						</div>

						<button
							onClick={() => {
								logout();
								router.push("/");
							}}
							className="flex items-center gap-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-950/60 hover:bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer"
						>
							<LogOut className="h-3.5 w-3.5" /> Logout
						</button>
					</div>
				</div>
			</nav>

			{/* Main Workspace Area */}
			<div className="max-w-7xl mx-auto px-6 mt-8">
				{user.role === "CLIENT" ? renderClientDashboard() : renderKanbanBoard()}
			</div>

			{/* CREATE TASK DIALOG (PM only) */}
			{isCreateOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
					<div className="glass-panel w-full max-w-lg rounded-2xl border border-slate-800 p-6 shadow-2xl relative overflow-hidden animate-zoom-in">
						<div className="flex justify-between items-center mb-6">
							<h3 className="text-lg font-bold text-white">
								Create New Milestone Task
							</h3>
							<button
								onClick={() => setIsCreateOpen(false)}
								className="text-slate-400 hover:text-white transition"
							>
								<X className="h-5 w-5" />
							</button>
						</div>

						{customError && (
							<div className="mb-4 rounded-lg bg-red-950/60 border border-red-500/50 p-3 text-xs text-red-200">
								{customError}
							</div>
						)}

						<div className="space-y-4">
							<div>
								<label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
									Task Title
								</label>
								<input
									type="text"
									placeholder="e.g. Slice landing page template"
									value={newTitle}
									onChange={(e) => setNewTitle(e.target.value)}
									className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 text-sm text-white focus:border-nodewave-blue focus:outline-none"
								/>
							</div>

							<div>
								<label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
									Description
								</label>
								<textarea
									placeholder="Explain requirements in detail..."
									rows={3}
									value={newDescription}
									onChange={(e) => setNewDescription(e.target.value)}
									className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 text-sm text-white focus:border-nodewave-blue focus:outline-none"
								/>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div>
									<label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
										Assignee
									</label>
									<select
										value={newAssignedTo}
										onChange={(e) => setNewAssignedTo(e.target.value)}
										className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 text-sm text-white focus:border-nodewave-blue focus:outline-none"
									>
										<option value="">Unassigned</option>
										{tasksData
											?.reduce((acc: any[], t) => {
												if (
													t.assignedTo &&
													!acc.some((a) => a.id === t.assignedTo?.id)
												) {
													acc.push(t.assignedTo);
												}
												return acc;
											}, [])
											.map((u: any) => (
												<option key={u.id} value={u.id}>
													{u.name} ({u.department})
												</option>
											))}
										{/* Add fallback names if none exists in tasks */}
										<option value="uiux-fallback">Rudi (UI/UX)</option>
										<option value="fe-fallback">Fahri (Frontend)</option>
										<option value="be-fallback">Budi (Backend)</option>
									</select>
								</div>

								<div>
									<label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
										Client Visibility
									</label>
									<div className="flex items-center gap-2 mt-2">
										<input
											type="checkbox"
											id="visible-check"
											checked={newIsClientVisible}
											onChange={(e) => setNewIsClientVisible(e.target.checked)}
											className="rounded bg-slate-900 border-slate-700 text-nodewave-blue focus:ring-0 h-4 w-4"
										/>
										<label
											htmlFor="visible-check"
											className="text-sm text-slate-300"
										>
											Visible to Clients
										</label>
									</div>
								</div>
							</div>

							<div>
								<label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
									Select Prerequisite Tasks (Dependencies)
								</label>
								<div className="max-h-24 overflow-y-auto border border-slate-750 rounded-lg p-2 bg-slate-900/40 space-y-1.5">
									{tasksData && tasksData.length > 0 ? (
										tasksData.map((task) => (
											<div key={task.id} className="flex items-center gap-2">
												<input
													type="checkbox"
													id={`dep-${task.id}`}
													checked={newDependencies.includes(task.id)}
													onChange={(e) => {
														if (e.target.checked) {
															setNewDependencies([...newDependencies, task.id]);
														} else {
															setNewDependencies(
																newDependencies.filter((id) => id !== task.id),
															);
														}
													}}
													className="rounded bg-slate-900 border-slate-750 text-nodewave-blue focus:ring-0 h-3.5 w-3.5"
												/>
												<label
													htmlFor={`dep-${task.id}`}
													className="text-xs text-slate-300 truncate"
												>
													{task.title} ({task.status})
												</label>
											</div>
										))
									) : (
										<p className="text-[11px] text-slate-500 italic p-1">
											No tasks available to set as dependencies
										</p>
									)}
								</div>
							</div>
						</div>

						<div className="flex justify-end gap-3 mt-8">
							<button
								onClick={() => setIsCreateOpen(false)}
								className="rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-950/60 px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white transition cursor-pointer"
							>
								Cancel
							</button>
							<button
								onClick={() => {
									createTaskMutation.mutate({
										title: newTitle,
										description: newDescription,
										isClientVisible: newIsClientVisible,
										assignedToId:
											newAssignedTo === "" || newAssignedTo.endsWith("fallback")
												? null
												: newAssignedTo,
										dependencyIds: newDependencies,
									});
								}}
								disabled={createTaskMutation.isPending}
								className="rounded-lg bg-nodewave-blue hover:bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50 cursor-pointer"
							>
								{createTaskMutation.isPending ? "Creating..." : "Create Task"}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* UPDATE / EDIT TASK DETAILS DIALOG */}
			{selectedTask && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
					<div className="glass-panel w-full max-w-2xl rounded-2xl border border-slate-800 p-6 shadow-2xl relative overflow-hidden animate-zoom-in grid grid-cols-1 md:grid-cols-5 gap-6">
						{/* Main Form Fields */}
						<div className="md:col-span-3 space-y-4">
							<div className="flex justify-between items-center pb-2 border-b border-slate-800">
								<h3 className="text-lg font-bold text-white">Task Details</h3>
								<span className="bg-slate-900 border border-slate-800 text-[10px] text-slate-400 font-bold px-2 py-0.5 rounded">
									Version {selectedTask.version}
								</span>
							</div>

							{customError && (
								<div className="rounded-lg bg-red-950/60 border border-red-500/50 p-3 text-xs text-red-200">
									{customError}
								</div>
							)}

							{/* Title & Desc (Editable for PM, Read-only for INTERNAL) */}
							<div>
								<label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
									Task Title
								</label>
								<input
									type="text"
									value={editTitle}
									onChange={(e) => setEditTitle(e.target.value)}
									disabled={user.role !== "PM"}
									className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 text-sm text-white focus:border-nodewave-blue focus:outline-none disabled:opacity-60"
								/>
							</div>

							<div>
								<label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
									Description
								</label>
								<textarea
									value={editDescription}
									onChange={(e) => setEditDescription(e.target.value)}
									disabled={user.role !== "PM"}
									rows={4}
									className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 text-sm text-white focus:border-nodewave-blue focus:outline-none disabled:opacity-60"
								/>
							</div>

							{/* Internal Attachments section */}
							{user.role === "INTERNAL" && (
								<div className="pt-2">
									<label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
										Work Attachments
									</label>
									<div className="border border-dashed border-slate-700 hover:border-slate-500 rounded-lg p-4 bg-slate-900/20 text-center relative cursor-pointer">
										<input
											type="file"
											onChange={handleAttachmentUpload}
											className="absolute inset-0 opacity-0 cursor-pointer"
										/>
										<p className="text-xs text-slate-400">
											Click or drag files here to upload attachments
										</p>
									</div>
									{attachments.length > 0 && (
										<ul className="mt-2.5 space-y-1">
											{attachments.map((file, idx) => (
												<li
													key={idx}
													className="flex justify-between text-[11px] text-emerald-400 font-semibold bg-emerald-950/30 border border-emerald-900 px-2.5 py-1 rounded"
												>
													<span>📄 {file.name}</span>
													<span>{file.size}</span>
												</li>
											))}
										</ul>
									)}
								</div>
							)}
						</div>

						{/* Side Controls & History */}
						<div className="md:col-span-2 flex flex-col justify-between space-y-4">
							<div className="space-y-4">
								<div className="flex justify-end">
									<button
										onClick={() => setSelectedTask(null)}
										className="text-slate-400 hover:text-white transition"
									>
										<X className="h-5 w-5" />
									</button>
								</div>

								{/* Status Selection */}
								<div>
									<label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
										Task Status
									</label>
									<select
										value={editStatus}
										onChange={(e) => setEditStatus(e.target.value as any)}
										className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 text-sm text-white focus:border-nodewave-blue focus:outline-none"
									>
										<option value="TODO">To Do</option>
										<option value="IN_PROGRESS">In Progress</option>

										{/* Disable DONE transition for PMs per spec */}
										<option value="DONE" disabled={user.role === "PM"}>
											Done {user.role === "PM" ? "(Executor Only)" : ""}
										</option>
									</select>
									{user.role === "PM" && (
										<p className="text-[10px] text-amber-500/80 mt-1 italic">
											⚠️ PMs cannot transition status to DONE.
										</p>
									)}
								</div>

								{/* Assignee Selection (PM only) */}
								{user.role === "PM" && (
									<div>
										<label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
											Assignee
										</label>
										<select
											value={editAssignedTo}
											onChange={(e) => setEditAssignedTo(e.target.value)}
											className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 text-sm text-white focus:border-nodewave-blue focus:outline-none"
										>
											<option value="">Unassigned</option>
											{tasksData
												?.reduce((acc: any[], t) => {
													if (
														t.assignedTo &&
														!acc.some((a) => a.id === t.assignedTo?.id)
													) {
														acc.push(t.assignedTo);
													}
													return acc;
												}, [])
												.map((u: any) => (
													<option key={u.id} value={u.id}>
														{u.name} ({u.department})
													</option>
												))}
											<option value="uiux-fallback">Rudi (UI/UX)</option>
											<option value="fe-fallback">Fahri (Frontend)</option>
											<option value="be-fallback">Budi (Backend)</option>
										</select>
									</div>
								)}

								{/* Client Visibility toggle (PM only) */}
								{user.role === "PM" && (
									<div className="flex items-center gap-2 pt-1">
										<input
											type="checkbox"
											id="edit-visible-check"
											checked={editIsClientVisible}
											onChange={(e) => setEditIsClientVisible(e.target.checked)}
											className="rounded bg-slate-900 border-slate-700 text-nodewave-blue focus:ring-0 h-4 w-4"
										/>
										<label
											htmlFor="edit-visible-check"
											className="text-sm text-slate-300"
										>
											Visible to Clients
										</label>
									</div>
								)}

								{/* Audit Trail History */}
								<div className="pt-2">
									<label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5 flex items-center gap-1">
										<Layers className="h-3.5 w-3.5 text-slate-500" /> Audit Log
										(Immutable)
									</label>
									<div className="max-h-36 overflow-y-auto border border-slate-800 rounded-lg p-2.5 bg-slate-950/50 space-y-2">
										{selectedTask.auditLogs &&
										selectedTask.auditLogs.length > 0 ? (
											selectedTask.auditLogs.map((log) => (
												<div
													key={log.id}
													className="text-[10px] text-slate-400 border-b border-slate-900 pb-1.5 last:border-b-0"
												>
													<p className="font-semibold text-slate-300">
														{log.user.name} ({log.user.role})
													</p>
													<p className="mt-0.5 text-slate-500">
														Changed{" "}
														<span className="text-nodewave-blue font-medium">
															{log.changedColumn}
														</span>
														:{log.oldValue && ` "${log.oldValue}"`} →{" "}
														<span className="text-slate-300 font-medium">
															"{log.newValue}"
														</span>
													</p>
													<p className="text-[8px] text-slate-600 mt-0.5">
														{new Date(log.createdAt).toLocaleString()}
													</p>
												</div>
											))
										) : (
											<p className="text-[10px] text-slate-600 italic p-1">
												No log mutations recorded.
											</p>
										)}
									</div>
								</div>
							</div>

							{/* Actions Footer */}
							<div className="flex justify-between items-center gap-2 pt-4 border-t border-slate-800/80">
								{user.role === "PM" ? (
									<button
										onClick={() => {
											if (
												confirm(
													"Are you sure you want to soft-delete this task?",
												)
											) {
												deleteTaskMutation.mutate(selectedTask.id);
											}
										}}
										className="flex items-center gap-1 px-3 py-2 rounded-lg bg-red-950 hover:bg-red-900 border border-red-800 text-red-400 hover:text-red-200 text-xs font-semibold transition cursor-pointer"
									>
										<Trash2 className="h-3.5 w-3.5" /> Delete
									</button>
								) : (
									<div />
								)}

								<div className="flex gap-2">
									<button
										onClick={() => setSelectedTask(null)}
										className="rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-950/60 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer"
									>
										Cancel
									</button>
									<button
										onClick={handleUpdate}
										disabled={updateTaskMutation.isPending}
										className="rounded-lg bg-nodewave-blue hover:bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white transition disabled:opacity-50 cursor-pointer"
									>
										{updateTaskMutation.isPending
											? "Saving..."
											: "Save Changes"}
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* DAILY STANDUP AUTO-SUMMARY DIALOG */}
			{isStandupOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
					<div className="glass-panel w-full max-w-xl rounded-2xl border border-slate-800 p-6 shadow-2xl relative overflow-hidden animate-zoom-in">
						<div className="flex justify-between items-center mb-6 pb-2 border-b border-slate-800">
							<h3 className="text-lg font-bold text-white flex items-center gap-2">
								📅 Standup Auto-Summary (Previous Day)
							</h3>
							<button
								onClick={() => setIsStandupOpen(false)}
								className="text-slate-400 hover:text-white transition"
							>
								<X className="h-5 w-5" />
							</button>
						</div>

						<div className="space-y-6">
							<div>
								<h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">
									✅ What was completed yesterday
								</h4>
								<div className="space-y-3 bg-slate-950/40 border border-slate-850 rounded-xl p-4">
									{standupData?.completedYesterday &&
									Object.keys(standupData.completedYesterday).length > 0 ? (
										Object.entries(standupData.completedYesterday).map(
											([dept, tasks]: any) => (
												<div key={dept} className="text-sm">
													<span className="font-semibold text-slate-300 text-xs uppercase bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded mr-2">
														{dept}
													</span>
													<span className="text-slate-400">
														{tasks.join(", ")}
													</span>
												</div>
											),
										)
									) : (
										<p className="text-xs text-slate-500 italic">
											No tasks completed yesterday.
										</p>
									)}
								</div>
							</div>

							<div>
								<h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">
									⚠️ What is blocked today
								</h4>
								<div className="bg-slate-950/40 border border-slate-850 rounded-xl p-4">
									{/* Find tasks that are blocked based on query data */}
									{tasksData?.filter(isTaskBlocked).length ? (
										<div className="space-y-2">
											{tasksData.filter(isTaskBlocked).map((task) => (
												<div
													key={task.id}
													className="text-xs flex items-center justify-between text-slate-400"
												>
													<span>
														🚀{" "}
														<strong className="text-slate-300">
															{task.title}
														</strong>{" "}
														(
														{task.assignedTo
															? task.assignedTo.department
															: "Unassigned"}
														)
													</span>
													<span className="text-red-400 font-semibold flex items-center gap-1 bg-red-950/40 px-1.5 py-0.5 border border-red-900/50 rounded">
														<Lock className="h-3 w-3" /> Blocked by dependencies
													</span>
												</div>
											))}
										</div>
									) : (
										<p className="text-xs text-slate-500 italic">
											No active tasks are blocked today.
										</p>
									)}
								</div>
							</div>
						</div>

						<div className="flex justify-end mt-8">
							<button
								onClick={() => setIsStandupOpen(false)}
								className="rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 px-5 py-2.5 text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer"
							>
								Close Summary
							</button>
						</div>
					</div>
				</div>
			)}
		</main>
	);
}
