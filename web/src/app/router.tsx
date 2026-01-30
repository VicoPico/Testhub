import { createBrowserRouter, Navigate } from 'react-router-dom';

import { AppShell } from '../components/layout/AppShell';
import { AuthGate } from '../components/auth/AuthGate';
import { ProjectOverviewPage } from '../pages/ProjectOverviewPage';
import { RunsPage } from '../pages/RunsPage';
import { TestsPage } from '../pages/TestsPage';
import { AnalyticsPage } from '../pages/AnalyticsPage';
import { SettingsPage } from '../pages/SettingsPage';
import { RunDetailsPage } from '../pages/RunDetailsPage';
import { ProjectsPage } from '@/pages/ProjectsPage';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { VerifyEmailPage } from '@/pages/VerifyEmailPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';

export const router = createBrowserRouter([
	{
		path: '/login',
		element: <LoginPage />,
	},
	{
		path: '/register',
		element: <RegisterPage />,
	},
	{
		path: '/verify-email',
		element: <VerifyEmailPage />,
	},
	{
		path: '/reset-password',
		element: <ResetPasswordPage />,
	},
	{
		// All authenticated app pages live under the shell
		path: '/',
		element: (
			<AuthGate>
				<AppShell />
			</AuthGate>
		),
		children: [
			// Landing → projects list
			{
				index: true,
				element: <Navigate to='/projects' replace />,
			},

			// Workspace-level routes
			{
				path: 'projects',
				element: <ProjectsPage />,
				handle: { title: 'Projects' },
			},
			{
				path: 'settings',
				element: <SettingsPage />,
				handle: { title: 'Settings' },
			},

			// Project-scoped routes
			{
				path: 'projects/:projectId',
				children: [
					{
						index: true,
						element: <ProjectOverviewPage />,
						handle: { title: 'Overview' },
					},
					{
						path: 'runs',
						element: <RunsPage />,
						handle: { title: 'Runs' },
					},
					{
						path: 'runs/:runId',
						element: <RunDetailsPage />,
						handle: { title: 'Run details' },
					},
					{
						path: 'tests',
						element: <TestsPage />,
						handle: { title: 'Tests' },
					},
					{
						path: 'analytics',
						element: <AnalyticsPage />,
						handle: { title: 'Analytics' },
					},
				],
			},
		],
	},
]);
