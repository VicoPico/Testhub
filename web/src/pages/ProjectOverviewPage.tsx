import { useParams } from 'react-router-dom';

export function ProjectOverviewPage() {
	const { projectId } = useParams();
	return (
		<div>
			<h1>Overview</h1>
			<p>
				Project <b>{projectId}</b> (placeholder)
			</p>
		</div>
	);
}
