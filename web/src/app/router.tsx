import { createBrowserRouter, Navigate } from 'react-router-dom';

import { AppShell } from '../components/layout/AppShell';
import { ProjectOverviewPage } from '../pages/ProjectOverviewPage';
import { RunsPage } from '../pages/RunsPage';
import { TestsPage } from '../pages/TestsPage';
import { AnalyticsPage } from '../pages/AnalyticsPage';
import { SettingsPage } from '../pages/SettingsPage';
import { RunDetailsPage } from '../pages/RunDetailsPage';
import { ProjectsPage } from '@/pages/ProjectsPage';

export const router = createBrowserRouter([
	{
		// All authenticated app pages live under the shell
		path: '/',
		element: <AppShell />,
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
