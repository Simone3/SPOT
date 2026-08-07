import type { Mock } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { renderWithTranslations } from '../testUtils';
import { AppErrorBoundary } from 'src/components/common/AppErrorBoundary';
import type { SpotDiagnosticsApi } from 'src/types/DiagnosticsTypes';

const originalSpotDiagnostics = window.spotDiagnostics;

const setWindowSpotDiagnostics = (spotDiagnostics: SpotDiagnosticsApi | undefined): void => {
	Object.defineProperty(window, 'spotDiagnostics', {
		configurable: true,
		writable: true,
		value: spotDiagnostics
	});
};

const createSpotDiagnostics = (reportRenderError: Mock<SpotDiagnosticsApi['reportRenderError']>): SpotDiagnosticsApi => {
	return {
		reportRenderError,
		reportTaskStateDrift: vi.fn(async() => {
			return {};
		})
	};
};

const Boom = (): ReactElement => {
	throw new Error('The task list could not be rendered');
};

describe('AppErrorBoundary', () => {
	beforeEach(() => {
		// React writes every caught error to the console on its own, which would bury the test output
		vi.spyOn(console, 'error').mockImplementation(() => {
			return undefined;
		});
	});

	afterEach(() => {
		setWindowSpotDiagnostics(originalSpotDiagnostics);
		vi.restoreAllMocks();
	});

	// The window is showing the crash screen instead of the application, so the failure behind it has to reach the log file: the
	// renderer console is developer-facing and an installed SPOT has no way of opening it
	test('reports the render error and names the log file it was written to', async() => {
		const reportRenderError: Mock<SpotDiagnosticsApi['reportRenderError']> = vi.fn(async() => {
			return { logFilePath: '/tmp/spot-logs/spot-logs.ndjson' };
		});
		setWindowSpotDiagnostics(createSpotDiagnostics(reportRenderError));

		renderWithTranslations(
			<AppErrorBoundary>
				<Boom/>
			</AppErrorBoundary>
		);

		expect(screen.getByRole('alert')).toHaveTextContent('SPOT ran into an unexpected error');
		expect(reportRenderError).toHaveBeenCalledTimes(1);
		expect(reportRenderError.mock.calls[0][0]).toMatchObject({
			message: 'The task list could not be rendered'
		});
		expect(reportRenderError.mock.calls[0][0].stack).toContain('The task list could not be rendered');
		expect(reportRenderError.mock.calls[0][0].componentStack).toContain('Boom');

		await waitFor(() => {
			expect(screen.getByRole('alert')).toHaveTextContent('The error was written to the SPOT log file, /tmp/spot-logs/spot-logs.ndjson.');
		});
	});

	// Saying nothing was written is the honest answer, and it never keeps the crash screen from being shown
	test('says so when the render error could not be written', async() => {
		setWindowSpotDiagnostics(createSpotDiagnostics(vi.fn(async() => {
			throw new Error('The main process is gone');
		})));

		renderWithTranslations(
			<AppErrorBoundary>
				<Boom/>
			</AppErrorBoundary>
		);

		await waitFor(() => {
			expect(screen.getByRole('alert')).toHaveTextContent('The error could not be written to the SPOT log file.');
		});
		expect(screen.getByRole('button', { name: 'Reload SPOT' })).toBeInTheDocument();
	});
});
