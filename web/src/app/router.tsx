import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShellPlaceholder } from '../components/layout/AppShellPlaceholder';
import { ProjectOverviewPage } from '../pages/ProjectOverviewPage';
import { RunsPage } from '../pages/RunsPage';
import { TestsPage } from '../pages/TestsPage';
import { AnalyticsPage } from '../pages/AnalyticsPage';
import { SettingsPage } from '../pages/SettingsPage';

export const router = createBrowserRouter([
	{
		path: '/',
		element: <Navigate to='/projects/demo' replace />,
	},
	{
		path: '/projects/:projectId',
		element: <AppShellPlaceholder />,
		children: [
			{ index: true, element: <ProjectOverviewPage /> },
			{ path: 'runs', element: <RunsPage /> },
			{ path: 'tests', element: <TestsPage /> },
			{ path: 'analytics', element: <AnalyticsPage /> },
			{ path: 'settings', element: <SettingsPage /> },
		],
	},
]);
