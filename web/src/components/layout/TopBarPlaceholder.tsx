export function TopBarPlaceholder(props: { projectId: string }) {
	return (
		<header
			style={{
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'space-between',
				padding: '0 16px',
				borderBottom: '1px solid rgba(0,0,0,0.1)',
			}}>
			<div style={{ fontWeight: 700 }}>Testhub</div>
			<div style={{ fontSize: 12, opacity: 0.7 }}>
				Project: {props.projectId}
			</div>
		</header>
	);
}
