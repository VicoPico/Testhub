import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { ProjectOverviewPage } from '../pages/ProjectOverviewPage';
import { RunsPage } from '../pages/RunsPage';
import { TestsPage } from '../pages/TestsPage';
import { AnalyticsPage } from '../pages/AnalyticsPage';
import { SettingsPage } from '../pages/SettingsPage';
import { RunDetailsPage } from '../pages/RunDetailsPage';

export const router = createBrowserRouter([
	{
		path: '/',
		element: <Navigate to='/projects/demo' replace />,
	},
	{
		path: '/projects/:projectId',
		element: <AppShell />,
		handle: { title: 'Overview' },
		children: [
			{
				index: true,
				element: <ProjectOverviewPage />,
				handle: { title: 'Overview' },
			},
			{ path: 'runs', element: <RunsPage />, handle: { title: 'Runs' } },
			{
				path: 'runs/:runId',
				element: <RunDetailsPage />,
				handle: { title: 'Run details' },
			},
			{ path: 'tests', element: <TestsPage />, handle: { title: 'Tests' } },
			{
				path: 'analytics',
				element: <AnalyticsPage />,
				handle: { title: 'Analytics' },
			},
			{
				path: 'settings',
				element: <SettingsPage />,
				handle: { title: 'Settings' },
			},
		],
	},
]);
