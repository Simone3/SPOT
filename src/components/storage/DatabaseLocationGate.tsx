import 'src/components/storage/DatabaseLocationGate.css';
import { useContext, type ReactElement, type ReactNode } from 'react';
import { DatabaseLocationSetup } from 'src/components/storage/DatabaseLocationSetup';
import { DatabaseLocationContext } from 'src/contexts/DatabaseLocationContext';

type DatabaseLocationGateProps = {
	children: ReactNode;
};

// The rest of the app is rendered only when a usable task database folder is configured, so a first startup or an unavailable folder cannot silently fall back to another database
const DatabaseLocationGate = ({ children }: DatabaseLocationGateProps): ReactElement => {
	const databaseLocation = useContext(DatabaseLocationContext);

	if(!databaseLocation || databaseLocation.isLoading) {
		return (
			<div className='database-location-gate-status' role='status'>
				Loading SPOT...
			</div>
		);
	}

	if(databaseLocation.loadErrorMessage) {
		return (
			<div className='database-location-gate-status database-location-gate-status-error' role='alert'>
				<h3 className='database-location-gate-status-title'>Task storage is unavailable</h3>
				<p className='database-location-gate-status-message'>{databaseLocation.loadErrorMessage}</p>
			</div>
		);
	}

	if(databaseLocation.location?.state !== 'configured') {
		return <DatabaseLocationSetup/>;
	}

	return <>{children}</>;
};

export { DatabaseLocationGate };
